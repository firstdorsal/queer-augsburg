//! The migrator against a real Postgres (`TEST_DATABASE_URL`, as `database.rs`), fed with
//! generated dumps of the production shapes: the gate, idempotency, the rules for old
//! documents, broken dumps that must fail, and that no value ever reaches the output.

#![cfg(feature = "mongo-source")]
#![forbid(unsafe_code)]

mod drop_guard;
mod migrate_support;

use backend::db::{DB, MIGRATOR};
use backend::migrate::anonymize::anonymize_dump;
use backend::migrate::config::ConfigError;
use backend::migrate::reader::SourceError;
use backend::migrate::report::{Report, EMPTY_DIGEST};
use backend::migrate::{run, Failure, Mode};
use backend::place_rules::place_name_key;
use backend::types::{SentEmailLog, WikiDocument, WikiDocumentVersion};
use bson::{doc, Bson};
use migrate_support::{id, state_of, write_config, AppRole, Fixture, TestDb, DATABASE, T0};
use sqlx::migrate::{Migration, MigrationType, Migrator};
use sqlx::postgres::{PgConnection, PgPoolOptions};
use sqlx::{Connection, SqlSafeStr};
use std::path::Path;
use std::process::Command;
use std::time::Duration;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::{TcpListener, TcpStream};

const MARKER: &str = "QXMARKERZQ";

async fn migrate(fixture: &Fixture, dump: &Path, db: &TestDb) -> Report {
    fixture.write(dump, DATABASE);
    run(&fixture.config(dump), &db.url, Mode::Migrate)
        .await
        .unwrap()
}

async fn verify(fixture: &Fixture, dump: &Path, db: &TestDb) -> Report {
    run(&fixture.config(dump), &db.url, Mode::Verify)
        .await
        .unwrap()
}

async fn table_exists(db: &TestDb, table: &str) -> bool {
    let mut connection = db.connect().await;
    let found: Option<String> = sqlx::query_scalar("SELECT to_regclass($1)::text")
        .bind(format!("public.{table}"))
        .fetch_one(&mut connection)
        .await
        .unwrap();
    found.is_some()
}

async fn scalar<T>(db: &TestDb, sql: &str) -> T
where
    T: for<'r> sqlx::Decode<'r, sqlx::Postgres> + sqlx::Type<sqlx::Postgres> + Send + Unpin,
{
    let mut connection = db.connect().await;
    sqlx::query_scalar(sqlx::AssertSqlSafe(sql.to_string()))
        .fetch_one(&mut connection)
        .await
        .unwrap()
}

async fn execute(db: &TestDb, sql: &str) {
    let mut connection = db.connect().await;
    sqlx::query(sqlx::AssertSqlSafe(sql.to_string()))
        .execute(&mut connection)
        .await
        .unwrap();
    connection.close().await.unwrap();
}

/// A role of the test that owns a table in its database, the case that orders the removal: a
/// role is dropped only after the database.
async fn owning_role(db: &TestDb) -> AppRole {
    let role = db.app_role().await;
    let mut connection = PgConnection::connect(&role.url).await.unwrap();
    sqlx::query("CREATE TABLE owned (x int)")
        .execute(&mut connection)
        .await
        .unwrap();
    connection.close().await.unwrap();
    role
}

async fn assert_removed(database: &str, role: &str) {
    assert!(
        !migrate_support::database_exists(database).await,
        "database {database} is left behind"
    );
    assert!(
        !migrate_support::role_exists(role).await,
        "role {role} is left behind"
    );
}

/// The harness: a test's database and its role go with the test.
#[tokio::test]
async fn a_test_database_and_its_role_are_removed_at_the_end_of_their_test() {
    let Some(db) = TestDb::new().await else {
        return;
    };
    let role = owning_role(&db).await;
    let database = db.name().to_string();
    assert!(migrate_support::database_exists(&database).await);
    assert!(migrate_support::role_exists(&role.name).await);
    db.drop().await;
    assert_removed(&database, &role.name).await;
}

/// A test that returns before `TestDb::drop`: both go when its value does.
#[tokio::test]
async fn a_test_database_and_its_role_are_removed_when_their_test_returns_early() {
    let Some(db) = TestDb::new().await else {
        return;
    };
    let role = owning_role(&db).await;
    let database = db.name().to_string();
    drop(db);
    assert_removed(&database, &role.name).await;
}

/// A test that panics while a task of it, logged in as the role, holds a lock in its database
/// in a transaction that nothing polls once the test unwinds. Run as `#[tokio::test]` runs one,
/// on a runtime of its own, but on a thread of its own, which keeps the panic there.
#[test]
fn a_test_database_and_its_role_are_removed_when_their_test_panics() {
    const PLANNED: &str = "the planned failure of the inner test";
    let (names_sender, names) = std::sync::mpsc::channel();
    let inner = std::thread::spawn(move || {
        tokio::runtime::Builder::new_current_thread()
            .enable_all()
            .build()
            .unwrap()
            .block_on(async move {
                let Some(db) = TestDb::new().await else {
                    return;
                };
                let role = owning_role(&db).await;
                names_sender
                    .send((db.name().to_string(), role.name.clone()))
                    .unwrap();
                let (held, holding) = tokio::sync::oneshot::channel();
                tokio::spawn(async move {
                    let mut connection = PgConnection::connect(&role.url).await.unwrap();
                    let mut transaction = connection.begin().await.unwrap();
                    sqlx::query("LOCK TABLE owned IN ACCESS SHARE MODE")
                        .execute(&mut *transaction)
                        .await
                        .unwrap();
                    held.send(()).unwrap();
                    std::future::pending::<()>().await;
                    drop(transaction);
                });
                holding.await.unwrap();
                panic!("{PLANNED}");
            })
    })
    .join();
    let Ok((database, role)) = names.try_recv() else {
        // Skipped: no server outside CI.
        inner.unwrap();
        return;
    };
    let payload = inner.expect_err("the inner test did not panic");
    assert_eq!(
        payload.downcast_ref::<String>().map(String::as_str),
        Some(PLANNED)
    );
    let runtime = tokio::runtime::Builder::new_current_thread()
        .enable_all()
        .build()
        .unwrap();
    runtime.block_on(assert_removed(&database, &role));
    assert_eq!(
        runtime.block_on(migrate_support::sessions_of(&role)),
        0,
        "sessions of the role are left"
    );
}

/// A `TestDb::drop` that fails partway, after the database (1) or after the database and the
/// first role (2): `Drop` repeats the removal, which skips what is gone and removes the rest.
#[tokio::test]
async fn a_test_database_removal_that_failed_partway_is_completed_by_its_guard() {
    for done in [1, 2] {
        let Some(mut db) = TestDb::new().await else {
            return;
        };
        let database = db.name().to_string();
        let first = owning_role(&db).await;
        let second = db.app_role().await;
        db.fail_removal_after(done);
        let failed = tokio::spawn(db.drop())
            .await
            .expect_err("the planned failure did not fail TestDb::drop")
            .into_panic();
        let message = failed.downcast_ref::<String>().cloned().unwrap_or_default();
        assert!(
            message.contains(&format!(
                "the planned failure after {done} of its statements"
            )),
            "{done}: {message}"
        );
        assert_removed(&database, &first.name).await;
        assert!(
            !migrate_support::role_exists(&second.name).await,
            "{done}: role {} is left behind",
            second.name
        );
    }
}

/// Set by the next test for the inner one.
const INNER_DROP_TEST: &str = "QA_TEST_DB_DROP_INNER_TEST";

/// Run only by the next test, in a process of its own, where what its guard prints can be read.
#[tokio::test]
#[ignore = "the inner test of a_dropped_test_database_is_not_removed_again_by_its_guard"]
async fn inner_test_that_drops_its_database() {
    if std::env::var_os(INNER_DROP_TEST).is_none() {
        return;
    }
    let Some(db) = TestDb::new().await else {
        return;
    };
    let role = owning_role(&db).await;
    eprintln!("inner database: {} {}", db.name(), role.name);
    db.drop().await;
}

/// `TestDb::drop` leaves nothing for `Drop` to do: the guard does not repeat the removal, and
/// so does not report that it removed what the test left.
#[test]
fn a_dropped_test_database_is_not_removed_again_by_its_guard() {
    let output = Command::new(std::env::current_exe().unwrap())
        .args([
            "inner_test_that_drops_its_database",
            "--exact",
            "--ignored",
            "--nocapture",
            "--test-threads=1",
        ])
        .env(INNER_DROP_TEST, "1")
        .output()
        .unwrap();
    let stdout = String::from_utf8_lossy(&output.stdout);
    let stderr = String::from_utf8_lossy(&output.stderr);
    assert!(
        output.status.success(),
        "{:?}:\n{stdout}\n{stderr}",
        output.status
    );
    let Some(names) = stderr
        .lines()
        .find_map(|line| line.strip_prefix("inner database: "))
    else {
        // Skipped: no server outside CI.
        return;
    };
    assert!(
        stdout.contains("test inner_test_that_drops_its_database ... ok"),
        "{stdout}"
    );
    assert!(!stderr.contains("migrate_support:"), "{stderr}");
    let (database, role) = names.split_once(' ').unwrap();
    let runtime = tokio::runtime::Builder::new_current_thread()
        .enable_all()
        .build()
        .unwrap();
    runtime.block_on(assert_removed(database, role));
}

