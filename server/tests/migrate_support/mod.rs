//! Generated dumps of the shapes `data-shape.md` found in production (counts and types; no
//! value here comes from anywhere but this file), a throwaway database per test, and a
//! marker transform that plants a string in every value to prove nothing of it is printed.
//! The crate declares `mod drop_guard;` for [`TestDb`]'s destructor.

#![allow(dead_code)]

use crate::drop_guard::remove_after_test;
use backend::document_rooms::initial_state;
use backend::document_rules::sort_key;
use backend::migrate::config::Config;
use backend::migrate::reader::write_collection;
use backend::migrate::report::COLLECTIONS;
use backend::place_rules::place_name_key;
use bson::{doc, Binary, Bson, Document};
use sqlx::postgres::{PgConnectOptions, PgConnection};
use sqlx::{AssertSqlSafe, Connection};
use std::collections::BTreeMap;
use std::path::Path;
use std::sync::{Mutex, PoisonError};

pub const DATABASE: &str = "queer-augsburg";

/// Timestamps as the server writes them: Int64 milliseconds.
pub const T0: i64 = 1_730_000_000_000;

pub fn id(prefix: &str, len: usize) -> String {
    let mut s = prefix.to_string();
    while s.len() < len {
        s.push('x');
    }
    s
}

pub fn state_of(text: &str) -> Bson {
    Bson::Binary(Binary {
        subtype: bson::spec::BinarySubtype::Generic,
        bytes: initial_state(text),
    })
}

fn member(email: &str, status: &str, first: &str) -> Document {
    doc! {
        "type": "Active",
        "natural_person": true,
        "name": {"passport": format!("{first} Beispiel"), "first_name": first, "last_name": "Beispiel"},
        "institution": Bson::Null,
        "pronouns": "sie/ihr",
        "address": {"street": "Beispielweg", "number": "1", "addition": Bson::Null,
                    "zip": "86150", "city": "Augsburg", "country": "Deutschland"},
        "email": email,
        "phone": "+49 821 000000",
        "start_time_ms": T0,
        "end_time_ms": Bson::Null,
        "status": status,
        "user_notes": "gern dabei",
        "admin_notes": Bson::Null,
        "reference": Bson::Null,
        "approved_charter": true,
        "approved_privacy": true,
        "above_18": true,
        "honorary": false,
    }
}

/// A dump with every shape of `data-shape.md`: the four id lengths, missing against null,
/// `location` without a `place_id` key, `changed` missing, `online` null and object,
/// unknown user fields, a deleted document, versions, an email draft.
pub struct Fixture {
    pub collections: BTreeMap<&'static str, Vec<Document>>,
}

