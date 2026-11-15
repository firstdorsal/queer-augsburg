//! A copy of a mongodump directory with every personal value replaced by generated mock
//! data, for rehearsals and debugging away from production. What stays: ids and the
//! references between records, enum values, booleans, numbers, timestamps, nulls, missing
//! keys, the order of keys and the counts. Every string that is not allow-listed as an id or
//! an enum is replaced, also in fields nobody knows, so a new field cannot leak by default.
//! Equal values get equal mocks within a kind, so two members with one email stay two
//! members with one email.

use super::reader::{self, SourceError};
use crate::document_rooms::initial_state;
use crate::document_rules::{derive_title, sort_key};
use crate::place_rules::place_name_key;
use base64::Engine;
use bson::{Binary, Bson, Document};
use std::collections::{BTreeMap, HashMap};
use std::fmt;
use std::path::{Path, PathBuf};

/// The databases of the backup whose shapes are known (`.plans/postgres-own-auth/shape/`).
pub const DATABASES: [&str; 2] = ["queer-augsburg", "interossea"];

#[derive(Debug)]
pub enum AnonError {
    Source(SourceError),
    /// The output directory of a database exists already; nothing is overwritten.
    OutputExists(PathBuf),
    /// A database the anonymizer has no rules for.
    UnknownDatabase(String),
    /// A value of a type the anonymizer does not handle, by database, path and type.
    UnexpectedType {
        database: String,
        path: String,
        found: &'static str,
    },
}

impl fmt::Display for AnonError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            AnonError::Source(e) => write!(f, "{e}"),
            AnonError::OutputExists(path) => {
                write!(f, "output exists already: {}", path.display())
            }
            AnonError::UnknownDatabase(name) => write!(f, "no rules for database {name}"),
            AnonError::UnexpectedType {
                database,
                path,
                found,
            } => write!(f, "{database}: unexpected type {found} at {path}"),
        }
    }
}

impl std::error::Error for AnonError {}

impl From<SourceError> for AnonError {
    fn from(e: SourceError) -> Self {
        AnonError::Source(e)
    }
}

/// What a string field holds, which decides the shape of its mock.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, PartialOrd, Ord)]
enum Kind {
    Email,
    FirstName,
    LastName,
    Passport,
    Institution,
    Pronouns,
    Street,
    HouseNumber,
    Addition,
    Zip,
    City,
    Country,
    Phone,
    Notes,
    Reference,
    Title,
    Authority,
    Description,
    Trigger,
    Accessibility,
    Freeform,
    PlaceName,
    Platform,
    Url,
    Subject,
    Body,
    Filename,
    ContentType,
    Base64,
    Code,
    Content,
    GroupName,
    Ip,
    Token,
    /// A string at a path no rule names.
    Text,
}

enum Class {
    /// An id, a reference or an enum value: copied.
    Keep,
    Replace(Kind),
}