#[tokio::test]
async fn the_shaped_dump_migrates_and_the_server_reads_it_back() {
    let Some(db) = TestDb::new().await else {
        return;
    };
    let dump = tempfile::tempdir().unwrap();
    let fixture = Fixture::shaped();
    let report = migrate(&fixture, dump.path(), &db).await;
    let rendered = report.render();
    assert!(report.verified, "{rendered}");
    assert!(report.errors.is_empty(), "{rendered}");
    assert!(report.warnings.is_empty(), "{rendered}");
    for (collection, expected) in fixture.counts() {
        let counts = &report.collections[collection.as_str()];
        assert_eq!(counts.expected, Some(expected), "{collection}");
        assert_eq!(counts.source, Some(expected), "{collection}");
        if collection != "email_drafts" {
            assert_eq!(counts.target, Some(expected), "{collection}");
            assert_eq!(counts.inserted, expected, "{collection}");
            assert_eq!(counts.source_digest, counts.target_digest, "{collection}");
            if expected > 0 {
                assert_ne!(counts.source_digest.as_deref(), Some(EMPTY_DIGEST));
            }
        }
    }
    assert!(rendered.contains(
        "MIGRATION VERIFIED users=5 originalUsers=2 places=3 meetings=4 sent_email_logs=2 \
         email_drafts=1 documents=2 document_groups=1 document_group_order=1 document_versions=2 digest="
    ), "{rendered}");
    assert_eq!(report.combined_digest().len(), 64);

    // The rules of data-shape.md, each as often as the fixture has the shape.
    assert_eq!(
        report
            .rules
            .get("users.capabilities missing_or_null_as_empty"),
        Some(&2)
    );
    assert_eq!(report.rules.get("users.admin kept_in_extra"), Some(&3));
    assert_eq!(
        report.rules.get("users.imported_from kept_in_extra"),
        Some(&1)
    );
    assert_eq!(
        report
            .rules
            .get("meetings.place_to_be_announced missing_as_false"),
        Some(&3)
    );
    assert_eq!(
        report
            .rules
            .get("meetings.place_id location_without_place_id"),
        Some(&1)
    );
    assert_eq!(
        report
            .rules
            .get("meetings.online.url_hidden url_hidden_ignored"),
        Some(&1)
    );
    assert_eq!(
        report.rules.get("meetings.age_restriction[] int32_as_i64"),
        Some(&3)
    );
    assert_eq!(
        report
            .rules
            .get("originalUsers.member.start_time_ms as_created_at"),
        Some(&2)
    );
    assert_eq!(
        report.rules.get("meetings.changed[].at double_as_i64"),
        None
    );

    // What the server serves is what the dump held, timestamps to the millisecond.
    let pool = PgPoolOptions::new().connect(&db.url).await.unwrap();
    let server = DB::new(pool.clone());
    let meeting = server.get_meeting("m0001").await.unwrap().unwrap();
    let changed = meeting.changed.unwrap();
    assert_eq!(changed.len(), 2);
    assert_eq!(changed[0].at, T0 + 2);
    assert_eq!(changed[1].at, T0 + 3);
    assert_eq!(changed[1].by, id("u30-", 30));
    assert_eq!(meeting.place_id.as_deref(), Some("p0001"));
    assert_eq!(meeting.price, vec![0.0, 2.5]);
    assert_eq!(meeting.attendance, Some(12));
    assert!(!meeting.place_to_be_announced);
    let old = server.get_meeting("m0002").await.unwrap().unwrap();
    assert_eq!(old.place_id, None);
    assert_eq!(old.location.unwrap().name, "Zentrum");
    assert_eq!(old.changed, None, "no history stays no history");
    assert_eq!(old.cancelled, None);
    let deleted = server.get_meeting("m0003").await.unwrap().unwrap();
    assert_eq!(deleted.deleted_at, Some(T0 + 5));
    assert!(deleted.place_to_be_announced);
    assert_eq!(deleted.online.as_ref().unwrap().url, None);
    let hybrid = server.get_meeting("m0004").await.unwrap().unwrap();
    assert_eq!(hybrid.time, None);
    assert_eq!(hybrid.attendance, Some(3));
    assert_eq!(
        hybrid.online.as_ref().unwrap().url.as_deref(),
        Some("https://example.org/geheim")
    );
    assert!(!hybrid.online.as_ref().unwrap().url_hidden);
    assert_eq!(
        hybrid.changed, None,
        "an empty history reads as none, as before"
    );

    let full = server.get_user(&id("u16-", 16)).await.unwrap().unwrap();
    let member = full.member.unwrap();
    assert_eq!(member.email, "anna@example.org");
    assert_eq!(member.start_time_ms, T0);
    assert_eq!(member.end_time_ms, Some(T0 + 10));
    assert_eq!(member.address.addition.as_deref(), Some("Hinterhaus"));
    assert_eq!(full.capabilities.unwrap().len(), 2);
    let null_capabilities = server.get_user(&id("u32-", 32)).await.unwrap().unwrap();
    assert_eq!(null_capabilities.capabilities, Some(vec![]));
    let sparse = null_capabilities.member.unwrap();
    assert_eq!(sparse.end_time_ms, None);
    assert_eq!(sparse.phone, None);
    assert_eq!(sparse.pronouns, None);
    let missing_capabilities = server.get_user(&id("u30-", 30)).await.unwrap().unwrap();
    assert_eq!(missing_capabilities.capabilities, Some(vec![]));
    assert!(missing_capabilities.member.unwrap().honorary);
    let no_member = server.get_user(&id("u26-", 26)).await.unwrap().unwrap();
    assert_eq!(no_member.member, None);
    assert_eq!(no_member.capabilities, Some(vec![]));

    let extra: Option<serde_json::Value> =
        sqlx::query_scalar("SELECT extra FROM users WHERE _id = $1")
            .bind(id("u30-", 30))
            .fetch_one(&pool)
            .await
            .unwrap();
    assert_eq!(
        extra,
        Some(serde_json::json!({"admin": false, "imported_from": "papier 2024"}))
    );
    let extra: Option<serde_json::Value> =
        sqlx::query_scalar("SELECT extra FROM users WHERE _id = $1")
            .bind(id("u26-", 26))
            .fetch_one(&pool)
            .await
            .unwrap();
    assert_eq!(extra, None);

    let (snapshot, created_at): (serde_json::Value, i64) =
        sqlx::query_as("SELECT snapshot, created_at FROM original_users WHERE user_id = $1")
            .bind(id("u16-", 16))
            .fetch_one(&pool)
            .await
            .unwrap();
    assert_eq!(created_at, T0);
    assert_eq!(snapshot["admin"], serde_json::json!(true));
    assert_eq!(snapshot["capabilities"], serde_json::Value::Null);
    assert_eq!(
        snapshot["member"]["email"],
        serde_json::json!("anna@example.org")
    );

    let places = server.get_places().await.unwrap();
    assert_eq!(places.len(), 3);
    assert_eq!(places[0].name, "Henry‘s  Coffee");

    let (state, version): (Vec<u8>, i64) =
        sqlx::query_as("SELECT state, state_version FROM documents WHERE _id = $1")
            .bind(id("doc1", 10))
            .fetch_one(&pool)
            .await
            .unwrap();
    let planted = fixture.collections["documents"][0]
        .get_binary_generic("state")
        .unwrap()
        .to_vec();
    assert_eq!(state, planted, "byte for byte");
    assert_eq!(version, 3);
    let document = server.get_document(&id("doc1", 10)).await.unwrap().unwrap();
    assert_eq!(document.group_ids, vec![id("grp1", 10)]);
    assert!(
        server
            .get_document(&id("doc2", 10))
            .await
            .unwrap()
            .is_none(),
        "deleted stays deleted"
    );
    let versions = server.get_document_versions(&id("doc1", 10)).await.unwrap();
    assert_eq!(versions.len(), 2);
    assert_eq!(versions[0]._id, id("ver2", 12));
    let (groups, order, documents) = server.get_document_list().await.unwrap();
    assert_eq!(
        groups[0].document_order,
        vec![id("doc1", 10), id("gone", 10)]
    );
    assert_eq!(order, vec![id("grp1", 10)]);
    assert_eq!(documents.len(), 1);
    assert_eq!(server.count_approved_members().await.unwrap(), 1);
    assert_eq!(
        sqlx::query_scalar::<_, i64>("SELECT count(*) FROM email_drafts")
            .fetch_one(&pool)
            .await
            .unwrap(),
        0,
        "drafts are not migrated"
    );
    pool.close().await;
    db.drop().await;
}

#[tokio::test]
async fn a_second_run_changes_nothing_and_a_changed_document_is_reapplied() {
    let Some(db) = TestDb::new().await else {
        return;
    };
    let dump = tempfile::tempdir().unwrap();
    let mut fixture = Fixture::shaped();
    let first = migrate(&fixture, dump.path(), &db).await;
    assert!(first.verified, "{}", first.render());
    let second = migrate(&fixture, dump.path(), &db).await;
    assert!(second.verified, "{}", second.render());
    for (collection, expected) in fixture.counts() {
        if collection == "email_drafts" {
            continue;
        }
        let counts = &second.collections[collection.as_str()];
        assert_eq!(counts.inserted, 0, "{collection}");
        assert_eq!(counts.updated, 0, "{collection}");
        assert_eq!(counts.unchanged, expected, "{collection}");
        assert_eq!(
            counts.target_digest,
            first.collections[collection.as_str()].target_digest,
            "{collection}"
        );
    }
    assert_eq!(second.combined_digest(), first.combined_digest());

    fixture.doc("meetings", 0).insert("title", "Umbenannt");
    let third = migrate(&fixture, dump.path(), &db).await;
    assert!(third.verified, "{}", third.render());
    assert_eq!(third.collections["meetings"].updated, 1);
    assert_eq!(third.collections["meetings"].unchanged, 3);
    assert_eq!(third.collections["users"].unchanged, 5);
    assert_ne!(third.combined_digest(), first.combined_digest());
    let title: String = scalar(&db, "SELECT title FROM meetings WHERE _id = 'm0001'").await;
    assert_eq!(title, "Umbenannt");
    db.drop().await;
}