impl Fixture {
    pub fn shaped() -> Self {
        let u16 = id("u16-", 16);
        let u32 = id("u32-", 32);
        let u30 = id("u30-", 30);
        let u26 = id("u26-", 26);
        let mut c: BTreeMap<&'static str, Vec<Document>> = BTreeMap::new();

        let mut full = member("anna@example.org", "Approved", "Anna");
        full.insert(
            "address",
            doc! {"street": "Beispielweg", "number": "1", "addition": "Hinterhaus",
            "zip": "86150", "city": "Augsburg", "country": "Deutschland"},
        );
        full.insert("reference", "Flyer");
        full.insert("admin_notes", "ok");
        full.insert("end_time_ms", T0 + 10);
        let mut sparse = member("bo@example.org", "Pending", "Bo");
        sparse.remove("end_time_ms");
        sparse.remove("phone");
        sparse.insert("pronouns", Bson::Null);
        sparse.insert("user_notes", Bson::Null);
        sparse.insert("above_18", false);
        let mut supporting = member("anna@example.org", "Left", "Cem");
        supporting.insert("type", "Supporting");
        supporting.insert("honorary", true);
        // An association: every flag of a member differs from another one somewhere in the
        // fixture, so a mapping that mixes two of them up shows.
        let mut association = member("dee@example.org", "Rejected", "Dee");
        association.insert("natural_person", false);
        association.insert("institution", "Beispiel e.V.");
        association.insert("approved_privacy", false);
        c.insert(
            "users",
            vec![
                doc! {"_id": &u16, "member": full.clone(), "capabilities": ["UpdateMeetings", "GetUsers"], "admin": true},
                doc! {"_id": &u32, "member": sparse.clone(), "capabilities": Bson::Null},
                doc! {"_id": &u30, "member": supporting.clone(), "admin": false, "imported_from": "papier 2024"},
                doc! {"_id": &u26, "member": Bson::Null, "capabilities": []},
                doc! {"_id": id("u16b", 16), "member": association, "capabilities": ["UpdateDocuments"], "admin": true},
            ],
        );
        c.insert(
            "originalUsers",
            vec![
                doc! {"_id": &u16, "member": full, "capabilities": Bson::Null, "admin": true},
                doc! {"_id": &u30, "member": supporting, "admin": false},
            ],
        );

        let place = |pid: &str, name: &str, by: &str| {
            doc! {"_id": pid, "name": name, "name_key": place_name_key(name), "lat": 48.37, "lon": 10.9,
            "created": {"by": by, "at": T0 + 1}}
        };
        c.insert(
            "places",
            vec![
                place("p0001", "Henry‘s  Coffee", &u16),
                place("p0002", "Zentrum", &u16),
                place("p0003", "Rathausplatz", &u30),
            ],
        );

        let tags = |free: Vec<&str>| doc! {"freeform": free, "common": ["Party"], "queer": ["Queer", "Trans"]};
        c.insert(
            "meetings",
            vec![
                // Everything present; `place_to_be_announced` missing as in 462 of 465.
                doc! {"_id": "m0001", "title": "Stammtisch", "authority": "QA", "age_restriction": [18_i32],
                      "time": T0 + 100, "location": {"name": "Henry‘s  Coffee", "lat": 48.37, "lon": 10.9},
                      "place_id": "p0001", "online": Bson::Null, "description": "Beschreibung", "price": [0.0, 2.5],
                      "trigger_warning": "laut", "attendance": 12_i32, "rating": Bson::Null, "accessibility": Bson::Null,
                      "tags": tags(vec!["bar"]), "status": "Active",
                      "changed": [{"by": &u16, "at": T0 + 2}, {"by": &u30, "at": T0 + 3}],
                      "cancelled": false, "deleted_at": Bson::Null},
                // Before places existed: location without a `place_id` key, no history.
                doc! {"_id": "m0002", "title": "Altes Treffen", "authority": "QA", "age_restriction": [],
                      "time": T0 - 1_000_000, "location": {"name": "Zentrum", "lat": 48.0, "lon": 10.0},
                      "description": "", "price": [], "trigger_warning": Bson::Null, "attendance": Bson::Null,
                      "rating": 4.5, "accessibility": "stufenlos",
                      "tags": doc! {"freeform": [], "common": [], "queer": []}, "status": "Active"},
                // Online only, deleted, cancelled null, place announced later.
                doc! {"_id": "m0003", "title": "Online", "authority": "QA", "age_restriction": [16_i32, 18_i32],
                      "time": T0 + 200, "location": Bson::Null, "place_id": Bson::Null,
                      "online": {"platform": "Jitsi", "url": Bson::Null, "members_only": true},
                      "place_to_be_announced": true, "description": "x", "price": [1.5],
                      "trigger_warning": Bson::Null, "attendance": Bson::Null, "rating": Bson::Null,
                      "accessibility": Bson::Null, "tags": tags(vec![]), "status": "Active",
                      "changed": [{"by": "unknown", "at": T0 + 4}], "cancelled": Bson::Null, "deleted_at": T0 + 5},
                // Planned, hybrid with a stored link, `url_hidden` once stored.
                doc! {"_id": "m0004", "title": "Hybrid", "authority": "QA", "age_restriction": [],
                      "time": Bson::Null, "location": {"name": "Zentrum", "lat": 48.0, "lon": 10.0}, "place_id": "p0002",
                      "online": {"platform": "Zoom", "url": "https://example.org/geheim", "members_only": true, "url_hidden": true},
                      "description": "y", "price": [], "trigger_warning": Bson::Null, "attendance": 3_i64,
                      "rating": Bson::Null, "accessibility": Bson::Null, "tags": tags(vec!["a", "b"]),
                      "status": "Planned", "changed": [], "cancelled": true, "deleted_at": Bson::Null},
            ],
        );

        c.insert(
            "sent_email_logs",
            vec![
                doc! {"_id": id("log1", 16), "sender_id": &u16, "sender_email": "anna@example.org", "subject": "Hallo",
                      "body": "Text", "attachment_names": ["a.pdf"], "sent_at": T0 + 6, "successful_count": 2_i64,
                      "failed_count": 1_i64, "failed_emails": ["dee@example.org"], "reply_to": "anna@example.org"},
                doc! {"_id": id("log2", 16), "sender_id": &u16, "sender_email": "anna@example.org", "subject": "Zwei",
                      "body": "", "attachment_names": [], "sent_at": T0 + 7, "successful_count": 0_i64,
                      "failed_count": 0_i64, "failed_emails": [], "reply_to": Bson::Null},
            ],
        );
        c.insert(
            "email_drafts",
            vec![doc! {"_id": id("draft", 16), "sender_id": &u16, "sender_email": "anna@example.org", "subject": "Entwurf",
                       "body": "Inhalt", "attachments": [{"filename": "a.txt", "content_type": "text/plain", "data": "YQ=="}],
                       "verification_code": "123456", "created_at": T0 + 8, "recipient_count": 3_i64,
                       "status": "Pending", "reply_to": "anna@example.org"}],
        );

        let text = "# Satzung\n\nDer Verein.";
        c.insert(
            "documents",
            vec![
                doc! {"_id": id("doc1", 10), "title": "Satzung", "content": text, "state": state_of(text),
                      "state_version": 3_i64, "group_ids": [id("grp1", 10)], "created_by": &u16,
                      "created_at": T0 + 9, "updated_at": T0 + 10, "deleted_by": Bson::Null, "deleted_at": Bson::Null},
                doc! {"_id": id("doc2", 10), "title": "Alt", "content": "Alt", "state": state_of("Alt"),
                      "state_version": 1_i64, "group_ids": [], "created_by": &u30,
                      "created_at": T0 + 11, "updated_at": T0 + 12, "deleted_by": &u16, "deleted_at": T0 + 13},
            ],
        );
        c.insert(
            "document_groups",
            vec![
                doc! {"_id": id("grp1", 10), "name": "Verein", "name_key": sort_key("Verein"),
                "document_order": [id("doc1", 10), id("gone", 10)]},
            ],
        );
        c.insert(
            "document_group_order",
            vec![doc! {"_id": "main", "group_ids": [id("grp1", 10)]}],
        );
        c.insert(
            "document_versions",
            vec![
                doc! {"_id": id("ver1", 12), "document_id": id("doc1", 10), "content": "# Satzung\n\nAlt",
                      "editors": [&u16, &u30], "saved_at": T0 + 14},
                doc! {"_id": id("ver2", 12), "document_id": id("doc1", 10), "content": text,
                      "editors": [&u16], "saved_at": T0 + 15},
            ],
        );
        Self { collections: c }
    }

