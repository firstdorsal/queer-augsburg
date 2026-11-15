//! A schema of its own per test, in the database `TEST_DATABASE_URL` names, for the tests of
//! `database.rs`, `db_behaviour.rs` and `document_search_load.rs`. CI always sets the variable
//! (a `postgres` service); the user needs only the right to create schemas there.
//!
//! Not a database per test: on a slow disk a run of them failed its own setup. Postgres 18
//! makes both ends of a database expensive for every other session of the server (REL_18_6,
//! src/backend/commands/dbcommands.c, utils/cache/relmapper.c and relcache.c):
//! - `CREATE DATABASE` (strategy `WAL_LOG`, the default) copies all of `template1`, 7.5 MB,
//!   through the WAL, and writes the new database's relation map while it holds the one
//!   `RelationMappingLock`, across a WAL flush and a `durable_rename`. Every login takes that
//!   lock to read the maps, so it waits while any `CREATE DATABASE` holds it. The first login
//!   of a new database also builds its relcache init file and renames it into place under
//!   the one `RelCacheInitLock`.
//! - `DROP DATABASE` always requests an immediate checkpoint and waits for it: every dirty
//!   buffer of the server written and synced, once per test.
//!
//! With the server's disk writes throttled to 3 MB/s, each of three runs of `db_behaviour.rs`
//! with a database per test failed: logins took up to 87 s, waiting on those two locks, and
//! setups ended in `PoolTimedOut` (sqlx's 30 s), or a `DROP DATABASE` in "is being accessed by
//! other users" because a session of the test had not ended yet. A schema is a few catalog
//! rows: `CREATE SCHEMA`, the migration and `DROP SCHEMA … CASCADE` take neither lock and
//! force no checkpoint. On the same disk all 43 tests passed in under 30 s, every login in
//! under 70 ms.
//!
//! A test's connections find only its schema on the search path, so the server's unqualified
//! statements and `DB::migrate` work in it as in a database of their own, and carry its name as
//! `application_name`, which tells them apart in `pg_stat_activity`. The migration takes an
//! advisory lock per database, so the tests of one run migrate one after the other (well under
//! a second each). `migrator.rs` keeps a database per test (`migrate_support`): it checks
//! rights on the database and on the schema `public`.
//!
//! A test ends with [`TestSchema::drop`]. One that panics, or returns before it, or whose
//! `TestSchema::drop` fails, still leaves no schema behind: `Drop` removes it then, ending the
//! test's own sessions first (see there for what that cannot cover). The crate declares
//! `mod drop_guard;` for that destructor.

#![allow(dead_code)]

use crate::drop_guard::remove_after_test;
use backend::db::DB;
use sqlx::postgres::{PgConnectOptions, PgConnection, PgPool, PgPoolOptions};
use sqlx::{AssertSqlSafe, Connection};
use std::time::Duration;
use url::Url;

/// How long a test waits for a login, in setup and later, on every connection of this module:
/// sqlx's default for a pool, now also for the test's own connections, which had no limit. It
/// is far above any login without databases created and dropped beside it (under 70 ms on the
/// throttled disk above), and a server that never answers fails the test instead of hanging it.
pub const LOGIN_WAIT: Duration = Duration::from_secs(30);

pub struct TestSchema {
    pub name: String,
    /// The server's database, as `TEST_DATABASE_URL` names it.
    server: PgConnectOptions,
    url: Url,
    /// How long a removal waits for the schema's locks.
    lock_wait: Duration,
    /// Set by [`Self::drop`]; until then `Drop` removes the schema.
    removed: bool,
    /// Set by [`Self::fail_removal_after_its_drop`].
    fail_after_drop: bool,
}