#[tokio::test]
async fn a_row_dropped_from_postgres_fails_verification_and_a_rerun_repairs_it() {
    let Some(db) = TestDb::new().await else {
        return;
    };
    let dump = tempfile::tempdir().unwrap();
    let fixture = Fixture::shaped();
    assert!(migrate(&fixture, dump.path(), &db).await.verified);
    let clean = verify(&fixture, dump.path(), &db).await;
    assert!(clean.verified, "{}", clean.render());

    // A meeting silently gone (its history with it).
    execute(&db, "DELETE FROM meetings WHERE _id = 'm0001'").await;
    let report = verify(&fixture, dump.path(), &db).await;
    assert!(!report.verified);
    assert_eq!(
        report.errors.get("meetings target_count_mismatch"),
        Some(&1),
        "{}",
        report.render()
    );
    assert_eq!(report.errors.get("meetings digest_mismatch"), Some(&1));
    assert_eq!(
        report.errors.get("meeting_changes target_count_mismatch"),
        Some(&1)
    );
    assert!(report.render().ends_with("MIGRATION FAILED\n"));
    let repaired = migrate(&fixture, dump.path(), &db).await;
    assert!(repaired.verified, "{}", repaired.render());
    assert_eq!(
        repaired.collections["meetings"].unchanged, 4,
        "the hash table still knew the row"
    );

    // One history entry gone: the count and the digest both notice.
    execute(
        &db,
        "DELETE FROM meeting_changes WHERE meeting_id = 'm0001' AND position = 1",
    )
    .await;
    let report = verify(&fixture, dump.path(), &db).await;
    assert!(!report.verified);
    assert_eq!(
        report.errors.get("meetings digest_mismatch"),
        Some(&1),
        "{}",
        report.render()
    );
    assert_eq!(
        report.errors.get("meeting_changes target_count_mismatch"),
        Some(&1)
    );
    assert!(!report.errors.contains_key("meetings target_count_mismatch"));

    // A timestamp off by one millisecond, a member gone, a state byte changed.
    assert!(migrate(&fixture, dump.path(), &db).await.verified);
    execute(
        &db,
        "UPDATE meeting_changes SET at = at + 1 WHERE meeting_id = 'm0001' AND position = 0",
    )
    .await;
    let report = verify(&fixture, dump.path(), &db).await;
    assert_eq!(
        report.errors.get("meetings digest_mismatch"),
        Some(&1),
        "{}",
        report.render()
    );
    assert!(migrate(&fixture, dump.path(), &db).await.verified);
    execute(
        &db,
        "DELETE FROM members WHERE user_id = 'u16-xxxxxxxxxxxx'",
    )
    .await;
    let report = verify(&fixture, dump.path(), &db).await;
    assert_eq!(
        report.errors.get("users digest_mismatch"),
        Some(&1),
        "{}",
        report.render()
    );
    assert_eq!(report.errors.get("members target_count_mismatch"), Some(&1));
    assert_eq!(
        report.errors.get("members approved target_count_mismatch"),
        Some(&1)
    );
    assert!(migrate(&fixture, dump.path(), &db).await.verified);
    execute(
        &db,
        "UPDATE documents SET state = state || '\\x00'::bytea WHERE _id = 'doc1xxxxxx'",
    )
    .await;
    let report = verify(&fixture, dump.path(), &db).await;
    assert_eq!(
        report.errors.get("documents digest_mismatch"),
        Some(&1),
        "{}",
        report.render()
    );
    db.drop().await;
}

#[tokio::test]
async fn a_dump_whose_counts_differ_from_the_config_writes_nothing() {
    let Some(db) = TestDb::new().await else {
        return;
    };
    let dump = tempfile::tempdir().unwrap();
    let fixture = Fixture::shaped();
    fixture.write(dump.path(), DATABASE);

    // The dump is older than the config says (one meeting less).
    let mut config = fixture.config(dump.path());
    config.expected_counts.insert("meetings".into(), 5);
    let report = run(&config, &db.url, Mode::Migrate).await.unwrap();
    assert!(!report.verified);
    assert_eq!(
        report.errors.get("meetings count_mismatch"),
        Some(&1),
        "{}",
        report.render()
    );
    assert!(!table_exists(&db, "users").await, "nothing was applied");

    // A collection file that is empty where rows are expected.
    let mut empty = Fixture::shaped();
    empty.collections.insert("users", vec![]);
    empty.write(dump.path(), DATABASE);
    let report = run(&fixture.config(dump.path()), &db.url, Mode::Migrate)
        .await
        .unwrap();
    assert!(!report.verified);
    assert_eq!(
        report.errors.get("users count_mismatch"),
        Some(&1),
        "{}",
        report.render()
    );
    assert_eq!(report.collections["users"].source, Some(0));
    assert!(!table_exists(&db, "users").await);
    db.drop().await;
}

#[tokio::test]
async fn a_mispointed_dump_or_an_unknown_collection_is_an_error() {
    let dump = tempfile::tempdir().unwrap();
    let fixture = Fixture::shaped();
    fixture.write(dump.path(), DATABASE);
    let mut config = fixture.config(dump.path());
    config.database = "wrong-name".into();
    let err = run(&config, "postgres://nobody@127.0.0.1:1/none", Mode::Migrate)
        .await
        .unwrap_err();
    assert!(
        matches!(err, Failure::Source(SourceError::DatabaseDirMissing(_))),
        "{err}"
    );

    let mut config = fixture.config(dump.path());
    config.dump_dir = dump.path().join("nothing-here");
    let err = run(&config, "postgres://nobody@127.0.0.1:1/none", Mode::Migrate)
        .await
        .unwrap_err();
    assert!(
        matches!(err, Failure::Source(SourceError::DatabaseDirMissing(_))),
        "{err}"
    );

    std::fs::write(dump.path().join(DATABASE).join("sessions.bson"), b"").unwrap();
    let err = run(
        &fixture.config(dump.path()),
        "postgres://nobody@127.0.0.1:1/none",
        Mode::Migrate,
    )
    .await
    .unwrap_err();
    assert!(
        matches!(err, Failure::Source(SourceError::UnknownCollection { .. })),
        "{err}"
    );
    std::fs::remove_file(dump.path().join(DATABASE).join("sessions.bson")).unwrap();

    std::fs::remove_file(dump.path().join(DATABASE).join("document_versions.bson")).unwrap();
    let err = run(
        &fixture.config(dump.path()),
        "postgres://nobody@127.0.0.1:1/none",
        Mode::Migrate,
    )
    .await
    .unwrap_err();
    assert!(
        matches!(err, Failure::Source(SourceError::CollectionMissing(_))),
        "{err}"
    );

    let mut config = fixture.config(dump.path());
    config.expected_counts.remove("places");
    let err = run(&config, "postgres://nobody@127.0.0.1:1/none", Mode::Migrate)
        .await
        .unwrap_err();
    assert!(
        matches!(err, Failure::Config(ConfigError::MissingCount("places"))),
        "{err}"
    );
}

type Breaker = Box<dyn Fn(&mut Fixture)>;

