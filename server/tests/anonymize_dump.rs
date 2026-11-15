//! The dump anonymizer: a planted marker in every string must not survive anywhere in the
//! output, and everything that is not a personal value must survive unchanged.

#![cfg(feature = "mongo-source")]
#![forbid(unsafe_code)]

mod drop_guard;
mod migrate_support;

use backend::document_rooms::text_of_state;
use backend::document_rules::{derive_title, sort_key};
use backend::migrate::anonymize::{anonymize_dump, AnonError};
use backend::migrate::reader::{list_collections, read_collection};
use backend::place_rules::place_name_key;
use bson::{doc, Bson, Document};
use migrate_support::{interossea_fixture, strings, write_collections, Fixture, DATABASE};
use std::collections::BTreeMap;
use std::path::Path;
use std::process::Command;

const MARKER: &str = "QXMARKERZQ";
const BOTH: [&str; 2] = ["queer-augsburg", "interossea"];

fn databases() -> Vec<String> {
    BOTH.iter().map(|d| d.to_string()).collect()
}

fn write_marked(dump: &Path) -> Fixture {
    let fixture = Fixture::marked(MARKER);
    fixture.write(dump, DATABASE);
    write_collections(dump, "interossea", &interossea_fixture(MARKER));
    fixture
}

fn read_all(dir: &Path, database: &str) -> BTreeMap<String, Vec<Document>> {
    let db_dir = dir.join(database);
    list_collections(&db_dir)
        .unwrap()
        .into_iter()
        .map(|c| {
            let docs = read_collection(&db_dir, &c).unwrap();
            (c, docs)
        })
        .collect()
}

fn all_bytes(dir: &Path) -> Vec<u8> {
    let mut bytes = Vec::new();
    for entry in walkdir(dir) {
        bytes.extend(std::fs::read(entry).unwrap());
    }
    bytes
}

fn walkdir(dir: &Path) -> Vec<std::path::PathBuf> {
    let mut files = Vec::new();
    for entry in std::fs::read_dir(dir).unwrap() {
        let path = entry.unwrap().path();
        if path.is_dir() {
            files.extend(walkdir(&path));
        } else {
            files.push(path);
        }
    }
    files.sort();
    files
}

#[test]
fn no_marker_survives_in_the_output() {
    let dump = tempfile::tempdir().unwrap();
    let out = tempfile::tempdir().unwrap();
    write_marked(dump.path());
    let marker = MARKER.as_bytes();
    assert!(
        all_bytes(dump.path())
            .windows(marker.len())
            .any(|w| w == marker),
        "the fixture is marked"
    );

    let report = anonymize_dump(dump.path(), out.path(), &databases()).unwrap();
    let bytes = all_bytes(out.path());
    assert!(
        !bytes.windows(marker.len()).any(|w| w == marker),
        "a marker survived in the output files"
    );
    let rendered = report.render();
    assert!(!rendered.contains(MARKER), "{rendered}");
    assert!(rendered.ends_with("ANONYMIZED\n"));

    // Every string of every document, including the decoded Yjs state.
    for database in BOTH {
        for (collection, documents) in read_all(out.path(), database) {
            for document in documents {
                let mut found = Vec::new();
                strings(&collection, &Bson::Document(document.clone()), &mut found);
                for (path, value) in found {
                    assert!(!value.contains(MARKER), "{database}.{path}");
                }
                if let Some(Bson::Binary(state)) = document.get("state") {
                    assert!(!text_of_state(&state.bytes).unwrap().contains(MARKER));
                }
            }
        }
    }
}

