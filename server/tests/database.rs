//! Tests against a real Postgres, for what the database decides: error kinds, returned rows,
//! rollbacks. `TEST_DATABASE_URL` names the server, and each test has a schema of its own
//! there (`db_support`); CI always sets it (a `postgres` service). The behaviour of every `DB`
//! method is pinned in `db_behaviour.rs`; these are the driver-level checks.

#![forbid(unsafe_code)]

use backend::db::{CreateMeetingsError, GroupNameError, PgDocumentStore, DB};
use backend::document_rooms::{
    text_of_state, DocumentStore, NewVersion, Outbound, Rooms, SaveOutcome, SavedState, TEXT_ROOT,
};
use backend::document_rules::arrange_documents;
use backend::interossea::Auth;
use backend::types::{DraftStatus, EmailDraft, GetDocumentsResponseBody, Meeting};
use futures_util::TryStreamExt;
use sqlx::postgres::{PgConnectOptions, PgConnection};
use sqlx::{AssertSqlSafe, Connection};
use std::net::SocketAddr;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::{Duration, Instant};
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::{TcpListener, TcpStream};
use yrs::sync::{Message, SyncMessage};
use yrs::updates::decoder::Decode;
use yrs::updates::encoder::Encode;
use yrs::{Doc, ReadTxn, Text, Transact, Update};

mod db_support;
mod drop_guard;
use db_support::TestSchema;

/// Long enough for a slow runner; conditions are polled, so normally nothing waits this long.
const DEADLINE: Duration = Duration::from_secs(20);

/// A schema of its own (`db_support`), as tests run in parallel. `None` without a server,
/// outside CI.
struct TestDb {
    db: Arc<DB>,
    schema: TestSchema,
}

impl TestDb {
    async fn new() -> Option<Self> {
        let schema = TestSchema::new().await?;
        let db = schema.migrated(4).await;
        Some(Self {
            db: Arc::new(db),
            schema,
        })
    }

    fn options(&self) -> PgConnectOptions {
        self.schema.options()
    }

    /// A connection of its own, outside the pool, for the other side of a race.
    async fn connection(&self) -> PgConnection {
        self.schema.connection().await
    }

    /// Waits until `count` sessions of this test wait for a lock.
    async fn lock_waiters(&self, count: i64) {
        let started = Instant::now();
        loop {
            let waiting: i64 = sqlx::query_scalar(
                "SELECT count(*) FROM pg_stat_activity \
                 WHERE application_name = $1 AND wait_event_type = 'Lock'",
            )
            .bind(&self.schema.name)
            .fetch_one(&self.db.pool)
            .await
            .unwrap();
            if waiting >= count {
                return;
            }
            assert!(
                started.elapsed() < DEADLINE,
                "still waiting for {count} lock waiters, {waiting} so far"
            );
            tokio::time::sleep(Duration::from_millis(20)).await;
        }
    }

    async fn drop(self) {
        self.db.pool.close().await;
        drop(self.db);
        self.schema.drop().await;
    }
}

fn meeting(title: &str) -> Meeting {
    serde_json::from_value(serde_json::json!({
        "_id": "", "title": title, "authority": "", "age_restriction": [0],
        "time": 1_793_124_000_000_i64, "location": null,
        "description": "", "price": [0.0], "trigger_warning": null, "attendance": null,
        "rating": null, "accessibility": null,
        "tags": {"freeform": [], "common": [], "queer": []}, "status": "Planned",
        "changed": null, "cancelled": false, "deleted_at": null
    }))
    .unwrap()
}

fn draft(id: &str) -> EmailDraft {
    EmailDraft {
        _id: id.to_string(),
        sender_id: "sender".to_string(),
        sender_email: "sender@example.invalid".to_string(),
        subject: "Betreff".to_string(),
        body: "Text".to_string(),
        attachments: vec![],
        verification_code: "1234".to_string(),
        created_at: 1,
        recipient_count: 1,
        status: DraftStatus::Pending,
        reply_to: None,
    }
}

#[tokio::test]
async fn the_migrations_can_be_run_again_on_every_start() {
    let Some(test) = TestDb::new().await else {
        return;
    };
    test.db.migrate().await.unwrap();
    let applied: i64 = sqlx::query_scalar("SELECT count(*) FROM _sqlx_migrations")
        .fetch_one(&test.db.pool)
        .await
        .unwrap();
    assert_eq!(applied, 1);
    test.drop().await;
}

/// The harness: a test's schema goes with the test, with everything the migration put in it.
#[tokio::test]
async fn a_test_schema_is_removed_at_the_end_of_its_test() {
    let Some(test) = TestDb::new().await else {
        return;
    };
    let name = test.schema.name.clone();
    assert!(db_support::schema_exists(&name).await);
    test.drop().await;
    assert!(
        !db_support::schema_exists(&name).await,
        "schema {name} is left behind"
    );
}

/// A test that returns before `TestSchema::drop`: the schema goes when its value does.
#[tokio::test]
async fn a_test_schema_is_removed_when_its_test_returns_early() {
    let Some(schema) = TestSchema::new().await else {
        return;
    };
    let name = schema.name.clone();
    let db = schema.migrated(2).await;
    db.pool.close().await;
    drop(schema);
    assert!(
        !db_support::schema_exists(&name).await,
        "schema {name} is left behind"
    );
}