/// Each broken dump must fail with the named collection, field and reason, and nothing
/// may be written.
#[tokio::test]
async fn broken_dumps_fail_the_gate_by_field_and_reason() {
    let Some(db) = TestDb::new().await else {
        return;
    };
    let u16 = id("u16-", 16);
    let cases: Vec<(&str, Breaker)> = vec![
        (
            "users.member.honorary missing",
            Box::new(|f| {
                f.doc("users", 0)
                    .get_document_mut("member")
                    .unwrap()
                    .remove("honorary");
            }),
        ),
        (
            "users.member.type null",
            Box::new(|f| {
                f.doc("users", 0)
                    .get_document_mut("member")
                    .unwrap()
                    .insert("type", Bson::Null);
            }),
        ),
        (
            "users.member.address.zip missing",
            Box::new(|f| {
                f.doc("users", 1)
                    .get_document_mut("member")
                    .unwrap()
                    .get_document_mut("address")
                    .unwrap()
                    .remove("zip");
            }),
        ),
        (
            "users.capabilities[] unknown_value",
            Box::new(|f| {
                f.doc("users", 0).insert("capabilities", vec!["Root"]);
            }),
        ),
        (
            "users._id wrong_type:int",
            Box::new(|f| {
                f.doc("users", 3).insert("_id", 7_i32);
            }),
        ),
        (
            "users._id duplicate_key",
            Box::new(|f| {
                let twin = f.doc("users", 0).clone();
                f.push("users", twin);
            }),
        ),
        (
            "meetings.changed[].at not_integral",
            Box::new(|f| {
                f.doc("meetings", 0)
                    .insert("changed", vec![doc! {"by": "x", "at": 1.5}]);
            }),
        ),
        (
            "meetings.time wrong_type:string",
            Box::new(|f| {
                f.doc("meetings", 0).insert("time", "gestern");
            }),
        ),
        // BSON strings hold U+0000, Postgres text does not: named, not a failed write.
        (
            "meetings.title nul_character",
            Box::new(|f| {
                f.doc("meetings", 0).insert("title", "Stamm\u{0}tisch");
            }),
        ),
        (
            "meetings.tags.freeform[] nul_character",
            Box::new(|f| {
                f.doc("meetings", 0)
                    .get_document_mut("tags")
                    .unwrap()
                    .insert("freeform", vec!["b\u{0}ar"]);
            }),
        ),
        (
            "users.extra nul_character",
            Box::new(|f| {
                f.doc("users", 0).insert("imported_from", "pa\u{0}pier");
            }),
        ),
        (
            "originalUsers nul_character",
            Box::new(|f| {
                f.doc("originalUsers", 0).insert("note", "a\u{0}b");
            }),
        ),
        (
            "meetings.attendance out_of_range",
            Box::new(|f| {
                f.doc("meetings", 0).insert("attendance", 70_000_i64);
            }),
        ),
        (
            "meetings.age_restriction[] out_of_range",
            Box::new(|f| {
                f.doc("meetings", 0).insert("age_restriction", vec![-1_i32]);
            }),
        ),
        (
            "meetings.status unknown_value",
            Box::new(|f| {
                f.doc("meetings", 0).insert("status", "Draft");
            }),
        ),
        (
            "meetings.tags.common[] unknown_value",
            Box::new(|f| {
                f.doc("meetings", 0)
                    .get_document_mut("tags")
                    .unwrap()
                    .insert("common", vec!["Bingo"]);
            }),
        ),
        (
            "meetings.legacy unknown_field",
            Box::new(|f| {
                f.doc("meetings", 1).insert("legacy", true);
            }),
        ),
        (
            "meetings.online.members_only missing",
            Box::new(|f| {
                f.doc("meetings", 2)
                    .get_document_mut("online")
                    .unwrap()
                    .remove("members_only");
            }),
        ),
        (
            "meetings.location.lat wrong_type:string",
            Box::new(|f| {
                f.doc("meetings", 0)
                    .get_document_mut("location")
                    .unwrap()
                    .insert("lat", "48");
            }),
        ),
        (
            "places.name_key key_mismatch",
            Box::new(|f| {
                f.doc("places", 0).insert("name_key", "falsch");
            }),
        ),
        (
            "places.name_key duplicate_key",
            Box::new(|f| {
                let name = "Zentrum";
                f.push("places", doc! {"_id": "p0009", "name": name, "name_key": place_name_key(name), "lat": 1.0, "lon": 2.0});
            }),
        ),
        (
            "documents.state undecodable",
            Box::new(|f| {
                f.doc("documents", 0).insert(
                    "state",
                    Bson::Binary(bson::Binary {
                        subtype: bson::spec::BinarySubtype::Generic,
                        bytes: vec![0xff, 0xfe, 0xfd],
                    }),
                );
            }),
        ),
        (
            "documents.deleted_by missing",
            Box::new(|f| {
                f.doc("documents", 1).insert("deleted_by", Bson::Null);
            }),
        ),
        (
            "documents.group_ids[] dangling",
            Box::new(|f| {
                f.doc("documents", 0)
                    .insert("group_ids", vec![id("nope", 10)]);
            }),
        ),
        (
            "originalUsers.member.start_time_ms missing",
            Box::new(|f| {
                f.doc("originalUsers", 0)
                    .get_document_mut("member")
                    .unwrap()
                    .remove("start_time_ms");
            }),
        ),
        (
            "document_group_order._id unknown_value",
            Box::new(|f| {
                f.doc("document_group_order", 0).insert("_id", "other");
            }),
        ),
        (
            "document_versions.document_id dangling",
            Box::new(|f| {
                f.doc("document_versions", 0)
                    .insert("document_id", id("nope", 10));
            }),
        ),
        (
            "sent_email_logs.failed_count out_of_range",
            Box::new(|f| {
                f.doc("sent_email_logs", 0).insert("failed_count", -1_i64);
            }),
        ),
        (
            "sent_email_logs.reply_to wrong_type:bool",
            Box::new(|f| {
                f.doc("sent_email_logs", 0).insert("reply_to", false);
            }),
        ),
        (
            "sent_email_logs.successful_count out_of_range",
            Box::new(|f| {
                f.doc("sent_email_logs", 0)
                    .insert("successful_count", 3_000_000_000_i64);
            }),
        ),
    ];
    for (expected, breaker) in cases {
        let dump = tempfile::tempdir().unwrap();
        let mut fixture = Fixture::shaped();
        breaker(&mut fixture);
        let _ = u16;
        let report = migrate(&fixture, dump.path(), &db).await;
        assert!(!report.verified, "{expected}: {}", report.render());
        assert_eq!(
            report.errors.get(expected),
            Some(&1),
            "{expected}: {}",
            report.render()
        );
        assert!(report.render().ends_with("MIGRATION FAILED\n"));
        assert!(
            !table_exists(&db, "users").await,
            "{expected}: nothing may be written"
        );
    }
    db.drop().await;
}

#[tokio::test]
async fn an_ignored_field_passes_and_is_counted() {
    let Some(db) = TestDb::new().await else {
        return;
    };
    let dump = tempfile::tempdir().unwrap();
    let mut fixture = Fixture::shaped();
    fixture.doc("meetings", 1).insert("legacy", true);
    fixture
        .doc("users", 0)
        .get_document_mut("member")
        .unwrap()
        .insert("old_flag", 1_i32);
    fixture.write(dump.path(), DATABASE);
    let mut config = fixture.config(dump.path());
    config
        .ignored_fields
        .insert("meetings".into(), vec!["legacy".into()]);
    config
        .ignored_fields
        .insert("users".into(), vec!["member.old_flag".into()]);
    let report = run(&config, &db.url, Mode::Migrate).await.unwrap();
    assert!(report.verified, "{}", report.render());
    assert_eq!(report.rules.get("meetings.legacy ignored_field"), Some(&1));
    assert_eq!(
        report.rules.get("users.member.old_flag ignored_field"),
        Some(&1)
    );
    db.drop().await;
}

#[tokio::test]
async fn warnings_do_not_block_the_gate() {
    let Some(db) = TestDb::new().await else {
        return;
    };
    let dump = tempfile::tempdir().unwrap();
    let mut fixture = Fixture::shaped();
    fixture.doc("meetings", 0).insert("place_id", "zzzzz");
    let unsaved = state_of("# Satzung\n\nNoch nicht gespeichert.");
    fixture.doc("documents", 0).insert("state", unsaved.clone());
    let report = migrate(&fixture, dump.path(), &db).await;
    assert!(report.verified, "{}", report.render());
    assert_eq!(report.warnings.get("meetings.place_id dangling"), Some(&1));
    assert_eq!(
        report
            .rules
            .get("documents.state text_differs_from_content"),
        Some(&1)
    );
    let place_id: Option<String> =
        scalar(&db, "SELECT place_id FROM meetings WHERE _id = 'm0001'").await;
    assert_eq!(
        place_id.as_deref(),
        Some("zzzzz"),
        "the id is kept for the owner to decide"
    );
    let state: Vec<u8> = scalar(&db, "SELECT state FROM documents WHERE _id = 'doc1xxxxxx'").await;
    assert_eq!(
        Bson::Binary(bson::Binary {
            subtype: bson::spec::BinarySubtype::Generic,
            bytes: state
        }),
        unsaved,
        "the state wins, byte for byte"
    );
    db.drop().await;
}

/// `db` behind a proxy that holds back the server's first answer on every new connection by
/// `delay`: logins as slow as during a long disk stall. Returns the URL through the proxy.
async fn behind_slow_logins(db: &TestDb, delay: Duration) -> String {
    let mut url = url::Url::parse(&db.url).unwrap();
    let upstream = format!("{}:{}", url.host_str().unwrap(), url.port().unwrap_or(5432));
    let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
    url.set_host(Some("127.0.0.1")).unwrap();
    url.set_port(Some(listener.local_addr().unwrap().port()))
        .unwrap();
    tokio::spawn(async move {
        while let Ok((client, _)) = listener.accept().await {
            let upstream = upstream.clone();
            tokio::spawn(async move {
                let Ok(server) = TcpStream::connect(&upstream).await else {
                    return;
                };
                let (mut client_read, mut client_write) = client.into_split();
                let (mut server_read, mut server_write) = server.into_split();
                tokio::spawn(async move {
                    let _ = tokio::io::copy(&mut client_read, &mut server_write).await;
                });
                let mut first = vec![0; 64 * 1024];
                let Ok(read @ 1..) = server_read.read(&mut first).await else {
                    return;
                };
                tokio::time::sleep(delay).await;
                if client_write.write_all(&first[..read]).await.is_ok() {
                    let _ = tokio::io::copy(&mut server_read, &mut client_write).await;
                }
            });
        }
    });
    url.to_string()
}

/// A run that failed on a loaded host with "connect: pool timed out" while a checkpoint
/// stalled the disk: logins slower than the 10 s the migrator used to wait must not abort a
/// cutover (`DATABASE_WAIT`).
#[tokio::test]
async fn logins_as_slow_as_under_a_disk_stall_do_not_abort_the_run() {
    let Some(db) = TestDb::new().await else {
        return;
    };
    let dump = tempfile::tempdir().unwrap();
    let fixture = Fixture::shaped();
    fixture.write(dump.path(), DATABASE);
    let slow = behind_slow_logins(&db, Duration::from_secs(15)).await;
    let report = run(&fixture.config(dump.path()), &slow, Mode::Migrate)
        .await
        .unwrap();
    assert!(report.verified, "{}", report.render());
    db.drop().await;
}

#[tokio::test]
async fn verify_compares_without_writing() {
    let Some(db) = TestDb::new().await else {
        return;
    };
    let dump = tempfile::tempdir().unwrap();
    let mut fixture = Fixture::shaped();
    assert!(migrate(&fixture, dump.path(), &db).await.verified);
    fixture.doc("meetings", 0).insert("title", "Anders");
    fixture.write(dump.path(), DATABASE);
    let report = verify(&fixture, dump.path(), &db).await;
    assert!(!report.verified);
    assert_eq!(
        report.errors.get("meetings digest_mismatch"),
        Some(&1),
        "{}",
        report.render()
    );
    assert_eq!(report.collections["meetings"].inserted, 0);
    let title: String = scalar(&db, "SELECT title FROM meetings WHERE _id = 'm0001'").await;
    assert_eq!(title, "Stammtisch");
    db.drop().await;
}