/// The rule for a string at `path` (`collection.field.sub`, `[]` for array elements) of
/// `database`. Anything not named here is `Text`.
fn classify(database: &str, path: &str) -> Class {
    use Class::*;
    use Kind::*;
    // The archive holds users as they were submitted: the same rules.
    let path = path
        .strip_prefix("originalUsers.")
        .map_or(path.to_string(), |rest| format!("users.{rest}"));
    let path = path.as_str();
    if database == "queer-augsburg" {
        return match path {
            "users._id"
            | "meetings._id"
            | "places._id"
            | "documents._id"
            | "document_groups._id"
            | "document_group_order._id"
            | "document_versions._id"
            | "email_drafts._id"
            | "sent_email_logs._id"
            | "users.capabilities[]"
            | "users.member.type"
            | "users.member.status"
            | "meetings.place_id"
            | "meetings.changed[].by"
            | "meetings.status"
            | "meetings.tags.common[]"
            | "meetings.tags.queer[]"
            | "places.created.by"
            | "documents.group_ids[]"
            | "documents.created_by"
            | "documents.deleted_by"
            | "document_groups.document_order[]"
            | "document_group_order.group_ids[]"
            | "document_versions.document_id"
            | "document_versions.editors[]"
            | "email_drafts.sender_id"
            | "email_drafts.status"
            | "sent_email_logs.sender_id" => Keep,
            "users.member.email"
            | "email_drafts.sender_email"
            | "email_drafts.reply_to"
            | "sent_email_logs.sender_email"
            | "sent_email_logs.reply_to"
            | "sent_email_logs.failed_emails[]" => Replace(Email),
            "users.member.name.first_name" => Replace(FirstName),
            "users.member.name.last_name" => Replace(LastName),
            "users.member.name.passport" => Replace(Passport),
            "users.member.institution" => Replace(Institution),
            "users.member.pronouns" => Replace(Pronouns),
            "users.member.phone" => Replace(Phone),
            "users.member.user_notes" | "users.member.admin_notes" => Replace(Notes),
            "users.member.reference" => Replace(Reference),
            "users.member.address.street" => Replace(Street),
            "users.member.address.number" => Replace(HouseNumber),
            "users.member.address.addition" => Replace(Addition),
            "users.member.address.zip" => Replace(Zip),
            "users.member.address.city" => Replace(City),
            "users.member.address.country" => Replace(Country),
            "meetings.title" | "documents.title" => Replace(Title),
            "meetings.authority" => Replace(Authority),
            "meetings.description" => Replace(Description),
            "meetings.trigger_warning" => Replace(Trigger),
            "meetings.accessibility" => Replace(Accessibility),
            "meetings.tags.freeform[]" => Replace(Freeform),
            "meetings.location.name" | "places.name" | "places.name_key" => Replace(PlaceName),
            "meetings.online.platform" => Replace(Platform),
            "meetings.online.url" => Replace(Url),
            "documents.content" | "document_versions.content" => Replace(Content),
            "document_groups.name" | "document_groups.name_key" => Replace(GroupName),
            "email_drafts.subject" | "sent_email_logs.subject" => Replace(Subject),
            "email_drafts.body" | "sent_email_logs.body" => Replace(Body),
            "email_drafts.verification_code" => Replace(Code),
            "email_drafts.attachments[].filename" | "sent_email_logs.attachment_names[]" => {
                Replace(Filename)
            }
            "email_drafts.attachments[].content_type" => Replace(ContentType),
            "email_drafts.attachments[].data" => Replace(Base64),
            _ => Replace(Text),
        };
    }
    if database == "interossea" {
        return match path {
            "users._id" | "logins._id" | "logins.redirectId" | "redirects._id"
            | "sessions.userId" => Keep,
            "users.email" | "deniedContacts.email" => Replace(Email),
            "logins.ip" | "sessions.ip" => Replace(Ip),
            "logins.preSessionId" | "logins.emailToken" | "sessions._id" | "users.totpSecret" => {
                Replace(Token)
            }
            "redirects.to" => Replace(Url),
            _ => Replace(Text),
        };
    }
    Replace(Text)
}

/// The mocks handed out so far: one per kind and original value.
#[derive(Default)]
struct Mocks {
    map: HashMap<(Kind, String), String>,
    next: HashMap<Kind, u64>,
}

impl Mocks {
    fn replace(&mut self, kind: Kind, value: &str) -> String {
        if let Some(mock) = self.map.get(&(kind, value.to_string())) {
            return mock.clone();
        }
        let n = self.next.entry(kind).or_insert(0);
        *n += 1;
        let mock = mock(kind, *n);
        self.map.insert((kind, value.to_string()), mock.clone());
        mock
    }
}

fn mock(kind: Kind, n: u64) -> String {
    use Kind::*;
    match kind {
        Email => format!("person{n}@example.invalid"),
        FirstName => format!("Vorname{n}"),
        LastName => format!("Nachname{n}"),
        Passport => format!("Passname{n} Nachname{n}"),
        Institution => format!("Institution {n}"),
        Pronouns => format!("Pronomen{n}"),
        Street => format!("Musterstraße {n}"),
        HouseNumber => format!("{n}"),
        Addition => format!("Zusatz {n}"),
        Zip => format!("{:05}", 10_000 + n),
        City => format!("Stadt {n}"),
        Country => format!("Land {n}"),
        Phone => format!("+49 000 {n:07}"),
        Notes => format!("Notiz {n}"),
        Reference => format!("Referenz {n}"),
        Title => format!("Titel {n}"),
        Authority => format!("Veranstalter {n}"),
        Description => format!("Beschreibung {n}"),
        Trigger => format!("Hinweis {n}"),
        Accessibility => format!("Barrierefreiheit {n}"),
        Freeform => format!("Tag{n}"),
        PlaceName => format!("Ort {n}"),
        Platform => format!("Plattform{n}"),
        Url => format!("https://example.invalid/{n}"),
        Subject => format!("Betreff {n}"),
        Body => format!("Text {n}"),
        Filename => format!("datei{n}.txt"),
        ContentType => "text/plain".to_string(),
        Base64 => base64::engine::general_purpose::STANDARD.encode(format!("Datei {n}")),
        Code => format!("code{n}"),
        Content => format!("# Dokument {n}\n\nText {n}"),
        GroupName => format!("Gruppe {n}"),
        Ip => format!("192.0.2.{}", n % 256),
        Token => format!("token{n}"),
        Text => format!("Text {n}"),
    }
}