/// A test that panics while a task of it holds a lock in its schema, in a transaction that
/// nothing polls once the test unwinds. Run as `#[tokio::test]` runs one, on a runtime of its
/// own, but on a thread of its own, which keeps the panic there.
#[test]
fn a_test_schema_is_removed_when_its_test_panics() {
    const PLANNED: &str = "the planned failure of the inner test";
    let (name_sender, name) = std::sync::mpsc::channel();
    let inner = std::thread::spawn(move || {
        tokio::runtime::Builder::new_current_thread()
            .enable_all()
            .build()
            .unwrap()
            .block_on(async move {
                let Some(test) = TestDb::new().await else {
                    return;
                };
                name_sender.send(test.schema.name.clone()).unwrap();
                let pool = test.db.pool.clone();
                let (held, holding) = tokio::sync::oneshot::channel();
                tokio::spawn(async move {
                    let mut transaction = pool.begin().await.unwrap();
                    sqlx::query("LOCK TABLE users IN ACCESS SHARE MODE")
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
    let Ok(name) = name.try_recv() else {
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
    assert!(
        !runtime.block_on(db_support::schema_exists(&name)),
        "schema {name} is left behind"
    );
    assert_eq!(
        runtime.block_on(db_support::sessions_named(&name)),
        0,
        "sessions of the test are left"
    );
}

fn panic_message(payload: Box<dyn std::any::Any + Send>) -> String {
    payload
        .downcast_ref::<String>()
        .cloned()
        .or_else(|| payload.downcast_ref::<&str>().map(|s| s.to_string()))
        .unwrap_or_default()
}

async fn failing_removal() -> Result<String, sqlx::Error> {
    Err(sqlx::Error::Protocol("the planned removal error".into()))
}

async fn panicking_removal() -> Result<String, sqlx::Error> {
    panic!("the planned panic of the removal")
}

/// The guards' destructor half (`drop_guard`): a removal that fails, or panics, fails a test
/// that has not panicked itself, naming what is left.
#[test]
fn a_failed_removal_fails_a_test_that_did_not_panic() {
    let failed =
        std::panic::catch_unwind(|| drop_guard::remove_after_test("the thing", failing_removal));
    assert_eq!(
        panic_message(failed.expect_err("a failed removal passed")),
        "the thing is left behind: encountered unexpected or invalid data: the planned removal \
         error"
    );
    let panicked =
        std::panic::catch_unwind(|| drop_guard::remove_after_test("the thing", panicking_removal));
    assert_eq!(
        panic_message(panicked.expect_err("a panicking removal passed")),
        "the thing is left behind: the removal panicked"
    );
}

/// Set by the next test for the inner one.
const INNER_TEST: &str = "QA_DROP_GUARD_INNER_TEST";
const INNER_PLANNED: &str = "the planned failure of the inner test";

/// Run only by the next test, in a process of its own: with the guard broken it aborts. It
/// panics, and while it unwinds, a guard whose removal fails is dropped.
#[test]
#[ignore = "the inner test of a_failed_removal_is_printed_while_its_test_panics"]
fn inner_test_whose_guard_fails_while_it_panics() {
    struct Guard;
    impl Drop for Guard {
        fn drop(&mut self) {
            drop_guard::remove_after_test("the thing", failing_removal);
        }
    }
    if std::env::var_os(INNER_TEST).is_none() {
        return;
    }
    let _guard = Guard;
    panic!("{INNER_PLANNED}");
}

/// While a test unwinds, a failed removal is printed: a second panic would abort the binary,
/// with every other test in it.
#[test]
fn a_failed_removal_is_printed_while_its_test_panics() {
    let output = std::process::Command::new(std::env::current_exe().unwrap())
        .args([
            "inner_test_whose_guard_fails_while_it_panics",
            "--exact",
            "--ignored",
            "--nocapture",
            "--test-threads=1",
        ])
        .env(INNER_TEST, "1")
        .output()
        .unwrap();
    let stdout = String::from_utf8_lossy(&output.stdout);
    let stderr = String::from_utf8_lossy(&output.stderr);
    assert_eq!(
        output.status.code(),
        Some(101),
        "the inner test must fail, not abort ({:?}):\n{stdout}\n{stderr}",
        output.status
    );
    assert!(
        stdout.contains("test inner_test_whose_guard_fails_while_it_panics ... FAILED"),
        "{stdout}"
    );
    assert!(stderr.contains(INNER_PLANNED), "{stderr}");
    assert!(
        stderr.contains(
            "the thing is left behind: encountered unexpected or invalid data: the planned \
             removal error"
        ),
        "{stderr}"
    );
}

/// The schema's removal gives up on a lock it cannot get, after its lock wait and with the
/// error, instead of waiting as long as the lock is held. The holder is a session of another
/// name, which the guard does not end; the server ends it after `DEADLINE` in any case.
#[tokio::test]
async fn a_schema_removal_gives_up_on_a_lock_held_outside_its_test() {
    const LOCK_WAIT: Duration = Duration::from_secs(1);
    let Some(mut schema) = TestSchema::new().await else {
        return;
    };
    let name = schema.name.clone();
    let db = schema.migrated(1).await;
    db.pool.close().await;
    schema.set_lock_wait(LOCK_WAIT);
    let mut holder = db_support::login(&db_support::test_server()).await;
    for statement in [
        format!(
            "SET idle_in_transaction_session_timeout = {}",
            DEADLINE.as_millis()
        ),
        "BEGIN".to_string(),
        format!("LOCK TABLE \"{name}\".users IN ACCESS SHARE MODE"),
    ] {
        sqlx::query(AssertSqlSafe(statement))
            .execute(&mut holder)
            .await
            .unwrap();
    }
    let started = Instant::now();
    let failed = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| drop(schema)));
    let waited = started.elapsed();
    let message = panic_message(failed.expect_err("the removal did not give up"));
    assert!(
        message.starts_with(&format!("db_support: schema {name} is left behind: ")),
        "{message}"
    );
    assert!(message.contains("lock timeout"), "{message}");
    assert!(
        waited >= LOCK_WAIT && waited < DEADLINE,
        "gave up after {waited:?}"
    );
    sqlx::query("ROLLBACK").execute(&mut holder).await.unwrap();
    sqlx::query(AssertSqlSafe(format!("DROP SCHEMA \"{name}\" CASCADE")))
        .execute(&mut holder)
        .await
        .unwrap();
    holder.close().await.unwrap();
    assert!(!db_support::schema_exists(&name).await);
}

/// `TestSchema::drop` leaves nothing for `Drop` to do: the guard does not run again, which would
/// end the sessions that carry the schema's name. One of them is still open here, idle.
#[tokio::test]
async fn a_dropped_test_schema_is_not_removed_again_by_its_guard() {
    let Some(schema) = TestSchema::new().await else {
        return;
    };
    let name = schema.name.clone();
    let mut session = schema.connection().await;
    sqlx::query("SELECT 1").execute(&mut session).await.unwrap();
    schema.drop().await;
    assert!(
        !db_support::schema_exists(&name).await,
        "schema {name} is left behind"
    );
    assert_eq!(
        db_support::sessions_named(&name).await,
        1,
        "the guard ran after TestSchema::drop and ended the open session"
    );
    sqlx::query("SELECT 1").execute(&mut session).await.unwrap();
    session.close().await.unwrap();
}

/// A `TestSchema::drop` that fails is repeated by `Drop`, which ends the test's sessions first.
/// Here the explicit removal gives up on a lock that a session of the test still holds.
#[tokio::test]
async fn a_failed_schema_removal_is_repeated_by_its_guard() {
    const LOCK_WAIT: Duration = Duration::from_secs(1);
    let Some(mut schema) = TestSchema::new().await else {
        return;
    };
    let name = schema.name.clone();
    let db = schema.migrated(1).await;
    db.pool.close().await;
    schema.set_lock_wait(LOCK_WAIT);
    // Ended by the server after `DEADLINE` in any case, so a removal that waits for the lock
    // without its lock wait fails this test instead of hanging it.
    let mut session = schema.connection().await;
    for statement in [
        format!(
            "SET idle_in_transaction_session_timeout = {}",
            DEADLINE.as_millis()
        ),
        "BEGIN".to_string(),
        "LOCK TABLE users IN ACCESS SHARE MODE".to_string(),
    ] {
        sqlx::query(AssertSqlSafe(statement))
            .execute(&mut session)
            .await
            .unwrap();
    }
    let failed = tokio::spawn(schema.drop())
        .await
        .expect_err("the lock did not fail TestSchema::drop")
        .into_panic();
    let message = panic_message(failed);
    assert!(message.contains("lock timeout"), "{message}");
    assert!(
        !db_support::schema_exists(&name).await,
        "schema {name} is left behind"
    );
    assert_eq!(db_support::sessions_named(&name).await, 0, "sessions left");
    drop(session);
}

/// Set by the next test for the inner one.
const INNER_REMOVAL_TEST: &str = "QA_SCHEMA_REMOVAL_INNER_TEST";

/// Run only by the next test, in a process of its own, where what its guard prints can be read.
#[tokio::test]
#[ignore = "the inner test of a_schema_removal_that_failed_after_its_drop_is_repeated"]
async fn inner_test_whose_schema_removal_fails_after_its_drop() {
    if std::env::var_os(INNER_REMOVAL_TEST).is_none() {
        return;
    }
    let Some(mut schema) = TestSchema::new().await else {
        return;
    };
    eprintln!("inner schema: {}", schema.name);
    schema.fail_removal_after_its_drop();
    schema.drop().await;
}

/// A `TestSchema::drop` that fails after its `DROP SCHEMA` went through: `Drop`'s repeat of the
/// removal succeeds too, instead of failing on the schema that is gone.
#[test]
fn a_schema_removal_that_failed_after_its_drop_is_repeated() {
    let output = std::process::Command::new(std::env::current_exe().unwrap())
        .args([
            "inner_test_whose_schema_removal_fails_after_its_drop",
            "--exact",
            "--ignored",
            "--nocapture",
            "--test-threads=1",
        ])
        .env(INNER_REMOVAL_TEST, "1")
        .output()
        .unwrap();
    let stdout = String::from_utf8_lossy(&output.stdout);
    let stderr = String::from_utf8_lossy(&output.stderr);
    let Some(name) = stderr
        .lines()
        .find_map(|line| line.strip_prefix("inner schema: "))
    else {
        // Skipped: no server outside CI.
        assert!(output.status.success(), "{stdout}\n{stderr}");
        return;
    };
    assert_eq!(
        output.status.code(),
        Some(101),
        "the inner test must fail ({:?}):\n{stdout}\n{stderr}",
        output.status
    );
    assert!(
        stderr.contains("the planned failure after DROP SCHEMA"),
        "{stderr}"
    );
    assert!(
        stderr.contains(&format!(
            "db_support: removed schema {name} after the test ended without TestSchema::drop"
        )),
        "{stderr}"
    );
    assert!(!stderr.contains("is left behind"), "{stderr}");
    let runtime = tokio::runtime::Builder::new_current_thread()
        .enable_all()
        .build()
        .unwrap();
    assert!(!runtime.block_on(db_support::schema_exists(name)));
}

/// The guard waits until the sessions it ended are gone, also one whose exit takes a while:
/// another session holds a lock on this one's temporary table, so its exit, which drops the
/// table, waits until the holder's `idle_in_transaction_session_timeout` ends the holder.
#[test]
fn a_test_schema_guard_waits_until_the_sessions_it_ended_are_gone() {
    const PLANNED: &str = "the planned failure of the inner test";
    const HOLD: Duration = Duration::from_secs(3);
    let (names_sender, names) = std::sync::mpsc::channel();
    let (go_sender, go) = std::sync::mpsc::channel::<()>();
    let inner = std::thread::spawn(move || {
        tokio::runtime::Builder::new_current_thread()
            .enable_all()
            .build()
            .unwrap()
            .block_on(async move {
                let Some(test) = TestDb::new().await else {
                    return;
                };
                let mut session = test.connection().await;
                sqlx::query("CREATE TEMPORARY TABLE held (x int)")
                    .execute(&mut session)
                    .await
                    .unwrap();
                let temporary: String =
                    sqlx::query_scalar("SELECT pg_my_temp_schema()::regnamespace::text")
                        .fetch_one(&mut session)
                        .await
                        .unwrap();
                names_sender
                    .send((test.schema.name.clone(), temporary))
                    .unwrap();
                // Alive until the runtime goes, after the guard.
                tokio::spawn(async move {
                    std::future::pending::<()>().await;
                    drop(session);
                });
                go.recv().unwrap();
                panic!("{PLANNED}");
            })
    });
    let Ok((name, temporary)) = names.recv() else {
        // Skipped: no server outside CI.
        inner.join().unwrap();
        return;
    };
    let runtime = tokio::runtime::Builder::new_current_thread()
        .enable_all()
        .build()
        .unwrap();
    let holder = runtime.block_on(async {
        let mut holder = db_support::login(&db_support::test_server()).await;
        for statement in [
            format!(
                "SET idle_in_transaction_session_timeout = {}",
                HOLD.as_millis()
            ),
            "BEGIN".to_string(),
            format!("LOCK TABLE {temporary}.held IN ACCESS SHARE MODE"),
        ] {
            sqlx::query(AssertSqlSafe(statement))
                .execute(&mut holder)
                .await
                .unwrap();
        }
        holder
    });
    let started = Instant::now();
    go_sender.send(()).unwrap();
    let payload = inner.join().expect_err("the inner test did not panic");
    let waited = started.elapsed();
    assert_eq!(panic_message(payload), PLANNED);
    assert_eq!(
        runtime.block_on(db_support::sessions_named(&name)),
        0,
        "the guard returned before the sessions it ended were gone"
    );
    assert!(
        waited >= HOLD / 2,
        "the session's exit did not wait for the lock ({waited:?}), so this proves nothing"
    );
    assert!(
        !runtime.block_on(db_support::schema_exists(&name)),
        "schema {name} is left behind"
    );
    // Ended by the server.
    drop(holder);
}

#[tokio::test]
async fn an_email_draft_can_be_claimed_only_once() {
    let Some(test) = TestDb::new().await else {
        return;
    };
    let db = &test.db;
    db.insert_email_draft(&draft("d1")).await.unwrap();

    let claimed = db.claim_email_draft("d1").await.unwrap().unwrap();
    assert_eq!(claimed.status, DraftStatus::Processing);
    assert!(db.claim_email_draft("d1").await.unwrap().is_none());

    db.delete_email_draft("d1").await.unwrap();
    assert!(db.get_email_draft("d1").await.unwrap().is_none());
    test.drop().await;
}

#[tokio::test]
async fn mass_emails_reach_approved_members_only() {
    let Some(test) = TestDb::new().await else {
        return;
    };
    let db = &test.db;
    for (id, status) in [("a", Some("Approved")), ("b", Some("Pending")), ("c", None)] {
        db.create_user(id).await.unwrap();
        if let Some(status) = status {
            sqlx::query(
                r#"
                INSERT INTO members (user_id, member_type, natural_person, address_street,
                    address_number, address_zip, address_city, address_country, email,
                    start_time_ms, status, approved_charter, approved_privacy, above_18, honorary)
                VALUES ($1, 'Active', true, 'S', '1', '86150', 'Augsburg', 'DE', $2, 1,
                    $3::membership_status, true, true, true, false)
                "#,
            )
            .bind(id)
            .bind(format!("{id}@example.invalid"))
            .bind(status)
            .execute(&db.pool)
            .await
            .unwrap();
        }
    }

    assert_eq!(db.count_approved_members().await.unwrap(), 1);
    assert_eq!(
        db.get_approved_member_emails().await.unwrap(),
        vec!["a@example.invalid".to_string()]
    );
    test.drop().await;
}

#[tokio::test]
async fn places_with_the_same_name_race_to_one_place() {
    let Some(test) = TestDb::new().await else {
        return;
    };
    let db = &test.db;
    let (first, second) = tokio::join!(
        db.create_place("Café Neruda".to_string(), 48.0, 10.0, "a"),
        db.create_place("café  neruda".to_string(), 48.0, 10.0, "b"),
    );
    let (first, first_created) = first.unwrap();
    let (second, second_created) = second.unwrap();
    assert_eq!(first._id, second._id);
    assert!(first_created != second_created);
    assert_eq!(db.get_places().await.unwrap().len(), 1);
    test.drop().await;
}

#[tokio::test]
async fn a_batch_of_meetings_gets_distinct_ids() {
    let Some(test) = TestDb::new().await else {
        return;
    };
    let meetings = (0..50).map(|n| meeting(&format!("Treffen {n}"))).collect();
    let created = test.db.create_meetings(meetings, "user").await.unwrap();
    let mut ids: Vec<_> = created.iter().map(|meeting| meeting._id.clone()).collect();
    ids.sort();
    ids.dedup();
    assert_eq!(ids.len(), 50);
    test.drop().await;
}

#[tokio::test]
async fn a_batch_that_fails_halfway_leaves_nothing_behind() {
    let Some(test) = TestDb::new().await else {
        return;
    };
    let db = &test.db;
    sqlx::query("ALTER TABLE meetings ADD CONSTRAINT kaputt CHECK (title <> 'kaputt')")
        .execute(&db.pool)
        .await
        .unwrap();

    let batch = vec![meeting("gut"), meeting("kaputt"), meeting("auch gut")];
    let error = db.create_meetings(batch, "user").await.unwrap_err();
    assert!(
        matches!(error, CreateMeetingsError::RolledBack(_)),
        "{error}"
    );

    let stored: i64 = sqlx::query_scalar("SELECT count(*) FROM meetings")
        .fetch_one(&db.pool)
        .await
        .unwrap();
    assert_eq!(stored, 0);
    let changes: i64 = sqlx::query_scalar("SELECT count(*) FROM meeting_changes")
        .fetch_one(&db.pool)
        .await
        .unwrap();
    assert_eq!(changes, 0);
    test.drop().await;
}

async fn listed(db: &DB) -> GetDocumentsResponseBody {
    let (groups, group_order, documents) = db.get_document_list().await.unwrap();
    arrange_documents(groups, &group_order, documents)
}

#[tokio::test]
async fn a_new_document_stores_its_text_as_state_and_keeps_it_out_of_reads() {
    let Some(test) = TestDb::new().await else {
        return;
    };
    let db = &test.db;
    let text = "# Größe\n\nÄnderung 🏳️‍🌈";
    let created = db.create_document(text, vec![], "user").await.unwrap();
    assert_eq!(created.title, "Größe");

    let read = db.get_document(&created._id).await.unwrap().unwrap();
    assert_eq!(read, created);

    let state: Vec<u8> = sqlx::query_scalar("SELECT state FROM documents WHERE _id = $1")
        .bind(&created._id)
        .fetch_one(&db.pool)
        .await
        .unwrap();
    assert_eq!(text_of_state(&state).unwrap(), text);
    test.drop().await;
}

#[tokio::test]
async fn deleted_documents_disappear_from_lists_reads_and_search() {
    let Some(test) = TestDb::new().await else {
        return;
    };
    let db = &test.db;
    let document = db.create_document("# Weg", vec![], "user").await.unwrap();
    assert!(db.delete_document(&document._id, "user").await.unwrap());
    assert!(!db.delete_document(&document._id, "user").await.unwrap());

    assert!(listed(db).await.documents.is_empty());
    assert!(db.get_document(&document._id).await.unwrap().is_none());
    let mut search = db.searchable_documents().await.unwrap();
    assert!(search.try_next().await.unwrap().is_none());
    drop(search);
    assert!(!db.set_document_groups(&document._id, &[]).await.unwrap());
    test.drop().await;
}

#[tokio::test]
async fn group_names_are_unique_ignoring_case_and_accents() {
    let Some(test) = TestDb::new().await else {
        return;
    };
    let db = &test.db;
    db.create_document_group("Vorstand").await.unwrap();
    let error = db.create_document_group("vorständ").await.unwrap_err();
    assert!(matches!(error, GroupNameError::Taken));

    db.create_document_group("Orga").await.unwrap();
    let orga = listed(db).await.groups.remove(0)._id;
    let error = db
        .rename_document_group(&orga, "VORSTAND")
        .await
        .unwrap_err();
    assert!(matches!(error, GroupNameError::Taken));
    assert!(db.rename_document_group(&orga, "Team").await.unwrap());
    test.drop().await;
}

#[tokio::test]
async fn orders_survive_and_a_deleted_group_leaves_its_documents() {
    let Some(test) = TestDb::new().await else {
        return;
    };
    let db = &test.db;
    db.create_document_group("Alpha").await.unwrap();
    db.create_document_group("Beta").await.unwrap();
    let groups = listed(db).await.groups;
    let (alpha, beta) = (groups[0]._id.clone(), groups[1]._id.clone());

    let first = db
        .create_document("# A", vec![alpha.clone()], "u")
        .await
        .unwrap();
    let second = db
        .create_document("# B", vec![alpha.clone(), beta.clone()], "u")
        .await
        .unwrap();

    db.set_document_group_order(&[beta.clone(), alpha.clone()])
        .await
        .unwrap();
    assert!(db
        .set_group_document_order(&alpha, &[second._id.clone(), first._id.clone()])
        .await
        .unwrap());

    let body = listed(db).await;
    assert_eq!(body.groups[0]._id, beta);
    assert_eq!(
        body.groups[1].document_ids,
        vec![second._id.clone(), first._id.clone()]
    );

    assert!(db.delete_document_group(&alpha).await.unwrap());
    let body = listed(db).await;
    assert_eq!(body.groups.len(), 1);
    assert_eq!(body.groups[0].document_ids, vec![second._id.clone()]);
    assert_eq!(body.ungrouped_ids, vec![first._id.clone()]);
    assert!(!db.delete_document_group(&alpha).await.unwrap());
    // The memberships went with the group (cascade), the documents stayed.
    let memberships: i64 = sqlx::query_scalar("SELECT count(*) FROM document_group_members")
        .fetch_one(&db.pool)
        .await
        .unwrap();
    assert_eq!(memberships, 1);
    test.drop().await;
}

#[tokio::test]
async fn a_room_saves_into_the_database_with_its_derived_fields() {
    let Some(test) = TestDb::new().await else {
        return;
    };
    let db = test.db.clone();
    let store = PgDocumentStore(db.clone());
    let document = db.create_document("# Alt\n", vec![], "u").await.unwrap();

    let loaded = store
        .load_state(document._id.clone())
        .await
        .unwrap()
        .unwrap();
    assert_eq!(loaded.state_version, 1);
    assert_eq!(text_of_state(&loaded.state).unwrap(), "# Alt\n");

    let saved = SavedState {
        state: loaded.state.clone(),
        content: "# Neu\n".to_string(),
        title: "Neu".to_string(),
        state_version: 1,
    };
    let outcome = store
        .save_state(document._id.clone(), saved.clone())
        .await
        .unwrap();
    assert_eq!(outcome, SaveOutcome::Saved { state_version: 2 });
    let read = db.get_document(&document._id).await.unwrap().unwrap();
    assert_eq!(read.title, "Neu");

    // The same version again means a second writer, a deleted document the end of the room.
    let outcome = store
        .save_state(document._id.clone(), saved.clone())
        .await
        .unwrap();
    assert_eq!(outcome, SaveOutcome::Gone);
    db.delete_document(&document._id, "u").await.unwrap();
    let late = SavedState {
        state_version: 2,
        ..saved
    };
    assert_eq!(
        store.save_state(document._id.clone(), late).await.unwrap(),
        SaveOutcome::Gone
    );
    assert!(store
        .load_state(document._id.clone())
        .await
        .unwrap()
        .is_none());
    drop(store);
    drop(db);
    test.drop().await;
}

#[tokio::test]
async fn versions_skip_repeats_are_spaced_and_keep_the_newest() {
    let Some(test) = TestDb::new().await else {
        return;
    };
    let db = test.db.clone();
    let store = PgDocumentStore(db.clone());
    let d = db.create_document("# D", vec![], "u").await.unwrap()._id;
    let add = |content: &str| {
        store.add_version(
            d.clone(),
            NewVersion {
                content: content.to_string(),
                editors: vec!["u".to_string()],
            },
        )
    };
    add("eins").await.unwrap();
    add("eins").await.unwrap();
    add("gleich danach").await.unwrap();
    let versions = db.get_document_versions(&d).await.unwrap();
    assert_eq!(versions.len(), 1);
    assert_eq!(versions[0].content, "eins");

    sqlx::query("DELETE FROM document_versions")
        .execute(&db.pool)
        .await
        .unwrap();
    sqlx::query(
        r#"
        INSERT INTO document_versions (_id, document_id, content, editors, saved_at)
        SELECT 'v' || n, $1, 'Stand ' || n, '{}', 1000 + n FROM generate_series(0, 59) AS n
        "#,
    )
    .bind(&d)
    .execute(&db.pool)
    .await
    .unwrap();
    add("neu").await.unwrap();
    let versions = db.get_document_versions(&d).await.unwrap();
    assert_eq!(versions.len(), 50);
    assert_eq!(versions[0].content, "neu");
    let stored: i64 = sqlx::query_scalar("SELECT count(*) FROM document_versions")
        .fetch_one(&db.pool)
        .await
        .unwrap();
    assert_eq!(stored, 50);
    drop(store);
    drop(db);
    test.drop().await;
}

#[tokio::test]
async fn two_people_sorting_at_once_lose_no_document() {
    let Some(test) = TestDb::new().await else {
        return;
    };
    let db = &test.db;
    db.create_document_group("Alpha").await.unwrap();
    let alpha = listed(db).await.groups.remove(0)._id;
    let first = db
        .create_document("# A", vec![alpha.clone()], "u")
        .await
        .unwrap();
    let second = db
        .create_document("# B", vec![alpha.clone()], "u")
        .await
        .unwrap();

    let order = [second._id.clone()];
    let new_one = db.create_document("# C", vec![alpha.clone()], "u");
    let (reordered, added) = tokio::join!(db.set_group_document_order(&alpha, &order), new_one);
    assert!(reordered.unwrap());
    let added = added.unwrap();

    let body = listed(db).await;
    let ids = &body.groups[0].document_ids;
    assert_eq!(ids[0], second._id);
    assert!(ids.contains(&first._id) && ids.contains(&added._id));
    assert_eq!(ids.len(), 3);
    test.drop().await;
}

#[tokio::test]
async fn only_existing_groups_count() {
    let Some(test) = TestDb::new().await else {
        return;
    };
    let db = &test.db;
    db.create_document_group("Alpha").await.unwrap();
    let alpha = listed(db).await.groups.remove(0)._id;
    assert!(db
        .document_groups_exist(std::slice::from_ref(&alpha))
        .await
        .unwrap());
    assert!(db
        .document_groups_exist(&[alpha.clone(), alpha.clone()])
        .await
        .unwrap());
    assert!(db.document_groups_exist(&[]).await.unwrap());
    assert!(!db
        .document_groups_exist(&[alpha, "weg".to_string()])
        .await
        .unwrap());
    test.drop().await;
}

fn editor() -> Auth {
    Auth {
        authenticated_user: Some("editor".to_string()),
        token: None,
        user_assertion: None,
    }
}

fn now_ms() -> i64 {
    chrono::Utc::now().timestamp_millis()
}

/// The delta sync's cursor is the newest `at` a client has seen, so an `at` taken before a
/// wait for the row lock could commit below a cursor already handed out and never reach that
/// client. The stamp is taken once the lock is held.
#[tokio::test]
async fn a_change_is_stamped_after_the_wait_for_its_row() {
    let Some(test) = TestDb::new().await else {
        return;
    };
    let created = test
        .db
        .create_meetings(vec![meeting("A"), meeting("B")], "u")
        .await
        .unwrap();

    for delete in [false, true] {
        let meeting = created[usize::from(delete)].clone();
        let mut holder = test.connection().await;
        let mut held = holder.begin().await.unwrap();
        sqlx::query("SELECT 1 FROM meetings WHERE _id = $1 FOR UPDATE")
            .bind(&meeting._id)
            .execute(&mut *held)
            .await
            .unwrap();
        let db = test.db.clone();
        let write = tokio::spawn(async move {
            let mut meeting = meeting;
            if delete {
                db.delete_meeting(&meeting._id, &editor()).await.unwrap();
                db.get_meeting(&meeting._id).await.unwrap().unwrap()
            } else {
                meeting.title = "Neu".to_string();
                db.update_meeting(&mut meeting, &editor()).await.unwrap();
                meeting
            }
        });
        test.lock_waiters(1).await;
        tokio::time::sleep(Duration::from_millis(300)).await;
        let released = now_ms();
        held.commit().await.unwrap();
        let written = write.await.unwrap();
        let change = written.changed.unwrap().last().unwrap().clone();
        assert!(
            change.at >= released,
            "delete {delete}: stamped {} before the lock was free at {released}",
            change.at
        );
        if delete {
            assert_eq!(written.deleted_at, Some(change.at));
        }
        holder.close().await.unwrap();
    }
    test.drop().await;
}

/// A group deleted while a document is created with it: the document is created without it
/// (decision 5 of issue.md), instead of failing the foreign key once the delete commits.
#[tokio::test]
async fn a_document_created_while_its_group_is_deleted_is_created_without_it() {
    let Some(test) = TestDb::new().await else {
        return;
    };
    test.db.create_document_group("Alpha").await.unwrap();
    test.db.create_document_group("Beta").await.unwrap();
    let groups = listed(&test.db).await.groups;
    let (alpha, beta) = (groups[0]._id.clone(), groups[1]._id.clone());

    let mut deleter = test.connection().await;
    let mut deleting = deleter.begin().await.unwrap();
    sqlx::query("DELETE FROM document_groups WHERE _id = $1")
        .bind(&alpha)
        .execute(&mut *deleting)
        .await
        .unwrap();
    let db = test.db.clone();
    let groups = vec![alpha.clone(), beta.clone()];
    let create = tokio::spawn(async move { db.create_document("# A", groups, "u").await });
    test.lock_waiters(1).await;
    deleting.commit().await.unwrap();
    let created = create.await.unwrap().unwrap();
    assert_eq!(created.group_ids, vec![beta.clone()]);
    let read = test.db.get_document(&created._id).await.unwrap().unwrap();
    assert_eq!(read.group_ids, vec![beta]);
    deleter.close().await.unwrap();
    test.drop().await;
}

/// `set_document_groups` and `delete_document_group` at the same moment: both go through.
/// The memberships write locks the groups before it touches a membership row, as the group
/// delete (group row, then its cascade) does, so they cannot deadlock.
#[tokio::test]
async fn regrouping_a_document_while_one_of_its_groups_is_deleted_does_not_deadlock() {
    let Some(test) = TestDb::new().await else {
        return;
    };
    let db = test.db.clone();
    db.create_document_group("Alpha").await.unwrap();
    db.create_document_group("Beta").await.unwrap();
    let groups = listed(&db).await.groups;
    let (alpha, beta) = (groups[0]._id.clone(), groups[1]._id.clone());
    let document = db
        .create_document("# A", vec![alpha.clone(), beta.clone()], "u")
        .await
        .unwrap();

    // Holds the regrouping inside its delete of the old memberships, after it took its
    // group locks: the moment the group delete comes in.
    let mut holder = test.connection().await;
    let mut held = holder.begin().await.unwrap();
    sqlx::query(
        "SELECT 1 FROM document_group_members WHERE document_id = $1 AND group_id = $2 FOR UPDATE",
    )
    .bind(&document._id)
    .bind(&beta)
    .execute(&mut *held)
    .await
    .unwrap();
    let regroup = tokio::spawn({
        let db = db.clone();
        let (document, groups) = (document._id.clone(), vec![alpha.clone(), beta.clone()]);
        async move { db.set_document_groups(&document, &groups).await }
    });
    test.lock_waiters(1).await;
    let delete = tokio::spawn({
        let db = db.clone();
        let alpha = alpha.clone();
        async move { db.delete_document_group(&alpha).await }
    });
    test.lock_waiters(2).await;
    held.commit().await.unwrap();

    assert!(regroup.await.unwrap().unwrap());
    assert!(delete.await.unwrap().unwrap());
    let read = db.get_document(&document._id).await.unwrap().unwrap();
    assert_eq!(read.group_ids, vec![beta]);
    holder.close().await.unwrap();
    drop(db);
    test.drop().await;
}

/// Forwards connections to Postgres until a client sends COMMIT. That COMMIT reaches the
/// server, which carries it out, but its answer never comes back: the connection breaks, as
/// when the network or the database restarts at that moment.
async fn proxy_losing_the_commit_answer(target: SocketAddr) -> SocketAddr {
    // A test-only listener on a port the system picks; nothing else ever connects to it.
    let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
    let address = listener.local_addr().unwrap();
    tokio::spawn(async move {
        loop {
            let Ok((client, _)) = listener.accept().await else {
                return;
            };
            tokio::spawn(async move {
                let server = TcpStream::connect(target).await.unwrap();
                let (mut client_read, mut client_write) = client.into_split();
                let (mut server_read, mut server_write) = server.into_split();
                let cut = Arc::new(AtomicBool::new(false));
                let answers = tokio::spawn({
                    let cut = cut.clone();
                    async move {
                        let mut buffer = vec![0; 64 * 1024];
                        loop {
                            let Ok(n) = server_read.read(&mut buffer).await else {
                                return;
                            };
                            // Set before the COMMIT is passed on, so its answer is never sent.
                            if n == 0 || cut.load(Ordering::SeqCst) {
                                return;
                            }
                            if client_write.write_all(&buffer[..n]).await.is_err() {
                                return;
                            }
                        }
                    }
                });
                // A simple-protocol query "COMMIT": tag, length 11, text, NUL.
                let commit = b"Q\x00\x00\x00\x0bCOMMIT\x00";
                let mut seen: Vec<u8> = Vec::new();
                let mut buffer = vec![0; 64 * 1024];
                loop {
                    let Ok(n) = client_read.read(&mut buffer).await else {
                        return;
                    };
                    if n == 0 {
                        return;
                    }
                    let start = seen.len().saturating_sub(commit.len());
                    seen.extend_from_slice(&buffer[..n]);
                    if seen[start..].windows(commit.len()).any(|w| w == commit) {
                        cut.store(true, Ordering::SeqCst);
                        server_write.write_all(&buffer[..n]).await.unwrap();
                        // Long enough for the server to read the COMMIT; then the line goes
                        // dead. The commit itself may end later, the test waits for it.
                        tokio::time::sleep(Duration::from_millis(500)).await;
                        answers.abort();
                        return;
                    }
                    if server_write.write_all(&buffer[..n]).await.is_err() {
                        return;
                    }
                    let keep = seen.len().saturating_sub(commit.len());
                    seen.drain(..keep);
                }
            });
        }
    });
    address
}

/// A COMMIT whose answer is lost may have gone through: the batch must not be reported as
/// "nothing created", or the member creates it a second time.
#[tokio::test]
async fn a_batch_whose_commit_answer_is_lost_is_not_reported_as_nothing_created() {
    let Some(test) = TestDb::new().await else {
        return;
    };
    let options = test.options();
    let target = tokio::net::lookup_host((options.get_host().to_string(), options.get_port()))
        .await
        .unwrap()
        .next()
        .unwrap();
    let proxy = proxy_losing_the_commit_answer(target).await;
    let pool = db_support::pool_options(1)
        .connect_with(options.host("127.0.0.1").port(proxy.port()))
        .await
        .unwrap();
    let through_proxy = DB::new(pool);

    let error = through_proxy
        .create_meetings(vec![meeting("A"), meeting("B")], "u")
        .await
        .unwrap_err();
    assert!(
        matches!(error, CreateMeetingsError::CommitUnconfirmed(_)),
        "{error}"
    );
    // The server carries the COMMIT out on its own time: on a slow disk its WAL flush ends
    // after the client has seen the line go dead, so the rows can show up later, never half.
    let started = Instant::now();
    loop {
        let stored: i64 = sqlx::query_scalar("SELECT count(*) FROM meetings")
            .fetch_one(&test.db.pool)
            .await
            .unwrap();
        if stored == 2 {
            break;
        }
        assert_eq!(stored, 0, "part of the batch is stored");
        assert!(
            started.elapsed() < DEADLINE,
            "the COMMIT did not go through"
        );
        tokio::time::sleep(Duration::from_millis(20)).await;
    }
    through_proxy.pool.close().await;
    test.drop().await;
}

/// A U+0000 typed into a live document: the room's saves go through (the state keeps the
/// character, `content` drops it) and the room closes when everyone has left. Before, every
/// save failed, the room retried forever and lost the edits at the next restart.
#[tokio::test]
async fn a_room_with_a_nul_character_in_its_text_saves_and_closes() {
    let Some(test) = TestDb::new().await else {
        return;
    };
    let document = test
        .db
        .create_document("# Titel\n", vec![], "u")
        .await
        .unwrap();
    let rooms = Rooms::new(Arc::new(PgDocumentStore(test.db.clone())));
    let mut connection = rooms.join(&document._id, "alex", "alex").unwrap();

    let local = Doc::new();
    let send = |message: Message| message.encode_v1();
    assert!(
        connection
            .send_frame(
                send(Message::Sync(SyncMessage::SyncStep1(
                    local.transact().state_vector()
                )))
                .into()
            )
            .await
    );
    // The room answers with its text and asks for ours.
    let started = Instant::now();
    while local.get_or_insert_text(TEXT_ROOT).len(&local.transact()) == 0 {
        assert!(started.elapsed() < DEADLINE, "no text from the room");
        let Ok(Outbound::Frame(frame)) =
            tokio::time::timeout(Duration::from_millis(500), connection.next()).await
        else {
            continue;
        };
        match Message::decode_v1(&frame).unwrap() {
            Message::Sync(SyncMessage::SyncStep2(update) | SyncMessage::Update(update)) => {
                let update = Update::decode_v1(&update).unwrap();
                local.transact_mut().apply_update(update).unwrap();
            }
            Message::Sync(SyncMessage::SyncStep1(state_vector)) => {
                let update = local.transact().encode_state_as_update_v1(&state_vector);
                connection
                    .send_frame(send(Message::Sync(SyncMessage::SyncStep2(update))).into())
                    .await;
            }
            _ => {}
        }
    }
    let update = {
        let text = local.get_or_insert_text(TEXT_ROOT);
        let mut transaction = local.transact_mut();
        let end = text.len(&transaction);
        text.insert(&mut transaction, end, "vor\u{0}nach");
        transaction.encode_update_v1()
    };
    assert!(
        connection
            .send_frame(send(Message::Sync(SyncMessage::Update(update))).into())
            .await
    );
    tokio::time::sleep(Duration::from_millis(200)).await;
    drop(connection);

    let started = Instant::now();
    while rooms.is_open(&document._id) {
        assert!(
            started.elapsed() < DEADLINE,
            "the room never finished saving"
        );
        tokio::time::sleep(Duration::from_millis(50)).await;
    }
    let (state, content): (Vec<u8>, String) =
        sqlx::query_as("SELECT state, content FROM documents WHERE _id = $1")
            .bind(&document._id)
            .fetch_one(&test.db.pool)
            .await
            .unwrap();
    assert_eq!(text_of_state(&state).unwrap(), "# Titel\nvor\u{0}nach");
    assert_eq!(content, "# Titel\nvornach");
    drop(rooms);
    test.drop().await;
}

/// The handlers that store client text refuse a U+0000 like other invalid input, before
/// anything is written: Postgres cannot store it, MongoDB did (and answered 200).
#[tokio::test]
async fn handlers_refuse_text_with_a_nul_character_before_writing() {
    use axum::extract::State;
    use axum::http::StatusCode;
    use axum::response::Response;
    use axum::Json;
    use backend::extractors::AuthExtractor;
    use backend::methods::{
        admin_create_member::admin_create_member, send_email_preview::send_email_preview,
        update_meeting::update_meeting, update_own_member_data::update_own_member_data,
    };
    use backend::state::AppState;
    use backend::types::{SetOwnMemberDataRequestBody, UpdateMeetingRequestBody};

    let Some(test) = TestDb::new().await else {
        return;
    };
    let state = AppState::new(test.db.clone());
    sqlx::query(
        "INSERT INTO users (_id, capabilities) VALUES ('editor', \
         '{UpdateMeetings,CreateMember,SendMassEmail}'), ('member', '{}')",
    )
    .execute(&test.db.pool)
    .await
    .unwrap();
    let as_user = |id: &str| {
        AuthExtractor(Auth {
            authenticated_user: Some(id.to_string()),
            token: None,
            user_assertion: None,
        })
    };
    async fn answer(response: Response) -> (StatusCode, String) {
        let status = response.status();
        let body = axum::body::to_bytes(response.into_body(), 1 << 20)
            .await
            .unwrap();
        (status, String::from_utf8(body.to_vec()).unwrap())
    }
    let count = |table: &'static str| {
        let pool = test.db.pool.clone();
        async move {
            sqlx::query_scalar::<_, i64>(AssertSqlSafe(format!("SELECT count(*) FROM {table}")))
                .fetch_one(&pool)
                .await
                .unwrap()
        }
    };

    let mut to_be_announced = meeting("A");
    to_be_announced.place_to_be_announced = true;
    let created = test
        .db
        .create_meetings(vec![to_be_announced], "editor")
        .await
        .unwrap()
        .remove(0);
    let mut sent = created.clone();
    sent.description = "Treffen\u{0}".to_string();
    let (status, body) = answer(
        update_meeting(
            State(state.clone()),
            as_user("editor"),
            Json(UpdateMeetingRequestBody {
                meeting: sent,
                delete: None,
            }),
        )
        .await,
    )
    .await;
    assert_eq!(status, StatusCode::UNPROCESSABLE_ENTITY);
    assert_eq!(
        body,
        "Das Treffen enthält ein unzulässiges Zeichen (U+0000)."
    );
    let stored = test.db.get_meeting(&created._id).await.unwrap().unwrap();
    assert_eq!(stored, created, "nothing changed");
    // Only stored fields count: an unknown id is looked up, and creates, as before.
    let mut unknown = created.clone();
    unknown._id = "neu\u{0}".to_string();
    let (status, _) = answer(
        update_meeting(
            State(state.clone()),
            as_user("editor"),
            Json(UpdateMeetingRequestBody {
                meeting: unknown,
                delete: None,
            }),
        )
        .await,
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(count("meetings").await, 2);

    let member: backend::types::SubmittedMember = serde_json::from_value(serde_json::json!({
        "type": "Active", "natural_person": true,
        "name": { "passport": "Kim Muster", "first_name": "Kim", "last_name": "Muster" },
        "institution": null, "pronouns": null,
        "address": { "street": "Weg", "number": "2", "addition": null, "zip": "86150",
                     "city": "Augsburg", "country": "DE" },
        "email": "kim@example.org", "phone": null, "user_notes": "Hallo\u{0}",
        "reference": null, "approved_charter": true, "approved_privacy": true, "above_18": true
    }))
    .unwrap();
    let (status, body) = answer(
        update_own_member_data(
            State(state.clone()),
            as_user("member"),
            Json(SetOwnMemberDataRequestBody {
                member: member.clone(),
            }),
        )
        .await,
    )
    .await;
    assert_eq!(status, StatusCode::BAD_REQUEST);
    assert_eq!(body, "Text fields cannot contain the character U+0000");
    assert_eq!(count("members").await, 0);

    let (status, body) =
        answer(admin_create_member(State(state.clone()), as_user("editor"), Json(member)).await)
            .await;
    assert_eq!(status, StatusCode::BAD_REQUEST);
    assert_eq!(
        body,
        "Validation error: Text fields cannot contain the character U+0000"
    );
    assert_eq!(count("users").await, 2, "no user was created");

    let preview: backend::types::SendEmailPreviewRequestBody =
        serde_json::from_value(serde_json::json!({
            "subject": "Betreff", "body": "Text",
            "attachments": [{ "filename": "a\u{0}.txt", "content_type": "text/plain",
                              "data": "aGFsbG8=" }],
            "reply_to": null
        }))
        .unwrap();
    let (status, body) =
        answer(send_email_preview(State(state.clone()), as_user("editor"), Json(preview)).await)
            .await;
    assert_eq!(status, StatusCode::BAD_REQUEST);
    assert_eq!(
        body,
        "Subject, body, reply-to and attachments cannot contain the character U+0000"
    );
    assert_eq!(count("email_drafts").await, 0);
    drop(state);
    test.drop().await;
}