#[tokio::test]
async fn a_snapshot_of_a_deleted_user_is_kept_and_reported() {
    let Some(db) = TestDb::new().await else {
        return;
    };
    let dump = tempfile::tempdir().unwrap();
    let mut fixture = Fixture::shaped();
    fixture
        .doc("originalUsers", 0)
        .insert("_id", id("ghost", 16));

    let report = migrate(&fixture, dump.path(), &db).await;

    assert!(report.verified, "{}", report.render());
    assert_eq!(report.warnings.get("originalUsers._id dangling"), Some(&1));
    let kept: i64 = scalar(
        &db,
        "SELECT count(*) FROM original_users o
         WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u._id = o.user_id)",
    )
    .await;
    assert_eq!(kept, 1);
    db.drop().await;
}

#[tokio::test]
async fn old_snapshots_count_their_start_in_seconds() {
    let Some(db) = TestDb::new().await else {
        return;
    };
    let dump = tempfile::tempdir().unwrap();
    let mut fixture = Fixture::shaped();
    let member = fixture
        .doc("originalUsers", 0)
        .get_document_mut("member")
        .unwrap();
    let milliseconds = member.get_i64("start_time_ms").unwrap();
    member.remove("start_time_ms");
    member.insert("start_time_secs", milliseconds / 1000);

    let report = migrate(&fixture, dump.path(), &db).await;

    assert!(report.verified, "{}", report.render());
    assert_eq!(
        report
            .rules
            .get("originalUsers.member.start_time_secs as_created_at_in_ms"),
        Some(&1)
    );
    assert_eq!(
        report
            .rules
            .get("originalUsers.member.start_time_ms as_created_at"),
        Some(&1)
    );
    let created_at = |user_id: &str| {
        format!("SELECT created_at FROM original_users WHERE user_id = '{user_id}'")
    };
    let seconds = milliseconds / 1000;
    assert_eq!(seconds * 1000, milliseconds, "T0 is a whole second");
    let old: i64 = scalar(&db, &created_at(&id("u16-", 16))).await;
    assert_eq!(old, seconds * 1000);
    let new: i64 = scalar(&db, &created_at(&id("u30-", 30))).await;
    assert_eq!(new, T0, "a snapshot in milliseconds keeps them");
    db.drop().await;
}

#[tokio::test]
async fn the_anonymized_dump_migrates_like_the_original() {
    let Some(db) = TestDb::new().await else {
        return;
    };
    let dump = tempfile::tempdir().unwrap();
    let anonymized = tempfile::tempdir().unwrap();
    let fixture = Fixture::marked(MARKER);
    fixture.write(dump.path(), DATABASE);
    anonymize_dump(dump.path(), anonymized.path(), &[DATABASE.to_string()]).unwrap();
    let config = fixture.config(anonymized.path());
    let report = run(&config, &db.url, Mode::Migrate).await.unwrap();
    assert!(report.verified, "{}", report.render());
    assert_eq!(
        report
            .rules
            .get("meetings.place_id location_without_place_id"),
        Some(&1)
    );
    let emails: Vec<String> = {
        let mut connection = db.connect().await;
        sqlx::query_scalar("SELECT email FROM members ORDER BY user_id")
            .fetch_all(&mut connection)
            .await
            .unwrap()
    };
    assert_eq!(emails.len(), 4);
    assert!(emails
        .iter()
        .all(|e| !e.contains(MARKER) && e.ends_with("@example.invalid")));
    db.drop().await;
}

/// Runs the binary and returns (exit code, stdout, stderr).
fn run_binary(args: &[&str], database_url: &str) -> (i32, String, String) {
    let output = Command::new(env!("CARGO_BIN_EXE_migrate-from-mongo"))
        .args(args)
        .env("DATABASE_URL", database_url)
        .output()
        .unwrap();
    (
        output.status.code().unwrap_or(-1),
        String::from_utf8_lossy(&output.stdout).into_owned(),
        String::from_utf8_lossy(&output.stderr).into_owned(),
    )
}

/// Every string of the dump, the ids included, carries the marker; whatever the run does,
/// the marker must not be in anything printed.
#[tokio::test]
async fn nothing_of_the_data_reaches_the_output() {
    let Some(db) = TestDb::new().await else {
        return;
    };
    let dump = tempfile::tempdir().unwrap();
    let fixture = Fixture::marked_with_ids(MARKER);
    fixture.write(dump.path(), DATABASE);
    let config_path = dump.path().join("migrate.yml");
    write_config(&fixture.config(dump.path()), &config_path);
    let config = config_path.to_str().unwrap();

    // The good case.
    let (code, out, err) = run_binary(&["migrate", "--config", config], &db.url);
    assert_eq!(code, 0, "{out}{err}");
    assert!(out.contains("MIGRATION VERIFIED users=5"), "{out}");
    assert!(!out.contains(MARKER) && !err.contains(MARKER), "{out}{err}");
    let (code, out, err) = run_binary(&["verify", "--config", config], &db.url);
    assert_eq!(code, 0, "{out}{err}");
    assert!(!out.contains(MARKER) && !err.contains(MARKER), "{out}{err}");

    // A conversion failure names the field, not the document.
    let mut broken = Fixture::marked_with_ids(MARKER);
    broken
        .doc("users", 0)
        .get_document_mut("member")
        .unwrap()
        .remove("honorary");
    broken
        .doc("meetings", 0)
        .insert("time", format!("{MARKER}gestern"));
    broken.write(dump.path(), DATABASE);
    let (code, out, err) = run_binary(&["migrate", "--config", config], &db.url);
    assert_eq!(code, 1, "{out}{err}");
    assert!(out.contains("users.member.honorary missing 1"), "{out}");
    assert!(out.contains("meetings.time wrong_type:string 1"), "{out}");
    assert!(out.ends_with("MIGRATION FAILED\n"), "{out}");
    assert!(!out.contains(MARKER) && !err.contains(MARKER), "{out}{err}");

    // A database error names the code and the constraint, not the key Postgres quotes.
    fixture.write(dump.path(), DATABASE);
    let place_name = fixture.collections["places"][0].get_str("name").unwrap();
    {
        let mut connection = db.connect().await;
        sqlx::query("DELETE FROM migration_hashes")
            .execute(&mut connection)
            .await
            .unwrap();
        sqlx::query("DELETE FROM places WHERE _id = $1")
            .bind(fixture.collections["places"][0].get_str("_id").unwrap())
            .execute(&mut connection)
            .await
            .unwrap();
        sqlx::query(
            "INSERT INTO places (_id, name, name_key, lat, lon) VALUES ('other', $1, $2, 0, 0)",
        )
        .bind(place_name)
        .bind(place_name_key(place_name))
        .execute(&mut connection)
        .await
        .unwrap();
        connection.close().await.unwrap();
    }
    let (code, out, err) = run_binary(&["migrate", "--config", config], &db.url);
    assert_eq!(code, 1, "{out}{err}");
    assert!(
        err.contains("database: places: database error code=23505 constraint=places_name_key_key"),
        "{err}"
    );
    assert!(out.ends_with("MIGRATION FAILED\n"), "{out}");
    assert!(!out.contains(MARKER) && !err.contains(MARKER), "{out}{err}");
    let count: i64 = scalar(&db, "SELECT count(*) FROM places WHERE _id = 'other'").await;
    assert_eq!(count, 1, "the transaction was rolled back");

    // A wrong config and a wrong dump directory.
    let (code, out, err) = run_binary(&["migrate", "--config", "/nonexistent.yml"], &db.url);
    assert_eq!(code, 1);
    assert!(err.starts_with("config: cannot read"), "{err}");
    assert!(out.ends_with("MIGRATION FAILED\n"), "{out}");
    let (code, _, err) = run_binary(&["migrate"], &db.url);
    assert_eq!(code, 2);
    assert!(err.starts_with("usage:"), "{err}");
    db.drop().await;
}

#[tokio::test]
async fn ties_keep_the_order_of_the_dump_and_new_rows_come_after_it() {
    let Some(db) = TestDb::new().await else {
        return;
    };
    let dump = tempfile::tempdir().unwrap();
    let mut fixture = Fixture::shaped();
    // mongodump writes the natural order, which is not the id order.
    for collection in ["users", "meetings", "documents"] {
        fixture.collections.get_mut(collection).unwrap().reverse();
    }
    for meeting in fixture.collections.get_mut("meetings").unwrap() {
        meeting.insert("time", T0 + 100);
    }
    let order = |fixture: &Fixture, collection: &str| -> Vec<String> {
        fixture.collections[collection]
            .iter()
            .map(|document| document.get_str("_id").unwrap().to_string())
            .collect()
    };
    let report = migrate(&fixture, dump.path(), &db).await;
    let rendered = report.render();
    assert!(report.verified, "{rendered}");
    for name in [
        "users in dump order",
        "meetings in dump order",
        "documents in dump order",
    ] {
        let invariant = report
            .invariants
            .iter()
            .find(|invariant| invariant.name == name)
            .unwrap();
        assert!(invariant.expected > 0, "{name}");
        assert_eq!(invariant.actual, invariant.expected, "{name}");
    }
    let pool = PgPoolOptions::new().connect(&db.url).await.unwrap();
    for collection in ["users", "meetings", "documents"] {
        let stored: Vec<String> = sqlx::query_scalar(sqlx::AssertSqlSafe(format!(
            "SELECT _id FROM {collection} ORDER BY seq"
        )))
        .fetch_all(&pool)
        .await
        .unwrap();
        assert_eq!(stored, order(&fixture, collection), "{collection}");
    }

    // As MongoDB answered: equal start times newest first, equal member values oldest first.
    let server = DB::new(pool.clone());
    let (meetings, _) = server
        .get_meetings(backend::types::MeetingTypeQuery::Active, None, true, None)
        .await
        .unwrap();
    let active: Vec<String> = fixture.collections["meetings"]
        .iter()
        .filter(|meeting| meeting.get_str("status").ok() == Some("Active"))
        .map(|meeting| meeting.get_str("_id").unwrap().to_string())
        .rev()
        .collect();
    assert!(active.len() > 1);
    let listed: Vec<String> = meetings.into_iter().map(|meeting| meeting._id).collect();
    assert_eq!(listed, active);
    let members: Vec<String> = fixture.collections["users"]
        .iter()
        .filter(|user| matches!(user.get("member"), Some(Bson::Document(_))))
        .map(|user| user.get_str("_id").unwrap().to_string())
        .collect();
    for order in ["asc", "desc"] {
        let (users, _) = server
            .get_users(None, 0, None, None, Some(order.to_string()))
            .await
            .unwrap();
        let listed: Vec<String> = users.into_iter().map(|user| user.id).collect();
        assert_eq!(listed, members, "{order}: every member starts at T0");
    }

    // The next row of each table comes after the migrated ones.
    for collection in ["users", "meetings", "documents"] {
        let next: i64 = sqlx::query_scalar(sqlx::AssertSqlSafe(format!(
            "SELECT nextval(pg_get_serial_sequence('{collection}', 'seq'))"
        )))
        .fetch_one(&pool)
        .await
        .unwrap();
        assert_eq!(
            next,
            fixture.collections[collection].len() as i64 + 1,
            "{collection}"
        );
    }
    pool.close().await;

    // Idempotent, order included.
    let again = migrate(&fixture, dump.path(), &db).await;
    assert!(again.verified, "{}", again.render());
    assert_eq!(again.collections["meetings"].unchanged, 4);
    db.drop().await;
}