/// What was done, as counts.
#[derive(Debug, Default)]
pub struct AnonReport {
    /// Documents per database and collection.
    pub documents: BTreeMap<String, BTreeMap<String, u64>>,
    /// Replacements per kind.
    pub replacements: BTreeMap<String, u64>,
    /// Strings at paths no rule names, replaced as plain text, by database and path.
    pub unknown_fields: BTreeMap<String, u64>,
    /// Database directories of the input that were not selected.
    pub skipped_databases: Vec<String>,
}

impl AnonReport {
    pub fn render(&self) -> String {
        use std::fmt::Write;
        let mut out = String::new();
        for (database, collections) in &self.documents {
            let _ = writeln!(out, "database {database}:");
            for (collection, n) in collections {
                let _ = writeln!(out, "  {collection:<24} {n}");
            }
        }
        let _ = writeln!(out, "replacements:");
        for (kind, n) in &self.replacements {
            let _ = writeln!(out, "  {kind:<24} {n}");
        }
        let _ = writeln!(out, "unknown string fields: {}", self.unknown_fields.len());
        for (path, n) in &self.unknown_fields {
            let _ = writeln!(out, "  {path} {n}");
        }
        for database in &self.skipped_databases {
            let _ = writeln!(out, "skipped database directory: {database}");
        }
        let _ = writeln!(out, "ANONYMIZED");
        out
    }
}

struct Run<'a> {
    database: &'a str,
    mocks: &'a mut Mocks,
    report: &'a mut AnonReport,
}

impl Run<'_> {
    fn unexpected(&self, path: &str, value: &Bson) -> AnonError {
        AnonError::UnexpectedType {
            database: self.database.to_string(),
            path: path.to_string(),
            found: super::doc::type_name(value),
        }
    }

    fn string(&mut self, path: &str, value: &str) -> String {
        match classify(self.database, path) {
            Class::Keep => value.to_string(),
            Class::Replace(kind) => {
                *self
                    .report
                    .replacements
                    .entry(format!("{kind:?}"))
                    .or_default() += 1;
                if kind == Kind::Text {
                    *self
                        .report
                        .unknown_fields
                        .entry(format!("{}.{path}", self.database))
                        .or_default() += 1;
                }
                self.mocks.replace(kind, value)
            }
        }
    }

    fn value(&mut self, path: &str, value: &Bson) -> Result<Bson, AnonError> {
        Ok(match value {
            Bson::String(s) => Bson::String(self.string(path, s)),
            Bson::Document(inner) => Bson::Document(self.document(path, inner)?),
            Bson::Array(items) => {
                let element = format!("{path}[]");
                Bson::Array(
                    items
                        .iter()
                        .map(|item| self.value(&element, item))
                        .collect::<Result<Vec<Bson>, AnonError>>()?,
                )
            }
            Bson::Double(_)
            | Bson::Boolean(_)
            | Bson::Null
            | Bson::Int32(_)
            | Bson::Int64(_)
            | Bson::DateTime(_)
            | Bson::ObjectId(_)
            | Bson::Timestamp(_)
            | Bson::Decimal128(_) => value.clone(),
            // The Yjs state is rebuilt from the mock text afterwards (`fix_document`).
            Bson::Binary(binary)
                if self.database == "queer-augsburg" && path == "documents.state" =>
            {
                *self
                    .report
                    .replacements
                    .entry("State".to_string())
                    .or_default() += 1;
                Bson::Binary(Binary {
                    subtype: binary.subtype,
                    bytes: Vec::new(),
                })
            }
            other => return Err(self.unexpected(path, other)),
        })
    }

    fn document(&mut self, path: &str, inner: &Document) -> Result<Document, AnonError> {
        let mut out = Document::new();
        for (key, value) in inner {
            let child = if path.is_empty() {
                key.clone()
            } else {
                format!("{path}.{key}")
            };
            out.insert(key.clone(), self.value(&child, value)?);
        }
        Ok(out)
    }
}