    /// Plants `marker` into every personal value (every string that is not an id or an enum
    /// value), keeping the shapes valid: keys and states are recomputed.
    pub fn marked(marker: &str) -> Self {
        Self::mark(marker, false)
    }

    /// Plants `marker` into every string, the ids included.
    pub fn marked_with_ids(marker: &str) -> Self {
        Self::mark(marker, true)
    }

    fn mark(marker: &str, ids: bool) -> Self {
        let mut fixture = Self::shaped();
        for (collection, documents) in fixture.collections.iter_mut() {
            for document in documents.iter_mut() {
                mark_document(collection, "", document, marker, ids);
                match *collection {
                    "places" => {
                        let name = document.get_str("name").unwrap().to_string();
                        document.insert("name_key", place_name_key(&name));
                    }
                    "document_groups" => {
                        let name = document.get_str("name").unwrap().to_string();
                        document.insert("name_key", sort_key(&name));
                    }
                    "documents" => {
                        let content = document.get_str("content").unwrap().to_string();
                        document.insert("state", state_of(&content));
                    }
                    _ => {}
                }
            }
        }
        fixture
    }

    pub fn write(&self, dump_dir: &Path, database: &str) {
        let db_dir = dump_dir.join(database);
        for (collection, documents) in &self.collections {
            write_collection(&db_dir, collection, documents).unwrap();
        }
    }