#[test]
fn ids_types_presence_timestamps_and_relations_are_kept() {
    let dump = tempfile::tempdir().unwrap();
    let out = tempfile::tempdir().unwrap();
    write_marked(dump.path());
    let report = anonymize_dump(dump.path(), out.path(), &databases()).unwrap();

    for database in BOTH {
        let before = read_all(dump.path(), database);
        let after = read_all(out.path(), database);
        assert_eq!(
            before.keys().collect::<Vec<_>>(),
            after.keys().collect::<Vec<_>>()
        );
        for (collection, originals) in &before {
            let copies = &after[collection];
            assert_eq!(originals.len(), copies.len(), "{database}.{collection}");
            assert_eq!(
                report.documents[database][collection],
                originals.len() as u64
            );
            for (original, copy) in originals.iter().zip(copies) {
                same_shape(&format!("{database}.{collection}"), original, copy);
            }
        }
    }

    // Ids and the references between records.
    let before = read_all(dump.path(), DATABASE);
    let after = read_all(out.path(), DATABASE);
    for (collection, originals) in &before {
        for (original, copy) in originals.iter().zip(&after[collection]) {
            assert_eq!(original.get("_id"), copy.get("_id"), "{collection}._id");
        }
    }
    let place_ids: Vec<&Bson> = after["places"]
        .iter()
        .map(|p| p.get("_id").unwrap())
        .collect();
    let user_ids: Vec<&Bson> = after["users"]
        .iter()
        .map(|u| u.get("_id").unwrap())
        .collect();
    for (i, meeting) in after["meetings"].iter().enumerate() {
        assert_eq!(meeting.get("status"), before["meetings"][i].get("status"));
        assert_eq!(meeting.get("time"), before["meetings"][i].get("time"));
        assert_eq!(
            meeting.get("deleted_at"),
            before["meetings"][i].get("deleted_at")
        );
        if let Some(place_id @ Bson::String(_)) = meeting.get("place_id") {
            assert!(place_ids.contains(&place_id));
        }
        if let Some(Bson::Array(changed)) = meeting.get("changed") {
            for change in changed {
                let by = change.as_document().unwrap().get("by").unwrap();
                assert!(user_ids.contains(&by) || by.as_str() == Some("unknown"));
            }
        }
    }
    for original in &after["originalUsers"] {
        assert!(user_ids.contains(&original.get("_id").unwrap()));
    }
    assert_eq!(
        after["document_group_order"][0].get_str("_id").unwrap(),
        "main"
    );
    assert_eq!(
        after["documents"][0].get_array("group_ids").unwrap()[0],
        after["document_groups"][0].get("_id").unwrap().clone()
    );
    assert_eq!(
        after["users"][0].get_array("capabilities").unwrap(),
        before["users"][0].get_array("capabilities").unwrap()
    );
    assert_eq!(
        after["users"][0]
            .get_document("member")
            .unwrap()
            .get("status"),
        before["users"][0]
            .get_document("member")
            .unwrap()
            .get("status")
    );

    // Equal emails stay equal, different ones different; the same place name maps alike.
    let email = |u: &Document| {
        u.get_document("member")
            .map(|m| m.get_str("email").unwrap().to_string())
            .ok()
    };
    let (b0, b2, b1) = (
        email(&before["users"][0]),
        email(&before["users"][2]),
        email(&before["users"][1]),
    );
    assert_eq!(b0, b2, "the fixture has a duplicate email");
    assert_ne!(b0, b1);
    let (a0, a2, a1) = (
        email(&after["users"][0]),
        email(&after["users"][2]),
        email(&after["users"][1]),
    );
    assert_eq!(a0, a2);
    assert_ne!(a0, a1);
    assert_ne!(a0, b0);
    assert_eq!(
        after["sent_email_logs"][0].get_str("sender_email").unwrap(),
        a0.as_deref().unwrap(),
        "the same email in another collection maps to the same mock"
    );
    assert_eq!(
        after["meetings"][0]
            .get_document("location")
            .unwrap()
            .get_str("name")
            .unwrap(),
        after["places"][0].get_str("name").unwrap()
    );
    let interossea = read_all(out.path(), "interossea");
    assert_eq!(
        interossea["sessions"][0].get_str("userId").unwrap(),
        interossea["users"][0].get_str("_id").unwrap()
    );
    assert_ne!(
        interossea["sessions"][0].get_str("_id").unwrap(),
        format!("{MARKER}session-secret")
    );
    assert_eq!(
        interossea["logins"][0].get_str("redirectId").unwrap(),
        interossea["redirects"][0].get_str("_id").unwrap()
    );
    assert_eq!(
        report
            .unknown_fields
            .get("queer-augsburg.users.imported_from"),
        Some(&1)
    );
    assert!(report.skipped_databases.is_empty());
}

/// Same keys in the same order, same types, same non-string scalars.
fn same_shape(path: &str, original: &Document, copy: &Document) {
    let original_keys: Vec<&String> = original.keys().collect();
    let copy_keys: Vec<&String> = copy.keys().collect();
    assert_eq!(original_keys, copy_keys, "{path}");
    for (key, value) in original {
        let child = format!("{path}.{key}");
        same_value(&child, value, copy.get(key).unwrap());
    }
}