#[tokio::test]
async fn a_group_named_twice_and_a_text_with_nul_migrate_as_the_server_stores_them() {
    let Some(db) = TestDb::new().await else {
        return;
    };
    let dump = tempfile::tempdir().unwrap();
    let mut fixture = Fixture::shaped();
    let text = "# Satzung\n\nA\u{0}B";
    let group = id("grp1", 10);
    let document = fixture.doc("documents", 0);
    document.insert("group_ids", vec![group.clone(), group.clone()]);
    document.insert("content", text);
    document.insert("state", state_of(text));
    fixture
        .doc("document_versions", 0)
        .insert("content", "Alt\u{0}");
    let report = migrate(&fixture, dump.path(), &db).await;
    let rendered = report.render();
    assert!(report.verified, "{rendered}");
    assert_eq!(report.rules.get("documents.content nul_dropped"), Some(&1));
    assert_eq!(
        report.rules.get("document_versions.content nul_dropped"),
        Some(&1)
    );
    assert_eq!(
        report
            .rules
            .get("documents.state text_differs_from_content"),
        None,
        "the state holds the same text, U+0000 included"
    );

    let pool = PgPoolOptions::new().connect(&db.url).await.unwrap();
    let server = DB::new(pool.clone());
    let stored = server.get_document(&id("doc1", 10)).await.unwrap().unwrap();
    assert_eq!(stored.group_ids, vec![group.clone(), group]);
    assert_eq!(stored.content, "# Satzung\n\nAB");
    let state: Vec<u8> = sqlx::query_scalar("SELECT state FROM documents WHERE _id = $1")
        .bind(id("doc1", 10))
        .fetch_one(&pool)
        .await
        .unwrap();
    assert_eq!(
        backend::document_rooms::text_of_state(&state).unwrap(),
        text,
        "byte for byte"
    );
    let versions = server.get_document_versions(&id("doc1", 10)).await.unwrap();
    assert!(versions.iter().any(|version| version.content == "Alt"));
    pool.close().await;
    db.drop().await;
}

/// Verification reads a document's groups in their order however the rows are stored: a
/// membership row written again, as by a re-run's upsert, is stored after the others.
#[tokio::test]
async fn verification_reads_a_documents_groups_in_their_order() {
    let Some(db) = TestDb::new().await else {
        return;
    };
    let dump = tempfile::tempdir().unwrap();
    let mut fixture = Fixture::shaped();
    let (first, second) = (id("grp2", 10), id("grp1", 10));
    let name_key = backend::document_rules::sort_key("Vorstand");
    fixture.push(
        "document_groups",
        doc! {"_id": &first, "name": "Vorstand", "name_key": name_key,
        "document_order": [id("doc1", 10)]},
    );
    fixture
        .doc("document_group_order", 0)
        .insert("group_ids", vec![second.clone(), first.clone()]);
    fixture
        .doc("documents", 0)
        .insert("group_ids", vec![first.clone(), second.clone()]);
    let report = migrate(&fixture, dump.path(), &db).await;
    assert!(report.verified, "{}", report.render());
    execute(
        &db,
        &format!(
            "UPDATE document_group_members SET group_id = group_id \
             WHERE document_id = '{}' AND group_id = '{first}'",
            id("doc1", 10)
        ),
    )
    .await;
    let stored: String = scalar(
        &db,
        "SELECT string_agg(group_id, ' ' ORDER BY ctid) FROM document_group_members",
    )
    .await;
    assert_eq!(stored, format!("{second} {first}"), "as stored");
    execute(&db, "ANALYZE").await;
    let report = verify(&fixture, dump.path(), &db).await;
    assert!(report.verified, "{}", report.render());
    db.drop().await;
}

/// Verification compares what the server serves with the raw rows whatever order the rows are
/// stored in: versions of one document saved in the same millisecond, which the server serves
/// by `_id`, the greater first, and groups stored in neither the order of their ids nor its
/// reverse, which the server serves as stored.
#[tokio::test]
async fn verification_compares_tied_versions_and_groups_stored_out_of_id_order() {
    let Some(db) = TestDb::new().await else {
        return;
    };
    let dump = tempfile::tempdir().unwrap();
    let mut fixture = Fixture::shaped();
    let document = id("doc1", 10);
    // Two pairs saved in one millisecond each: one stored in the order of its ids, one in the
    // reverse.
    for (version, saved_at) in [
        ("ver3", T0 + 20),
        ("ver4", T0 + 20),
        ("ver6", T0 + 21),
        ("ver5", T0 + 21),
    ] {
        fixture.push(
            "document_versions",
            doc! {"_id": id(version, 12), "document_id": &document,
            "content": format!("# Satzung\n\n{version}"), "editors": [id("u16-", 16)],
            "saved_at": saved_at},
        );
    }
    // After grp1 of the shaped dump.
    for (group, name) in [("grp3", "Orga"), ("grp2", "Vorstand")] {
        fixture.push(
            "document_groups",
            doc! {"_id": id(group, 10), "name": name,
            "name_key": backend::document_rules::sort_key(name), "document_order": []},
        );
    }
    fixture.doc("document_group_order", 0).insert(
        "group_ids",
        vec![id("grp2", 10), id("grp1", 10), id("grp3", 10)],
    );
    let report = migrate(&fixture, dump.path(), &db).await;
    assert!(report.verified, "{}", report.render());

    let versions: String = scalar(
        &db,
        "SELECT string_agg(left(_id, 4), ' ' ORDER BY ctid) FROM document_versions",
    )
    .await;
    assert_eq!(versions, "ver1 ver2 ver3 ver4 ver6 ver5", "as stored");
    let groups: String = scalar(
        &db,
        "SELECT string_agg(left(_id, 4), ' ' ORDER BY ctid) FROM document_groups",
    )
    .await;
    assert_eq!(groups, "grp1 grp3 grp2", "as stored");
    let pool = PgPoolOptions::new().connect(&db.url).await.unwrap();
    let server = DB::new(pool.clone());
    let served: Vec<String> = server
        .get_document_versions(&document)
        .await
        .unwrap()
        .into_iter()
        .map(|version| version._id[..4].to_string())
        .collect();
    assert_eq!(served, ["ver6", "ver5", "ver4", "ver3", "ver2", "ver1"]);
    let (served_groups, _, _) = server.get_document_list().await.unwrap();
    let served_groups: Vec<String> = served_groups
        .into_iter()
        .map(|group| group._id[..4].to_string())
        .collect();
    assert_eq!(served_groups, ["grp1", "grp3", "grp2"], "as stored");
    pool.close().await;

    let report = verify(&fixture, dump.path(), &db).await;
    assert!(report.verified, "{}", report.render());
    db.drop().await;
}

/// A document with more versions than the server serves (`MAX_DOCUMENT_VERSIONS`, 50), with a
/// tie across the cut: the old server's prune deletes only versions saved before the oldest one
/// it keeps, so versions saved in the same millisecond as that one all stay, and production can
/// hold such a document. Verification compares exactly the newest 50, tie included, with what
/// `get_document_versions` serves; comparing one more, one fewer or all of them fails.
#[tokio::test]
async fn verification_compares_the_newest_fifty_versions_with_a_tie_at_the_cut() {
    let Some(db) = TestDb::new().await else {
        return;
    };
    let dump = tempfile::tempdir().unwrap();
    let mut fixture = Fixture::shaped();
    let document = id("doc1", 10);
    // 53 versions after the shaped dump's two, saved in pairs of one millisecond each:
    // ver0000/ver0001 first, ver0052 alone last. Newest first, the 50th is ver0003 and the
    // 51st ver0002, saved in the same millisecond.
    for i in 0..53_i64 {
        fixture.push(
            "document_versions",
            doc! {"_id": id(&format!("ver{i:04}"), 12), "document_id": &document,
            "content": format!("# Satzung\n\n{i}"), "editors": [id("u16-", 16)],
            "saved_at": T0 + 100 + i / 2},
        );
    }
    let report = migrate(&fixture, dump.path(), &db).await;
    assert!(report.verified, "{}", report.render());

    let stored: i64 = scalar(
        &db,
        &format!("SELECT count(*) FROM document_versions WHERE document_id = '{document}'"),
    )
    .await;
    assert_eq!(stored, 55);
    let pool = PgPoolOptions::new().connect(&db.url).await.unwrap();
    let served: Vec<String> = DB::new(pool.clone())
        .get_document_versions(&document)
        .await
        .unwrap()
        .into_iter()
        .map(|version| version._id[..7].to_string())
        .collect();
    pool.close().await;
    let newest: Vec<String> = (3..53).rev().map(|i| format!("ver{i:04}")).collect();
    assert_eq!(served, newest);

    let report = verify(&fixture, dump.path(), &db).await;
    assert!(report.verified, "{}", report.render());
    db.drop().await;
}