    pub fn counts(&self) -> BTreeMap<String, u64> {
        COLLECTIONS
            .iter()
            .map(|c| {
                (
                    c.to_string(),
                    self.collections.get(c).map_or(0, |d| d.len() as u64),
                )
            })
            .collect()
    }

    pub fn config(&self, dump_dir: &Path) -> Config {
        Config {
            dump_dir: dump_dir.to_path_buf(),
            database: DATABASE.to_string(),
            expected_counts: self.counts(),
            ignored_fields: BTreeMap::new(),
        }
    }

    pub fn doc(&mut self, collection: &str, index: usize) -> &mut Document {
        &mut self.collections.get_mut(collection).unwrap()[index]
    }

    pub fn push(&mut self, collection: &'static str, document: Document) {
        self.collections
            .entry(collection)
            .or_default()
            .push(document);
    }
}

/// Paths whose strings are enum values or the fixed group order id.
fn is_enum_path(collection: &str, path: &str) -> bool {
    matches!(
        (collection, path),
        (
            "users" | "originalUsers",
            "capabilities[]" | "member.type" | "member.status"
        ) | ("meetings", "status" | "tags.common[]" | "tags.queer[]")
            | ("email_drafts", "status")
            | ("document_group_order", "_id")
    )
}

/// Paths whose strings are ids or references to ids.
fn is_id_path(path: &str) -> bool {
    matches!(
        path,
        "_id"
            | "place_id"
            | "changed[].by"
            | "created.by"
            | "created_by"
            | "deleted_by"
            | "group_ids[]"
            | "document_order[]"
            | "document_id"
            | "editors[]"
            | "sender_id"
    )
}

fn mark_value(collection: &str, path: &str, value: &mut Bson, marker: &str, ids: bool) {
    match value {
        Bson::String(s) => {
            if !is_enum_path(collection, path) && (ids || !is_id_path(path)) {
                *s = format!("{marker}{s}");
            }
        }
        Bson::Document(inner) => mark_document(collection, path, inner, marker, ids),
        Bson::Array(items) => {
            let element = format!("{path}[]");
            for item in items {
                mark_value(collection, &element, item, marker, ids);
            }
        }
        _ => {}
    }
}

fn mark_document(collection: &str, path: &str, document: &mut Document, marker: &str, ids: bool) {
    for (key, value) in document.iter_mut() {
        let child = if path.is_empty() {
            key.clone()
        } else {
            format!("{path}.{key}")
        };
        mark_value(collection, &child, value, marker, ids);
    }
}

/// Every string in a document tree, with its path.
pub fn strings(path: &str, value: &Bson, out: &mut Vec<(String, String)>) {
    match value {
        Bson::String(s) => out.push((path.to_string(), s.clone())),
        Bson::Document(inner) => {
            for (key, value) in inner {
                let child = if path.is_empty() {
                    key.clone()
                } else {
                    format!("{path}.{key}")
                };
                strings(&child, value, out);
            }
        }
        Bson::Array(items) => {
            for item in items {
                strings(&format!("{path}[]"), item, out);
            }
        }
        _ => {}
    }
}