/// The derived fields that must agree with the mock they were derived from: the place and
/// group keys, the document title and the Yjs state.
fn fix_derived(collection: &str, document: &mut Document) {
    match collection {
        "places" => {
            if let (Some(Bson::String(name)), true) =
                (document.get("name"), document.contains_key("name_key"))
            {
                let key = place_name_key(name);
                document.insert("name_key", key);
            }
        }
        "document_groups" => {
            if let (Some(Bson::String(name)), true) =
                (document.get("name"), document.contains_key("name_key"))
            {
                let key = sort_key(name);
                document.insert("name_key", key);
            }
        }
        "documents" => {
            if let Some(Bson::String(content)) = document.get("content").cloned() {
                if document.contains_key("title") {
                    document.insert("title", derive_title(&content));
                }
                if let Some(Bson::Binary(binary)) = document.get("state") {
                    let subtype = binary.subtype;
                    document.insert(
                        "state",
                        Bson::Binary(Binary {
                            subtype,
                            bytes: initial_state(&content),
                        }),
                    );
                }
            }
        }
        _ => {}
    }
}

/// The converted collections of one database, by name.
type Collections = Vec<(String, Vec<Document>)>;

/// Writes `<output>/<database>/<collection>.bson` for every selected database of `input`.
/// The `.metadata.json` files are not copied; the migrator does not read them.
pub fn anonymize_dump(
    input: &Path,
    output: &Path,
    databases: &[String],
) -> Result<AnonReport, AnonError> {
    let mut report = AnonReport::default();
    let mut mocks = Mocks::default();
    for database in databases {
        if !DATABASES.contains(&database.as_str()) {
            return Err(AnonError::UnknownDatabase(database.clone()));
        }
    }
    let entries = std::fs::read_dir(input).map_err(|e| SourceError::Io {
        path: input.to_path_buf(),
        kind: e.kind(),
    })?;
    for entry in entries {
        let entry = entry.map_err(|e| SourceError::Io {
            path: input.to_path_buf(),
            kind: e.kind(),
        })?;
        if let Some(name) = entry.file_name().to_str() {
            if entry.path().is_dir() && !databases.iter().any(|d| d == name) {
                report.skipped_databases.push(name.to_string());
            }
        }
    }
    report.skipped_databases.sort();

    // Everything is converted before anything is written, so a failure leaves no half copy.
    let mut converted: Vec<(PathBuf, Collections)> = Vec::new();
    for database in databases {
        let db_dir = reader::database_dir(input, database)?;
        let out_dir = output.join(database);
        if out_dir.exists() {
            return Err(AnonError::OutputExists(out_dir));
        }
        let mut collections = Vec::new();
        let mut counts = BTreeMap::new();
        for collection in reader::list_collections(&db_dir)? {
            let documents = reader::read_collection(&db_dir, &collection)?;
            let mut out = Vec::with_capacity(documents.len());
            for document in &documents {
                let mut run = Run {
                    database,
                    mocks: &mut mocks,
                    report: &mut report,
                };
                let mut copy = run.document(&collection, document)?;
                if database == "queer-augsburg" {
                    fix_derived(&collection, &mut copy);
                }
                out.push(copy);
            }
            counts.insert(collection.clone(), out.len() as u64);
            collections.push((collection, out));
        }
        report.documents.insert(database.clone(), counts);
        converted.push((out_dir, collections));
    }
    for (out_dir, collections) in converted {
        for (collection, documents) in collections {
            reader::write_collection(&out_dir, &collection, &documents)?;
        }
    }
    Ok(report)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn equal_values_get_equal_mocks_per_kind() {
        let mut mocks = Mocks::default();
        let a = mocks.replace(Kind::Email, "a@x");
        let b = mocks.replace(Kind::Email, "b@x");
        assert_ne!(a, b);
        assert_eq!(mocks.replace(Kind::Email, "a@x"), a);
        assert_eq!(a, "person1@example.invalid");
        assert_ne!(mocks.replace(Kind::Text, "a@x"), a);
    }

    #[test]
    fn ids_and_enums_are_kept_everything_else_replaced() {
        assert!(matches!(
            classify("queer-augsburg", "meetings._id"),
            Class::Keep
        ));
        assert!(matches!(
            classify("queer-augsburg", "originalUsers.member.status"),
            Class::Keep
        ));
        assert!(matches!(
            classify("queer-augsburg", "originalUsers.member.email"),
            Class::Replace(Kind::Email)
        ));
        assert!(matches!(
            classify("queer-augsburg", "users.imported_from"),
            Class::Replace(Kind::Text)
        ));
        assert!(matches!(
            classify("interossea", "sessions._id"),
            Class::Replace(Kind::Token)
        ));
        assert!(matches!(
            classify("interossea", "sessions.userId"),
            Class::Keep
        ));
        assert!(matches!(
            classify("other", "users._id"),
            Class::Replace(Kind::Text)
        ));
    }
}
