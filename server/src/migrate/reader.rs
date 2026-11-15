//! Reading a mongodump directory: `<dir>/<database>/<collection>.bson` is a flat
//! concatenation of length-prefixed BSON documents. Nothing here is lenient: a directory
//! or file that is not there is an error, never an empty collection, because a mis-pointed
//! dump must not migrate nothing and pass (research-postgres §4.4).

use bson::Document;
use std::fmt;
use std::io::ErrorKind;
use std::path::{Path, PathBuf};

/// What went wrong reading the dump. Paths are the operator's, never data; the BSON error
/// text is left out because it can quote bytes of the document.
#[derive(Debug)]
pub enum SourceError {
    DatabaseDirMissing(PathBuf),
    NotADirectory(PathBuf),
    CollectionMissing(PathBuf),
    Io {
        path: PathBuf,
        kind: ErrorKind,
    },
    /// The file ends inside a document, or a length prefix points past the end.
    Truncated {
        path: PathBuf,
        document: usize,
    },
    /// A document that is not valid BSON.
    Malformed {
        path: PathBuf,
        document: usize,
    },
    /// A `.bson` file for a collection the migrator does not know.
    UnknownCollection {
        path: PathBuf,
    },
}

impl fmt::Display for SourceError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            SourceError::DatabaseDirMissing(path) => {
                write!(f, "dump: database directory missing: {}", path.display())
            }
            SourceError::NotADirectory(path) => {
                write!(f, "dump: not a directory: {}", path.display())
            }
            SourceError::CollectionMissing(path) => {
                write!(f, "dump: collection file missing: {}", path.display())
            }
            SourceError::Io { path, kind } => {
                write!(f, "dump: io error {kind:?} at {}", path.display())
            }
            SourceError::Truncated { path, document } => write!(
                f,
                "dump: truncated at document {document} of {}",
                path.display()
            ),
            SourceError::Malformed { path, document } => write!(
                f,
                "dump: malformed bson at document {document} of {}",
                path.display()
            ),
            SourceError::UnknownCollection { path } => {
                write!(f, "dump: unknown collection file: {}", path.display())
            }
        }
    }
}

impl std::error::Error for SourceError {}

/// Checks that `<dir>/<database>` is a directory.
pub fn database_dir(dir: &Path, database: &str) -> Result<PathBuf, SourceError> {
    let db_dir = dir.join(database);
    match std::fs::metadata(&db_dir) {
        Ok(meta) if meta.is_dir() => Ok(db_dir),
        Ok(_) => Err(SourceError::NotADirectory(db_dir)),
        Err(e) if e.kind() == ErrorKind::NotFound => Err(SourceError::DatabaseDirMissing(db_dir)),
        Err(e) => Err(SourceError::Io {
            path: db_dir,
            kind: e.kind(),
        }),
    }
}

/// The names of the collections that have a `.bson` file in the database directory, sorted.
/// Everything else in the directory (`.metadata.json`, …) is ignored.
pub fn list_collections(db_dir: &Path) -> Result<Vec<String>, SourceError> {
    let entries = std::fs::read_dir(db_dir).map_err(|e| SourceError::Io {
        path: db_dir.to_path_buf(),
        kind: e.kind(),
    })?;
    let mut names = Vec::new();
    for entry in entries {
        let entry = entry.map_err(|e| SourceError::Io {
            path: db_dir.to_path_buf(),
            kind: e.kind(),
        })?;
        let path = entry.path();
        if path.extension().is_some_and(|ext| ext == "bson") {
            if let Some(stem) = path.file_stem().and_then(|stem| stem.to_str()) {
                names.push(stem.to_string());
            }
        }
    }
    names.sort();
    Ok(names)
}

/// Every document of `<db_dir>/<collection>.bson`, in file order.
pub fn read_collection(db_dir: &Path, collection: &str) -> Result<Vec<Document>, SourceError> {
    let path = db_dir.join(format!("{collection}.bson"));
    if !path.is_file() {
        return Err(SourceError::CollectionMissing(path));
    }
    let bytes = std::fs::read(&path).map_err(|e| SourceError::Io {
        path: path.clone(),
        kind: e.kind(),
    })?;
    parse_documents(&bytes).map_err(|(reason, document)| match reason {
        Framing::Truncated => SourceError::Truncated {
            path: path.clone(),
            document,
        },
        Framing::Malformed => SourceError::Malformed {
            path: path.clone(),
            document,
        },
    })
}