/// The interossea database as `interossea-shape.txt` describes it.
pub fn interossea_fixture(marker: &str) -> BTreeMap<&'static str, Vec<Document>> {
    let user = id("iu1-", 16);
    let mut c: BTreeMap<&'static str, Vec<Document>> = BTreeMap::new();
    c.insert(
        "users",
        vec![doc! {"_id": &user, "admin": false, "webauthnDevices": Bson::Null, "webauthnEnabled": false,
                   "userdata": Bson::Null, "email": format!("{marker}anna@example.org"), "totpSecret": Bson::Null,
                   "time": T0, "totpEnabled": false, "webauthnRegistrationChallenge": Bson::Null}],
    );
    c.insert(
        "sessions",
        vec![
            doc! {"_id": format!("{marker}session-secret"), "time": T0 + 1, "userId": &user,
            "ip": format!("{marker}10.0.0.7"), "rml": true},
        ],
    );
    c.insert(
        "logins",
        vec![
            doc! {"_id": "login1", "useCount": 1_i64, "redirectId": "r1",
            "ip": format!("{marker}10.0.0.8"), "preSessionId": format!("{marker}pre"),
            "emailToken": format!("{marker}tok"), "time": T0 + 2},
        ],
    );
    c.insert(
        "redirects",
        vec![doc! {"_id": "r1", "to": format!("https://{marker}.example.org/")}],
    );
    c.insert(
        "deniedContacts",
        vec![
            doc! {"_id": bson::oid::ObjectId::new(), "email": format!("{marker}spam@example.org")},
        ],
    );
    c
}

pub fn write_collections(
    dump_dir: &Path,
    database: &str,
    collections: &BTreeMap<&'static str, Vec<Document>>,
) {
    let db_dir = dump_dir.join(database);
    for (collection, documents) in collections {
        write_collection(&db_dir, collection, documents).unwrap();
    }
}

/// A database of its own per test, and the roles [`TestDb::app_role`] made for it. A test ends
/// with [`TestDb::drop`]; one that panics, or returns before it, or whose `TestDb::drop` fails,
/// still leaves neither behind: `Drop` removes them then, as `db_support::TestSchema`'s guard
/// does its schema, with the same limits. One guard owns both because of the order: a role
/// cannot be dropped while it owns objects in the database or holds rights on it, so the
/// database goes first. A role with rights outside its test's database (none of the tests
/// grants any) is not removed, and the guard says so. `None` without a server, outside CI.
pub struct TestDb {
    pub url: String,
    maintenance: PgConnectOptions,
    name: String,
    /// The roles of [`Self::app_role`], dropped after the database.
    roles: Mutex<Vec<String>>,
    /// Set by [`Self::drop`]; until then `Drop` removes the database and the roles.
    removed: bool,
    /// Set by [`Self::fail_removal_after`].
    fail_after: Option<usize>,
}

impl TestDb {
    pub async fn new() -> Option<Self> {
        let Ok(url) = std::env::var("TEST_DATABASE_URL") else {
            assert!(
                std::env::var("CI").is_err(),
                "CI must set TEST_DATABASE_URL"
            );
            eprintln!("skipped: TEST_DATABASE_URL is not set");
            return None;
        };
        let maintenance: PgConnectOptions = url.parse().unwrap();
        let name = format!(
            "qa_migrate_{}",
            backend::utils::generate_id(12)
                .to_lowercase()
                .replace('-', "a")
        );
        let mut connection = PgConnection::connect_with(&maintenance).await.unwrap();
        sqlx::query(AssertSqlSafe(format!("CREATE DATABASE \"{name}\"")))
            .execute(&mut connection)
            .await
            .unwrap();
        connection.close().await.unwrap();
        let mut parsed = url::Url::parse(&url).unwrap();
        parsed.set_path(&format!("/{name}"));
        Some(Self {
            url: parsed.to_string(),
            maintenance,
            name,
            roles: Mutex::default(),
            removed: false,
            fail_after: None,
        })
    }