impl TestSchema {
    /// `None` without a server, outside CI.
    pub async fn new() -> Option<Self> {
        let Ok(url) = std::env::var("TEST_DATABASE_URL") else {
            assert!(
                std::env::var("CI").is_err(),
                "CI must set TEST_DATABASE_URL"
            );
            eprintln!("skipped: TEST_DATABASE_URL is not set");
            return None;
        };
        let server: PgConnectOptions = url.parse().unwrap();
        // Lower-case letters, digits and `_`: a plain identifier, also inside `search_path`.
        let name = format!(
            "qa_test_{}",
            backend::utils::generate_id(12)
                .to_lowercase()
                .replace('-', "_")
        );
        let mut connection = login(&server).await;
        // The name is ours; CREATE SCHEMA takes no parameters.
        sqlx::query(AssertSqlSafe(format!("CREATE SCHEMA \"{name}\"")))
            .execute(&mut connection)
            .await
            .unwrap();
        connection.close().await.unwrap();
        let url = Url::parse(&url).unwrap();
        Some(Self {
            name,
            server,
            url,
            lock_wait: LOGIN_WAIT,
            removed: false,
            fail_after_drop: false,
        })
    }

    /// The removal waits [`LOGIN_WAIT`] for the schema's locks; the harness's own tests shorten
    /// that to see it give up.
    pub fn set_lock_wait(&mut self, wait: Duration) {
        self.lock_wait = wait;
    }

    /// [`Self::drop`] fails after its `DROP SCHEMA` succeeded, as when the connection is lost
    /// before the answer, so `Drop` repeats a removal that is already done; for the harness's
    /// own tests.
    pub fn fail_removal_after_its_drop(&mut self) {
        self.fail_after_drop = true;
    }

    /// Connections of this test.
    pub fn options(&self) -> PgConnectOptions {
        self.server
            .clone()
            .options([("search_path", &self.name)])
            .application_name(&self.name)
    }

    /// [`Self::options`] as a URL, for `DB::connect`.
    pub fn url(&self) -> Url {
        let mut url = self.url.clone();
        url.query_pairs_mut()
            .append_pair("options", &format!("-c search_path={}", self.name))
            .append_pair("application_name", &self.name);
        url
    }

    /// A connection of its own, outside any pool.
    pub async fn connection(&self) -> PgConnection {
        login(&self.options()).await
    }

    pub async fn pool(&self, max_connections: u32) -> PgPool {
        pool_options(max_connections)
            .connect_with(self.options())
            .await
            .unwrap()
    }

    /// A `DB` on [`Self::pool`] with the schema migrated, as the server does at every start.
    pub async fn migrated(&self, max_connections: u32) -> DB {
        let db = DB::new(self.pool(max_connections).await);
        db.migrate().await.unwrap();
        db
    }

    /// After every pool and connection of the test is closed. If it fails, `Drop` repeats the
    /// removal, ending the test's sessions first.
    pub async fn drop(mut self) {
        remove(
            &self.server,
            &self.name,
            false,
            self.lock_wait,
            self.fail_after_drop,
        )
        .await
        .unwrap();
        self.removed = true;
    }
}

impl Drop for TestSchema {
    /// A test that panicked or returned before [`TestSchema::drop`]; the removal runs as
    /// [`remove_after_test`] describes. The test's pools, connections and spawned tasks may
    /// still be alive here, holding locks in the schema with nothing to poll them, so their
    /// sessions are ended first; they all carry the schema's name.
    ///
    /// Not covered:
    /// - a process that ends without unwinding: a panic while panicking, `panic = "abort"`
    ///   (which no profile sets), a kill such as a CI job timeout or Ctrl-C;
    /// - a hanging test, and a server that is gone;
    /// - a `#[tokio::test(flavor = "multi_thread")]` test (none uses one): its worker threads
    ///   keep polling the test's tasks while this waits, so a task can log in again and take a
    ///   lock after its session was ended, and the `DROP` then gives up after its lock wait.
    fn drop(&mut self) {
        if self.removed {
            return;
        }
        let (server, name, lock_wait) = (self.server.clone(), self.name.clone(), self.lock_wait);
        remove_after_test(
            &format!("db_support: schema {}", self.name),
            move || async move {
                let ended = remove(&server, &name, true, lock_wait, false).await?;
                Ok(format!(
                    "db_support: removed schema {name} after the test ended without \
                     TestSchema::drop, and {ended} of its sessions"
                ))
            },
        );
    }
}