/// `originalUsers` and `users.extra` are relaxed Extended JSON: every integer keeps its exact
/// value, only Int32 and Int64 look the same. Nothing in the server reads either.
#[tokio::test]
async fn archived_integers_keep_their_exact_values() {
    let Some(db) = TestDb::new().await else {
        return;
    };
    let dump = tempfile::tempdir().unwrap();
    let mut fixture = Fixture::shaped();
    let big = 9_007_199_254_740_993_i64; // 2^53 + 1, not a double
    fixture.doc("originalUsers", 0).insert("big", big);
    fixture.doc("originalUsers", 0).insert("small", 7_i32);
    fixture.doc("originalUsers", 0).insert("fraction", 2.5_f64);
    fixture.doc("users", 0).insert("imported_count", big);
    let report = migrate(&fixture, dump.path(), &db).await;
    assert!(report.verified, "{}", report.render());

    let pool = PgPoolOptions::new().connect(&db.url).await.unwrap();
    let (big_text, small_text, fraction_text): (String, String, String) = sqlx::query_as(
        r#"
        SELECT snapshot->>'big', snapshot->>'small', snapshot->>'fraction'
        FROM original_users WHERE user_id = $1
        "#,
    )
    .bind(id("u16-", 16))
    .fetch_one(&pool)
    .await
    .unwrap();
    assert_eq!(big_text, big.to_string());
    assert_eq!(small_text, "7");
    assert_eq!(fraction_text, "2.5");
    let extra: String =
        sqlx::query_scalar("SELECT extra->>'imported_count' FROM users WHERE _id = $1")
            .bind(id("u16-", 16))
            .fetch_one(&pool)
            .await
            .unwrap();
    assert_eq!(extra, big.to_string());
    pool.close().await;
    db.drop().await;
}

/// A later migration of the kinds the auth half plans (research-auth §3.3), each needing the
/// owner of what it changes.
const LATER_MIGRATION: &str = r#"
ALTER TABLE users ADD COLUMN probe int;
ALTER TYPE user_capability ADD VALUE 'Probe';
ALTER TABLE meetings ADD COLUMN probe integer;
CREATE INDEX users_probe ON users (probe);
CREATE TABLE probe_sessions (
    _id     text PRIMARY KEY,
    user_id text COLLATE "C" NOT NULL REFERENCES users (_id)
);
ALTER TABLE places ADD CONSTRAINT places_probe CHECK (lat >= -90);
"#;

/// On turing the migrator and the server connect as `qa_app`, a plain login role with the
/// rights of `deployment/templates/config/pg-init.sql`; every other test here runs as the
/// superuser of `TEST_DATABASE_URL` (SECURITY-1). The cutover, a server start and a later
/// migration must work with those rights alone: the role creates every object of the
/// schema, so it owns them and can change them.
#[tokio::test]
async fn the_app_role_of_pg_init_migrates_serves_and_can_change_its_schema() {
    let Some(db) = TestDb::new().await else {
        return;
    };
    let role = db.app_role().await;
    {
        let mut connection = PgConnection::connect(&role.url).await.unwrap();
        let user: String = sqlx::query_scalar("SELECT current_user::text")
            .fetch_one(&mut connection)
            .await
            .unwrap();
        assert_eq!(user, role.name, "the URL logs in as the role");
        connection.close().await.unwrap();
    }

    // The cutover: the binary as the migrator container runs it, then a second run.
    let dump = tempfile::tempdir().unwrap();
    let fixture = Fixture::shaped();
    fixture.write(dump.path(), DATABASE);
    let config_path = dump.path().join("migrate.yml");
    write_config(&fixture.config(dump.path()), &config_path);
    let (code, out, err) = run_binary(
        &["migrate", "--config", config_path.to_str().unwrap()],
        &role.url,
    );
    assert_eq!(code, 0, "{out}{err}");
    let verified = out.lines().last().unwrap_or_default();
    assert!(
        verified.starts_with("MIGRATION VERIFIED users=5 "),
        "{out}{err}"
    );
    let second = run(&fixture.config(dump.path()), &role.url, Mode::Migrate)
        .await
        .unwrap();
    let rendered = second.render();
    assert!(second.verified, "{rendered}");
    for (collection, expected) in fixture.counts() {
        if collection == "email_drafts" {
            continue;
        }
        let counts = &second.collections[collection.as_str()];
        assert_eq!(counts.inserted, 0, "{collection}");
        assert_eq!(counts.updated, 0, "{collection}");
        assert_eq!(counts.unchanged, expected, "{collection}");
    }
    assert_eq!(
        rendered.lines().last(),
        Some(verified),
        "the same counts and digest"
    );

    // What deployment/pg-owner-check.sql checks on turing: the role owns everything in
    // schema public, the bookkeeping of sqlx and of the migrator included.
    let not_owned: i64 = scalar(
        &db,
        &format!(
            "SELECT (SELECT count(*) FROM pg_class
                     WHERE relnamespace = 'public'::regnamespace AND relowner <> '{0}'::regrole)
                  + (SELECT count(*) FROM pg_type
                     WHERE typnamespace = 'public'::regnamespace AND typowner <> '{0}'::regrole)
                  + (SELECT count(*) FROM pg_proc
                     WHERE pronamespace = 'public'::regnamespace AND proowner <> '{0}'::regrole)",
            role.name
        ),
    )
    .await;
    assert_eq!(not_owned, 0);
    let owners: Vec<String> = {
        let mut connection = db.connect().await;
        sqlx::query_scalar(
            "SELECT pg_get_userbyid(relowner)::text FROM pg_class
             WHERE oid IN ('public.users'::regclass, 'public._sqlx_migrations'::regclass,
                           'public.migration_hashes'::regclass)",
        )
        .fetch_all(&mut connection)
        .await
        .unwrap()
    };
    assert_eq!(owners, vec![role.name.clone(); 3]);

    // A server start as the role (main.rs: DB::connect, DB::migrate), one read, one write.
    let server = DB::connect(&role.url).await.unwrap();
    server.migrate().await.unwrap();
    let meeting = server.get_meeting("m0001").await.unwrap().unwrap();
    assert_eq!(meeting.title, "Stammtisch");
    let new_user = id("new-", 30);
    server.create_user(&new_user).await.unwrap();
    let created = server.get_user(&new_user).await.unwrap().unwrap();
    assert_eq!(created.capabilities, Some(vec![]));
    let seq: i64 = sqlx::query_scalar("SELECT seq FROM users WHERE _id = $1")
        .bind(&new_user)
        .fetch_one(&server.pool)
        .await
        .unwrap();
    assert_eq!(
        seq,
        fixture.collections["users"].len() as i64 + 1,
        "after the migrated rows"
    );
    server.pool.close().await;

    // The next start with a later migration, applied as sqlx applies it.
    let mut migrations: Vec<Migration> = MIGRATOR.iter().cloned().collect();
    let version = migrations.last().unwrap().version + 1;
    migrations.push(Migration::new(
        version,
        "later".into(),
        MigrationType::Simple,
        LATER_MIGRATION.into_sql_str(),
        false,
    ));
    let pool = PgPoolOptions::new().connect(&role.url).await.unwrap();
    Migrator::with_migrations(migrations)
        .run(&pool)
        .await
        .unwrap_or_else(|e| panic!("the role cannot apply a later migration: {e}"));
    let capability: String = sqlx::query_scalar("SELECT 'Probe'::user_capability::text")
        .fetch_one(&pool)
        .await
        .unwrap();
    assert_eq!(capability, "Probe");
    let updated = sqlx::query("UPDATE users SET probe = 1 WHERE _id = $1")
        .bind(&new_user)
        .execute(&pool)
        .await
        .unwrap();
    assert_eq!(updated.rows_affected(), 1);
    pool.close().await;

    db.drop().await;
}

/// The stored forms of main `e88d53d`'s `db.rs` that `backend::types` no longer has, as they
/// were: the Mongo server read these collections with them.
#[derive(Debug, serde::Deserialize)]
struct PlaceDocument {
    _id: String,
    name: String,
    name_key: String,
    lat: f64,
    lon: f64,
    created: Option<PlaceCreated>,
}

#[derive(Debug, serde::Deserialize)]
struct PlaceCreated {
    by: String,
    at: i64,
}

#[derive(Debug, serde::Deserialize)]
struct StoredDocument {
    _id: String,
    title: String,
    content: String,
    state: bson::Binary,
    state_version: i64,
    group_ids: Vec<String>,
    created_by: String,
    created_at: i64,
    updated_at: i64,
    deleted_by: Option<String>,
    deleted_at: Option<i64>,
}

#[derive(Debug, serde::Deserialize)]
struct GroupDocument {
    _id: String,
    name: String,
    name_key: String,
    document_order: Vec<String>,
}

#[derive(Debug, serde::Deserialize)]
struct GroupOrderDocument {
    _id: String,
    group_ids: Vec<String>,
}

/// A dump document as the Mongo server's driver handed it over: serde over BSON.
fn as_mongo_read<T: serde::de::DeserializeOwned>(raw: &bson::Document) -> T {
    bson::deserialize_from_document(raw.clone()).unwrap()
}

