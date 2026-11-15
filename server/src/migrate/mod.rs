//! The MongoDB → Postgres migrator (research-postgres §4) and the dump anonymizer. The
//! source is always a mongodump directory: the cutover runbook makes one as the rollback
//! artefact anyway, and reading that very dump means the audit copy and the migrated input
//! are the same bytes, with no driver and no network to `qa-db`.
//!
//! Everything printed is counts, names and digests (`report.rs`); nothing in this module
//! formats a field value, an id or a database error message.

pub mod anonymize;
pub mod canon;
pub mod config;
pub mod convert;
pub mod doc;
pub mod reader;
pub mod report;
pub mod source;
pub mod verify;
pub mod write;

use config::{Config, ConfigError};
use reader::SourceError;
use report::{Problem, Reason, Report, COLLECTIONS};
use sqlx::postgres::PgPoolOptions;
use std::collections::BTreeMap;
use std::fmt;
use std::time::Duration;

/// How long the migrator waits for a connection, a new login included (sqlx's acquire
/// timeout also bounds `connect` and retries a refused connection until it runs out). The
/// migrator runs once, by hand, in the cutover's downtime, and a run that gives up means
/// rolling the cutover back (deployment/README.md, day step 4 → R1); waiting longer costs
/// nothing there. Under a disk stall a login can take longer than the 10 s this was: a test
/// run on a loaded host failed during a 79 s checkpoint, and a login held back by 12 s fails
/// the same way, with "connect: pool timed out" (`.plans/postgres-own-auth/issue.md`,
/// "Verification 4, server"); turing's other services keep running in the downtime. Two
/// minutes covers that stall with room to spare and still ends a run whose database never
/// answers. `tests/migrator.rs` runs the migrator through logins slower than the old 10 s.
pub const DATABASE_WAIT: Duration = Duration::from_secs(120);

/// Why a run could not finish. Each prints without any data.
#[derive(Debug)]
pub enum Failure {
    Config(ConfigError),
    Source(SourceError),
    /// A database step failed; `detail` is a fixed description (`describe_sqlx`).
    Database {
        step: &'static str,
        detail: String,
    },
}

impl fmt::Display for Failure {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Failure::Config(e) => write!(f, "{e}"),
            Failure::Source(e) => write!(f, "{e}"),
            Failure::Database { step, detail } => write!(f, "database: {step}: {detail}"),
        }
    }
}

impl std::error::Error for Failure {}

impl From<ConfigError> for Failure {
    fn from(e: ConfigError) -> Self {
        Failure::Config(e)
    }
}

impl From<SourceError> for Failure {
    fn from(e: SourceError) -> Self {
        Failure::Source(e)
    }
}

/// A database error as a fixed vocabulary: the SQLSTATE and the constraint name of a
/// database error, else the kind of error. The message itself can quote a value (a unique
/// violation names the key) and is never used.
pub fn describe_sqlx(e: &sqlx::Error) -> String {
    match e {
        sqlx::Error::Database(db) => format!(
            "database error code={} constraint={}",
            db.code().as_deref().unwrap_or("-"),
            db.constraint().unwrap_or("-")
        ),
        sqlx::Error::Configuration(_) => "configuration error".to_string(),
        sqlx::Error::Io(e) => format!("io error {:?}", e.kind()),
        sqlx::Error::Tls(_) => "tls error".to_string(),
        sqlx::Error::Protocol(_) => "protocol error".to_string(),
        sqlx::Error::RowNotFound => "row not found".to_string(),
        sqlx::Error::TypeNotFound { .. } => "type not found".to_string(),
        sqlx::Error::ColumnIndexOutOfBounds { .. } => "column index out of bounds".to_string(),
        sqlx::Error::ColumnNotFound(_) => "column not found".to_string(),
        sqlx::Error::ColumnDecode { .. } => "column decode error".to_string(),
        sqlx::Error::Encode(_) => "encode error".to_string(),
        sqlx::Error::Decode(_) => "decode error".to_string(),
        sqlx::Error::AnyDriverError(_) => "driver error".to_string(),
        sqlx::Error::PoolTimedOut => "pool timed out".to_string(),
        sqlx::Error::PoolClosed => "pool closed".to_string(),
        sqlx::Error::WorkerCrashed => "worker crashed".to_string(),
        sqlx::Error::Migrate(_) => "migration error".to_string(),
        sqlx::Error::InvalidSavePointStatement => "invalid savepoint".to_string(),
        sqlx::Error::BeginFailed => "begin failed".to_string(),
        _ => "other error".to_string(),
    }
}

/// An error from the server's own code path (`db.rs`), reduced to the database error inside
/// it when there is one; its text is never used (it can quote a column value).
pub fn describe_anyhow(e: &anyhow::Error) -> String {
    for cause in e.chain() {
        if let Some(sqlx) = cause.downcast_ref::<sqlx::Error>() {
            return describe_sqlx(sqlx);
        }
    }
    "server code path failed".to_string()
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Mode {
    /// Apply the schema, write, then verify.
    Migrate,
    /// Only compare the dump with what the database holds.
    Verify,
}

/// One run. Reads and converts the whole dump first; nothing is written when a document
/// has a problem or a count differs from the config. The report is returned for printing
/// whether or not it is verified; `Err` is for a run that could not get to its report.
pub async fn run(config: &Config, database_url: &str, mode: Mode) -> Result<Report, Failure> {
    config.validate()?;
    let mut report = Report::new();
    for collection in COLLECTIONS {
        report.collection(collection).expected = config.expected(collection);
    }

    let db_dir = reader::database_dir(&config.dump_dir, &config.database)?;
    for name in reader::list_collections(&db_dir)? {
        if !COLLECTIONS.contains(&name.as_str()) {
            return Err(SourceError::UnknownCollection {
                path: db_dir.join(format!("{name}.bson")),
            }
            .into());
        }
    }
    let mut raw = BTreeMap::new();
    for collection in COLLECTIONS {
        raw.insert(collection, reader::read_collection(&db_dir, collection)?);
    }

    let converted = convert::convert_all(&raw, config, &mut report);
    for collection in COLLECTIONS {
        if report.collection(collection).source != config.expected(collection) {
            report.error(Problem::new(collection, "", Reason::CountMismatch));
        }
    }
    if report.has_errors() {
        return Ok(report);
    }

    let pool = PgPoolOptions::new()
        .max_connections(4)
        .acquire_timeout(DATABASE_WAIT)
        .connect(database_url)
        .await
        .map_err(|e| Failure::Database {
            step: "connect",
            detail: describe_sqlx(&e),
        })?;
    if mode == Mode::Migrate {
        crate::db::DB::new(pool.clone())
            .migrate()
            .await
            .map_err(|e| Failure::Database {
                step: "schema",
                detail: describe_anyhow(&e),
            })?;
        write::write_all(&pool, &converted, &mut report).await?;
    }
    verify::verify_all(&pool, &converted, &mut report).await?;
    pool.close().await;
    Ok(report)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn database_errors_are_described_without_their_message() {
        let text = describe_sqlx(&sqlx::Error::RowNotFound);
        assert_eq!(text, "row not found");
        let text = describe_anyhow(&anyhow::anyhow!("members.email is SECRET"));
        assert_eq!(text, "server code path failed");
        let wrapped = anyhow::Error::from(sqlx::Error::PoolTimedOut).context("SECRET");
        assert_eq!(describe_anyhow(&wrapped), "pool timed out");
    }
}