    pub fn name(&self) -> &str {
        &self.name
    }

    pub async fn connect(&self) -> PgConnection {
        PgConnection::connect(&self.url).await.unwrap()
    }

    /// After every pool and connection of the test is closed. If it fails, `Drop` repeats the
    /// whole removal.
    pub async fn drop(mut self) {
        let roles = self
            .roles
            .lock()
            .unwrap_or_else(PoisonError::into_inner)
            .clone();
        remove(&self.maintenance, &self.name, &roles, self.fail_after)
            .await
            .unwrap();
        self.removed = true;
    }

    /// [`Self::drop`] fails once `statements` of its statements have succeeded (`DROP DATABASE`,
    /// then a `DROP ROLE` per role), as when the connection is lost before the next, so `Drop`
    /// repeats a removal that is partly done; for the harness's own tests.
    pub fn fail_removal_after(&mut self, statements: usize) {
        self.fail_after = Some(statements);
    }

    fn take_roles(&self) -> Vec<String> {
        std::mem::take(&mut self.roles.lock().unwrap_or_else(PoisonError::into_inner))
    }

    /// A login role of its own with exactly the rights `deployment/templates/config/pg-init.sql`
    /// gives `qa_app` on its database: what the migrator and the server connect as on turing.
    /// It goes with the database, after it.
    pub async fn app_role(&self) -> AppRole {
        let name = format!(
            "qa_app_{}",
            backend::utils::generate_id(12)
                .to_lowercase()
                .replace(['-', '_'], "a")
        );
        // 64 letters and digits, as deployment/add-postgres-secrets.sh generates and
        // pg-init.sql insists on (the server pastes the password into db.url unencoded).
        let password = backend::utils::generate_id(64)
            .replace('-', "7")
            .replace('_', "3");
        let mut cluster = PgConnection::connect_with(&self.maintenance).await.unwrap();
        sqlx::query(AssertSqlSafe(format!(
            "CREATE ROLE \"{name}\" LOGIN PASSWORD '{password}'"
        )))
        .execute(&mut cluster)
        .await
        .unwrap();
        cluster.close().await.unwrap();
        self.roles
            .lock()
            .unwrap_or_else(PoisonError::into_inner)
            .push(name.clone());
        // The grants of pg-init.sql, in the database they are for. As there: no default
        // privileges, and schema public stays the database owner's.
        let mut database = self.connect().await;
        for statement in [
            format!("REVOKE ALL ON DATABASE \"{}\" FROM PUBLIC", self.name),
            format!(
                "GRANT CONNECT, TEMPORARY ON DATABASE \"{}\" TO \"{name}\"",
                self.name
            ),
            format!("GRANT USAGE, CREATE ON SCHEMA public TO \"{name}\""),
        ] {
            sqlx::query(AssertSqlSafe(statement))
                .execute(&mut database)
                .await
                .unwrap();
        }
        database.close().await.unwrap();
        let mut url = url::Url::parse(&self.url).unwrap();
        url.set_username(&name).unwrap();
        url.set_password(Some(&password)).unwrap();
        AppRole {
            url: url.to_string(),
            name,
        }
    }
}

impl Drop for TestDb {
    /// A test that panicked or returned before [`TestDb::drop`]; the removal runs as
    /// [`remove_after_test`] describes. `WITH (FORCE)` ends the sessions the test left in its
    /// database first, the role's among them.
    fn drop(&mut self) {
        if self.removed {
            return;
        }
        let (maintenance, name, roles) = (
            self.maintenance.clone(),
            self.name.clone(),
            self.take_roles(),
        );
        remove_after_test(
            &format!(
                "migrate_support: database {} with roles {roles:?}",
                self.name
            ),
            move || async move {
                remove(&maintenance, &name, &roles, None).await?;
                Ok(format!(
                    "migrate_support: removed database {name} and roles {roles:?} after the \
                     test ended without TestDb::drop"
                ))
            },
        );
    }
}