/// An oracle for the field mapping of `convert.rs`, which verification cannot judge: it
/// compares the converted rows with what Postgres reads back, and both carry the same
/// conversion. Every dump document is read as the Mongo server read it (its own types, serde
/// over BSON) and compared with what the Postgres server serves, up to the deviations
/// research-postgres lists (§3.6 item 1: `capabilities` null reads as `[]`; an empty history
/// reads as none; `url_hidden` is never stored). Columns no reader serves (sent mails, the
/// archive, the bookkeeping of documents and places) are compared with the dump directly.
#[tokio::test]
async fn every_migrated_value_is_what_the_mongo_server_read_from_the_dump() {
    let Some(db) = TestDb::new().await else {
        return;
    };
    let dump = tempfile::tempdir().unwrap();
    let mut fixture = Fixture::shaped();
    // Two shapes the types allow that production did not hold on 2026-11-05: a member
    // without a status, and a snapshot from before the switch to milliseconds.
    fixture
        .doc("users", 1)
        .get_document_mut("member")
        .unwrap()
        .insert("status", Bson::Null);
    let member = fixture
        .doc("originalUsers", 0)
        .get_document_mut("member")
        .unwrap();
    let milliseconds = member.get_i64("start_time_ms").unwrap();
    member.remove("start_time_ms");
    member.insert("start_time_secs", milliseconds / 1000);
    // Every list of the dump with at least two entries somewhere, so a mapping that
    // reorders one shows.
    fixture
        .doc("meetings", 0)
        .get_document_mut("tags")
        .unwrap()
        .insert("common", vec!["Party", "Kultur"]);
    let log = fixture.doc("sent_email_logs", 0);
    log.insert("attachment_names", vec!["a.pdf", "b.pdf"]);
    log.insert("failed_emails", vec!["dee@example.org", "eve@example.org"]);
    log.insert("successful_count", 3_i64);
    log.insert("failed_count", 2_i64);
    let (first, second) = (id("grp2", 10), id("grp1", 10));
    fixture.push(
        "document_groups",
        doc! {"_id": &first, "name": "Vorstand",
        "name_key": backend::document_rules::sort_key("Vorstand"),
        "document_order": [id("doc1", 10)]},
    );
    fixture
        .doc("document_group_order", 0)
        .insert("group_ids", vec![first.clone(), second.clone()]);
    fixture
        .doc("documents", 0)
        .insert("group_ids", vec![first, second]);
    let report = migrate(&fixture, dump.path(), &db).await;
    assert!(report.verified, "{}", report.render());
    let pool = PgPoolOptions::new().connect(&db.url).await.unwrap();
    let server = DB::new(pool.clone());
    let raw = |collection: &str| fixture.collections[collection].iter();

    for document in raw("meetings") {
        let mut mongo: backend::types::Meeting = as_mongo_read(document);
        if mongo.changed.as_ref().is_some_and(Vec::is_empty) {
            mongo.changed = None;
        }
        if let Some(online) = mongo.online.as_mut() {
            online.url_hidden = false;
        }
        let served = server.get_meeting(&mongo._id).await.unwrap();
        assert_eq!(served.as_ref(), Some(&mongo), "meeting {}", mongo._id);
    }

    for document in raw("users") {
        let mut mongo: backend::types::User = as_mongo_read(document);
        if mongo.capabilities.is_none() {
            mongo.capabilities = Some(vec![]);
        }
        let served = server.get_user(&mongo.id).await.unwrap();
        assert_eq!(served.as_ref(), Some(&mongo), "user {}", mongo.id);
        // What the server does not read stays as the dump held it.
        let mut rest = document.clone();
        for known in ["_id", "member", "capabilities"] {
            rest.remove(known);
        }
        let expected = (!rest.is_empty()).then(|| Bson::Document(rest).into_relaxed_extjson());
        let extra: Option<serde_json::Value> =
            sqlx::query_scalar("SELECT extra FROM users WHERE _id = $1")
                .bind(&mongo.id)
                .fetch_one(&pool)
                .await
                .unwrap();
        assert_eq!(extra, expected, "user {}", mongo.id);
    }

    for document in raw("originalUsers") {
        let user_id = document.get_str("_id").unwrap();
        let member = document.get_document("member").unwrap();
        let expected_at = match member.get("start_time_ms") {
            Some(Bson::Int64(ms)) => *ms,
            None => member.get_i64("start_time_secs").unwrap() * 1000,
            other => panic!("the fixture holds {other:?}"),
        };
        let (snapshot, created_at): (serde_json::Value, i64) =
            sqlx::query_as("SELECT snapshot, created_at FROM original_users WHERE user_id = $1")
                .bind(user_id)
                .fetch_one(&pool)
                .await
                .unwrap();
        assert_eq!(created_at, expected_at, "snapshot of {user_id}");
        assert_eq!(
            snapshot,
            Bson::Document(document.clone()).into_relaxed_extjson(),
            "snapshot of {user_id}"
        );
    }

    for document in raw("places") {
        let mongo: PlaceDocument = as_mongo_read(document);
        let served = server.get_place(&mongo._id).await.unwrap().unwrap();
        assert_eq!(
            (&served._id, &served.name, served.lat, served.lon),
            (&mongo._id, &mongo.name, mongo.lat, mongo.lon),
            "place {}",
            mongo._id
        );
        let stored: (String, Option<String>, Option<i64>) =
            sqlx::query_as("SELECT name_key, created_by, created_at FROM places WHERE _id = $1")
                .bind(&mongo._id)
                .fetch_one(&pool)
                .await
                .unwrap();
        let created = mongo.created.map(|c| (c.by, c.at)).unzip();
        assert_eq!(
            stored,
            (mongo.name_key, created.0, created.1),
            "place {}",
            mongo._id
        );
    }

    let mut version_documents = Vec::new();
    for document in raw("documents") {
        let mongo: StoredDocument = as_mongo_read(document);
        type Stored = (String, String, Vec<u8>, i64, Vec<String>, String, i64, i64);
        let stored: Stored = sqlx::query_as(
            r#"
            SELECT title, content, state, state_version,
                COALESCE((SELECT array_agg(m.group_id ORDER BY m.position)
                          FROM document_group_members m WHERE m.document_id = d._id), '{}'),
                created_by, created_at, updated_at
            FROM documents d WHERE _id = $1
            "#,
        )
        .bind(&mongo._id)
        .fetch_one(&pool)
        .await
        .unwrap();
        assert_eq!(
            stored,
            (
                mongo.title.clone(),
                mongo.content.clone(),
                mongo.state.bytes,
                mongo.state_version,
                mongo.group_ids.clone(),
                mongo.created_by,
                mongo.created_at,
                mongo.updated_at,
            ),
            "document {}",
            mongo._id
        );
        let deleted: (Option<String>, Option<i64>) =
            sqlx::query_as("SELECT deleted_by, deleted_at FROM documents WHERE _id = $1")
                .bind(&mongo._id)
                .fetch_one(&pool)
                .await
                .unwrap();
        assert_eq!(deleted, (mongo.deleted_by, mongo.deleted_at));
        let served = server.get_document(&mongo._id).await.unwrap();
        let live = mongo.deleted_at.is_none().then(|| WikiDocument {
            _id: mongo._id.clone(),
            title: mongo.title,
            content: mongo.content,
            group_ids: mongo.group_ids,
            editing: false,
        });
        assert_eq!(served, live, "document {}", mongo._id);
        version_documents.push(mongo._id);
    }

    let (groups, order, _) = server.get_document_list().await.unwrap();
    let mongo_groups: Vec<GroupDocument> = raw("document_groups").map(as_mongo_read).collect();
    assert_eq!(groups.len(), mongo_groups.len());
    for mongo in mongo_groups {
        let served = groups.iter().find(|g| g._id == mongo._id).unwrap();
        assert_eq!(
            (&served.name, &served.document_order),
            (&mongo.name, &mongo.document_order),
            "group {}",
            mongo._id
        );
        let name_key: String =
            sqlx::query_scalar("SELECT name_key FROM document_groups WHERE _id = $1")
                .bind(&mongo._id)
                .fetch_one(&pool)
                .await
                .unwrap();
        assert_eq!(name_key, mongo.name_key, "group {}", mongo._id);
    }
    let mongo_order: Vec<GroupOrderDocument> =
        raw("document_group_order").map(as_mongo_read).collect();
    assert_eq!(mongo_order.len(), 1);
    assert_eq!(mongo_order[0]._id, "main");
    assert_eq!(order, mongo_order[0].group_ids);

    // The Mongo server read versions straight into `WikiDocumentVersion`, newest first,
    // the newest 50 (`MAX_DOCUMENT_VERSIONS`).
    for document_id in version_documents {
        let mut mongo: Vec<WikiDocumentVersion> = raw("document_versions")
            .filter(|v| v.get_str("document_id").unwrap() == document_id)
            .map(as_mongo_read)
            .collect();
        mongo.sort_by(|a, b| (b.saved_at, &b._id).cmp(&(a.saved_at, &a._id)));
        mongo.truncate(50);
        let served = server.get_document_versions(&document_id).await.unwrap();
        assert_eq!(served, mongo, "versions of {document_id}");
    }

    // Written by the server, read by nothing: every field as the server wrote it.
    for document in raw("sent_email_logs") {
        let mongo: SentEmailLog = as_mongo_read(document);
        let stored: serde_json::Value =
            sqlx::query_scalar("SELECT to_jsonb(l) FROM sent_email_logs l WHERE _id = $1")
                .bind(&mongo._id)
                .fetch_one(&pool)
                .await
                .unwrap();
        assert_eq!(
            stored,
            serde_json::to_value(&mongo).unwrap(),
            "{}",
            mongo._id
        );
    }

    pool.close().await;
    db.drop().await;
}