fn same_value(path: &str, original: &Bson, copy: &Bson) {
    assert_eq!(original.element_type(), copy.element_type(), "{path}");
    match (original, copy) {
        (Bson::Document(a), Bson::Document(b)) => same_shape(path, a, b),
        (Bson::Array(a), Bson::Array(b)) => {
            assert_eq!(a.len(), b.len(), "{path}");
            for (x, y) in a.iter().zip(b) {
                same_value(&format!("{path}[]"), x, y);
            }
        }
        (Bson::String(_), Bson::String(_)) | (Bson::Binary(_), Bson::Binary(_)) => {}
        _ => assert_eq!(original, copy, "{path}"),
    }
}

#[test]
fn derived_fields_agree_with_their_mocks() {
    let dump = tempfile::tempdir().unwrap();
    let out = tempfile::tempdir().unwrap();
    write_marked(dump.path());
    anonymize_dump(dump.path(), out.path(), &[DATABASE.to_string()]).unwrap();
    let after = read_all(out.path(), DATABASE);
    for place in &after["places"] {
        assert_eq!(
            place.get_str("name_key").unwrap(),
            place_name_key(place.get_str("name").unwrap())
        );
    }
    for group in &after["document_groups"] {
        assert_eq!(
            group.get_str("name_key").unwrap(),
            sort_key(group.get_str("name").unwrap())
        );
    }
    for document in &after["documents"] {
        let content = document.get_str("content").unwrap();
        assert_eq!(document.get_str("title").unwrap(), derive_title(content));
        let state = document.get_binary_generic("state").unwrap();
        assert_eq!(text_of_state(state).unwrap(), content);
    }
    assert!(!out
        .path()
        .join(DATABASE)
        .join("users.metadata.json")
        .exists());
}

#[test]
fn unknown_databases_types_and_existing_output_are_errors() {
    let dump = tempfile::tempdir().unwrap();
    let out = tempfile::tempdir().unwrap();
    write_marked(dump.path());
    let err = anonymize_dump(dump.path(), out.path(), &["admin".to_string()]).unwrap_err();
    assert!(matches!(err, AnonError::UnknownDatabase(_)), "{err}");

    let mut fixture = Fixture::marked(MARKER);
    fixture
        .doc("users", 0)
        .insert("pattern", Bson::Symbol(format!("{MARKER}x")));
    fixture.write(dump.path(), DATABASE);
    let err = anonymize_dump(dump.path(), out.path(), &[DATABASE.to_string()]).unwrap_err();
    let text = err.to_string();
    assert_eq!(
        text,
        "queer-augsburg: unexpected type symbol at users.pattern"
    );
    assert!(
        !out.path().join(DATABASE).exists(),
        "nothing is written for a failed database"
    );

    write_marked(dump.path());
    anonymize_dump(dump.path(), out.path(), &[DATABASE.to_string()]).unwrap();
    let err = anonymize_dump(dump.path(), out.path(), &[DATABASE.to_string()]).unwrap_err();
    assert!(matches!(err, AnonError::OutputExists(_)), "{err}");

    let other = tempfile::tempdir().unwrap();
    std::fs::create_dir(dump.path().join("admin")).unwrap();
    let report = anonymize_dump(dump.path(), other.path(), &[DATABASE.to_string()]).unwrap();
    assert_eq!(
        report.skipped_databases,
        vec!["admin".to_string(), "interossea".to_string()]
    );
}

#[test]
fn the_binary_prints_counts_only() {
    let dump = tempfile::tempdir().unwrap();
    let out = tempfile::tempdir().unwrap();
    write_marked(dump.path());
    let output = Command::new(env!("CARGO_BIN_EXE_anonymize-dump"))
        .arg(dump.path())
        .arg(out.path())
        .output()
        .unwrap();
    let stdout = String::from_utf8_lossy(&output.stdout);
    let stderr = String::from_utf8_lossy(&output.stderr);
    assert_eq!(output.status.code(), Some(0), "{stdout}{stderr}");
    assert!(
        !stdout.contains(MARKER) && !stderr.contains(MARKER),
        "{stdout}{stderr}"
    );
    assert!(stdout.contains("database queer-augsburg:"), "{stdout}");
    assert!(stdout.contains("database interossea:"), "{stdout}");
    assert!(stdout.contains("  Email "), "{stdout}");
    assert!(stdout.ends_with("ANONYMIZED\n"), "{stdout}");
    let marker = MARKER.as_bytes();
    assert!(!all_bytes(out.path())
        .windows(marker.len())
        .any(|w| w == marker));

    let output = Command::new(env!("CARGO_BIN_EXE_anonymize-dump"))
        .arg(dump.path())
        .output()
        .unwrap();
    assert_eq!(output.status.code(), Some(2));
    assert!(String::from_utf8_lossy(&output.stderr).starts_with("usage:"));

    let _ = doc! {};
}