enum Framing {
    Truncated,
    Malformed,
}

/// Walks the concatenation by the length prefix of each document (i32 little endian,
/// including the prefix itself), so a truncated file is noticed instead of guessed at.
fn parse_documents(bytes: &[u8]) -> Result<Vec<Document>, (Framing, usize)> {
    let mut documents = Vec::new();
    let mut offset = 0usize;
    while offset < bytes.len() {
        let index = documents.len();
        if bytes.len() - offset < 4 {
            return Err((Framing::Truncated, index));
        }
        let length = i32::from_le_bytes([
            bytes[offset],
            bytes[offset + 1],
            bytes[offset + 2],
            bytes[offset + 3],
        ]);
        let Ok(length) = usize::try_from(length) else {
            return Err((Framing::Malformed, index));
        };
        if length < 5 {
            return Err((Framing::Malformed, index));
        }
        if offset + length > bytes.len() {
            return Err((Framing::Truncated, index));
        }
        let document = Document::from_reader(&bytes[offset..offset + length])
            .map_err(|_| (Framing::Malformed, index))?;
        documents.push(document);
        offset += length;
    }
    Ok(documents)
}

/// Writes `<db_dir>/<collection>.bson` in the mongodump format. Used by the anonymizer and
/// the tests.
pub fn write_collection(
    db_dir: &Path,
    collection: &str,
    documents: &[Document],
) -> Result<(), SourceError> {
    std::fs::create_dir_all(db_dir).map_err(|e| SourceError::Io {
        path: db_dir.to_path_buf(),
        kind: e.kind(),
    })?;
    let path = db_dir.join(format!("{collection}.bson"));
    let mut bytes = Vec::new();
    for document in documents {
        document
            .to_writer(&mut bytes)
            .map_err(|_| SourceError::Malformed {
                path: path.clone(),
                document: 0,
            })?;
    }
    std::fs::write(&path, bytes).map_err(|e| SourceError::Io {
        path,
        kind: e.kind(),
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use bson::doc;

    #[test]
    fn documents_round_trip_in_order() {
        let dir = tempfile::tempdir().unwrap();
        let db_dir = dir.path().join("queer-augsburg");
        let docs = vec![doc! {"_id": "a", "n": 1_i64}, doc! {"_id": "b", "n": 2_i32}];
        write_collection(&db_dir, "users", &docs).unwrap();
        assert_eq!(read_collection(&db_dir, "users").unwrap(), docs);
        assert_eq!(
            list_collections(&db_dir).unwrap(),
            vec!["users".to_string()]
        );
    }

    #[test]
    fn a_missing_database_directory_is_an_error_not_empty() {
        let dir = tempfile::tempdir().unwrap();
        let err = database_dir(dir.path(), "queer-augsburg").unwrap_err();
        assert!(matches!(err, SourceError::DatabaseDirMissing(_)));
    }

    #[test]
    fn a_missing_collection_file_is_an_error_not_empty() {
        let dir = tempfile::tempdir().unwrap();
        let db_dir = dir.path().join("queer-augsburg");
        write_collection(&db_dir, "users", &[]).unwrap();
        assert!(read_collection(&db_dir, "users").unwrap().is_empty());
        let err = read_collection(&db_dir, "meetings").unwrap_err();
        assert!(matches!(err, SourceError::CollectionMissing(_)));
    }

    #[test]
    fn a_truncated_file_names_the_document_index() {
        let dir = tempfile::tempdir().unwrap();
        let db_dir = dir.path().join("queer-augsburg");
        let docs = vec![doc! {"_id": "a"}, doc! {"_id": "b"}];
        write_collection(&db_dir, "users", &docs).unwrap();
        let path = db_dir.join("users.bson");
        let mut bytes = std::fs::read(&path).unwrap();
        bytes.truncate(bytes.len() - 3);
        std::fs::write(&path, bytes).unwrap();
        let err = read_collection(&db_dir, "users").unwrap_err();
        assert!(
            matches!(err, SourceError::Truncated { document: 1, .. }),
            "{err}"
        );
    }

    #[test]
    fn error_text_holds_paths_and_kinds_only() {
        let err = SourceError::Malformed {
            path: PathBuf::from("/dump/x/users.bson"),
            document: 7,
        };
        assert_eq!(
            err.to_string(),
            "dump: malformed bson at document 7 of /dump/x/users.bson"
        );
    }
}