/// `DROP SCHEMA IF EXISTS … CASCADE`, waiting at most `lock_wait` for its locks; a repeat of a
/// removal that got that far succeeds. With `end_sessions`, first ends the sessions of the test
/// (its `application_name`) and waits up to [`LOGIN_WAIT`] for each to go; the number ended is
/// returned. `fail_after_drop`: see [`TestSchema::fail_removal_after_its_drop`].
async fn remove(
    server: &PgConnectOptions,
    name: &str,
    end_sessions: bool,
    lock_wait: Duration,
    fail_after_drop: bool,
) -> Result<usize, sqlx::Error> {
    let mut connection = login(server).await;
    let mut ended = 0;
    if end_sessions {
        let results: Vec<bool> = sqlx::query_scalar(
            "SELECT pg_terminate_backend(pid, $2) FROM pg_stat_activity \
             WHERE application_name = $1 AND pid <> pg_backend_pid()",
        )
        .bind(name)
        .bind(i64::try_from(LOGIN_WAIT.as_millis()).unwrap())
        .fetch_all(&mut connection)
        .await?;
        ended = results.into_iter().filter(|ended| *ended).count();
    }
    sqlx::query(AssertSqlSafe(format!(
        "SET lock_timeout = {}",
        lock_wait.as_millis()
    )))
    .execute(&mut connection)
    .await?;
    // The name is ours; DROP SCHEMA takes no parameters.
    sqlx::query(AssertSqlSafe(format!(
        "DROP SCHEMA IF EXISTS \"{name}\" CASCADE"
    )))
    .execute(&mut connection)
    .await?;
    if fail_after_drop {
        return Err(sqlx::Error::Protocol(
            "the planned failure after DROP SCHEMA".into(),
        ));
    }
    connection.close().await?;
    Ok(ended)
}

/// The server's database, for the checks of the harness itself.
pub fn test_server() -> PgConnectOptions {
    std::env::var("TEST_DATABASE_URL").unwrap().parse().unwrap()
}

/// Whether a schema of this name exists in the database `TEST_DATABASE_URL` names.
pub async fn schema_exists(name: &str) -> bool {
    let mut connection = login(&test_server()).await;
    let exists = sqlx::query_scalar("SELECT EXISTS (SELECT FROM pg_namespace WHERE nspname = $1)")
        .bind(name)
        .fetch_one(&mut connection)
        .await
        .unwrap();
    connection.close().await.unwrap();
    exists
}

/// The sessions on the server that carry this `application_name`.
pub async fn sessions_named(name: &str) -> i64 {
    let mut connection = login(&test_server()).await;
    let count =
        sqlx::query_scalar("SELECT count(*) FROM pg_stat_activity WHERE application_name = $1")
            .bind(name)
            .fetch_one(&mut connection)
            .await
            .unwrap();
    connection.close().await.unwrap();
    count
}

/// A pool whose logins wait [`LOGIN_WAIT`].
pub fn pool_options(max_connections: u32) -> PgPoolOptions {
    PgPoolOptions::new()
        .max_connections(max_connections)
        .acquire_timeout(LOGIN_WAIT)
}

/// One connection, waiting for its login at most [`LOGIN_WAIT`].
pub async fn login(options: &PgConnectOptions) -> PgConnection {
    tokio::time::timeout(LOGIN_WAIT, PgConnection::connect_with(options))
        .await
        .unwrap_or_else(|_| panic!("the test server took no login within {LOGIN_WAIT:?}"))
        .unwrap()
}