/// `DROP DATABASE … WITH (FORCE)`, which ends the database's sessions, then `DROP ROLE` for
/// each role, which only works once nothing in the database depends on it. Each with
/// `IF EXISTS`, so a repeat of a removal that failed partway does the rest. `fail_after`: see
/// [`TestDb::fail_removal_after`].
async fn remove(
    maintenance: &PgConnectOptions,
    name: &str,
    roles: &[String],
    fail_after: Option<usize>,
) -> Result<(), sqlx::Error> {
    let mut connection = PgConnection::connect_with(maintenance).await?;
    let mut statements = vec![format!("DROP DATABASE IF EXISTS \"{name}\" WITH (FORCE)")];
    statements.extend(
        roles
            .iter()
            .map(|role| format!("DROP ROLE IF EXISTS \"{role}\"")),
    );
    for (done, statement) in statements.into_iter().enumerate() {
        if fail_after == Some(done) {
            return Err(sqlx::Error::Protocol(format!(
                "the planned failure after {done} of its statements"
            )));
        }
        sqlx::query(AssertSqlSafe(statement))
            .execute(&mut connection)
            .await?;
    }
    connection.close().await
}

/// See [`TestDb::app_role`].
pub struct AppRole {
    pub name: String,
    /// `postgres://<name>:<password>@<host>/<test database>`, the form of `db.url`.
    pub url: String,
}

/// The server `TEST_DATABASE_URL` names, for the checks of the harness itself.
async fn maintenance() -> PgConnection {
    let options: PgConnectOptions = std::env::var("TEST_DATABASE_URL").unwrap().parse().unwrap();
    PgConnection::connect_with(&options).await.unwrap()
}

/// Whether a database of this name exists on the server.
pub async fn database_exists(name: &str) -> bool {
    let mut connection = maintenance().await;
    let exists = sqlx::query_scalar("SELECT EXISTS (SELECT FROM pg_database WHERE datname = $1)")
        .bind(name)
        .fetch_one(&mut connection)
        .await
        .unwrap();
    connection.close().await.unwrap();
    exists
}

/// Whether a role of this name exists on the server.
pub async fn role_exists(name: &str) -> bool {
    let mut connection = maintenance().await;
    let exists = sqlx::query_scalar("SELECT EXISTS (SELECT FROM pg_roles WHERE rolname = $1)")
        .bind(name)
        .fetch_one(&mut connection)
        .await
        .unwrap();
    connection.close().await.unwrap();
    exists
}

/// The sessions on the server logged in as this role.
pub async fn sessions_of(role: &str) -> i64 {
    let mut connection = maintenance().await;
    let count = sqlx::query_scalar("SELECT count(*) FROM pg_stat_activity WHERE usename = $1")
        .bind(role)
        .fetch_one(&mut connection)
        .await
        .unwrap();
    connection.close().await.unwrap();
    count
}

/// Writes the config as the binary reads it.
pub fn write_config(config: &Config, path: &Path) {
    use std::fmt::Write;
    let mut yaml = String::new();
    let _ = writeln!(yaml, "dump_dir: {}", config.dump_dir.display());
    let _ = writeln!(yaml, "database: {}", config.database);
    let _ = writeln!(yaml, "expected_counts:");
    for (collection, count) in &config.expected_counts {
        let _ = writeln!(yaml, "  {collection}: {count}");
    }
    if !config.ignored_fields.is_empty() {
        let _ = writeln!(yaml, "ignored_fields:");
        for (collection, fields) in &config.ignored_fields {
            let _ = writeln!(yaml, "  {collection}: [{}]", fields.join(", "));
        }
    }
    std::fs::write(path, yaml).unwrap();
}
