//! The migrator's config file. The expected counts are the heart of the verification: they
//! come from the owner's count query (`deployment/README.md`, "The Postgres cutover"), never
//! from the dump, so a dump that reads nothing or the wrong thing cannot pass.

use super::report::COLLECTIONS;
use serde::Deserialize;
use std::collections::BTreeMap;
use std::fmt;
use std::path::{Path, PathBuf};

#[derive(Debug, Clone, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Config {
    /// The directory `mongodump --out` wrote; the database is a subdirectory of it.
    pub dump_dir: PathBuf,
    /// The subdirectory, `queer-augsburg` in production.
    pub database: String,
    /// One entry per collection of `report::COLLECTIONS`, empty ones as `0`.
    pub expected_counts: BTreeMap<String, u64>,
    /// Fields of old documents that may be dropped, by collection and dotted field name.
    /// Nothing is listed here until a rehearsal reports an unknown field and the owner
    /// decides it may go.
    #[serde(default)]
    pub ignored_fields: BTreeMap<String, Vec<String>>,
}

#[derive(Debug)]
pub enum ConfigError {
    Read {
        path: PathBuf,
        kind: std::io::ErrorKind,
    },
    /// The file is not the YAML of `Config`; the parser's text is kept out, it echoes the
    /// file.
    Parse { path: PathBuf, line: Option<usize> },
    /// `expected_counts` lacks a known collection.
    MissingCount(&'static str),
    /// `expected_counts` or `ignored_fields` names a collection that is not one of ours.
    UnknownCollection { count: usize },
}

impl fmt::Display for ConfigError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            ConfigError::Read { path, kind } => {
                write!(f, "config: cannot read {} ({kind:?})", path.display())
            }
            ConfigError::Parse { path, line } => match line {
                Some(line) => write!(f, "config: not valid at line {line} of {}", path.display()),
                None => write!(f, "config: not valid: {}", path.display()),
            },
            ConfigError::MissingCount(collection) => {
                write!(f, "config: expected_counts lacks {collection}")
            }
            ConfigError::UnknownCollection { count } => {
                write!(f, "config: {count} unknown collection name(s)")
            }
        }
    }
}

impl std::error::Error for ConfigError {}

impl Config {
    pub fn load(path: &Path) -> Result<Self, ConfigError> {
        let text = std::fs::read_to_string(path).map_err(|e| ConfigError::Read {
            path: path.to_path_buf(),
            kind: e.kind(),
        })?;
        let config: Config = serde_yaml::from_str(&text).map_err(|e| ConfigError::Parse {
            path: path.to_path_buf(),
            line: e.location().map(|l| l.line()),
        })?;
        config.validate()?;
        Ok(config)
    }

    /// Every known collection has a count and nothing unknown is named.
    pub fn validate(&self) -> Result<(), ConfigError> {
        for collection in COLLECTIONS {
            if !self.expected_counts.contains_key(collection) {
                return Err(ConfigError::MissingCount(collection));
            }
        }
        let unknown = self
            .expected_counts
            .keys()
            .chain(self.ignored_fields.keys())
            .filter(|name| !COLLECTIONS.contains(&name.as_str()))
            .count();
        if unknown > 0 {
            return Err(ConfigError::UnknownCollection { count: unknown });
        }
        Ok(())
    }

    pub fn expected(&self, collection: &str) -> Option<u64> {
        self.expected_counts.get(collection).copied()
    }

    pub fn is_ignored(&self, collection: &str, field: &str) -> bool {
        self.ignored_fields
            .get(collection)
            .is_some_and(|fields| fields.iter().any(|f| f == field))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn counts() -> BTreeMap<String, u64> {
        COLLECTIONS.iter().map(|c| (c.to_string(), 0)).collect()
    }

    #[test]
    fn every_collection_needs_a_count() {
        let mut config = Config {
            dump_dir: PathBuf::from("/dump"),
            database: "queer-augsburg".into(),
            expected_counts: counts(),
            ignored_fields: BTreeMap::new(),
        };
        assert!(config.validate().is_ok());
        config.expected_counts.remove("document_versions");
        assert!(matches!(
            config.validate(),
            Err(ConfigError::MissingCount("document_versions"))
        ));
        config.expected_counts.insert("document_versions".into(), 0);
        config.expected_counts.insert("sessions".into(), 1);
        assert!(matches!(
            config.validate(),
            Err(ConfigError::UnknownCollection { count: 1 })
        ));
    }

    #[test]
    fn a_parse_error_names_the_line_not_the_text() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("migrate.yml");
        std::fs::write(&path, "dump_dir: /x\ndatabase: [SECRET\n").unwrap();
        let err = Config::load(&path).unwrap_err();
        let text = err.to_string();
        assert!(!text.contains("SECRET"), "{text}");
        assert!(text.starts_with("config: not valid"), "{text}");
    }
}
