//! The report of a run: counts, rule names, field names and digests. No value of any field
//! is part of it, on purpose (PLAN: production data never enters a context), so every line
//! is built from a fixed vocabulary, names of collections and fields, and numbers.

use sha2::{Digest, Sha256};
use std::collections::BTreeMap;
use std::fmt;

/// The collections of the v1 database, in the order the migrator writes them. Every one of
/// them must have an expected count in the config, and no other `.bson` file may be in the
/// dump.
pub const COLLECTIONS: [&str; 10] = [
    "users",
    "originalUsers",
    "places",
    "meetings",
    "sent_email_logs",
    "email_drafts",
    "documents",
    "document_groups",
    "document_group_order",
    "document_versions",
];

/// Read and counted, never written: a draft is a mass mail waiting for its code for 30
/// minutes, and the cutover takes longer than that (research-postgres §4.1).
pub const SKIPPED_COLLECTIONS: [&str; 1] = ["email_drafts"];

/// The digest of no rows at all; refused for a collection that is expected to have rows.
pub const EMPTY_DIGEST: &str = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";

pub fn is_skipped(collection: &str) -> bool {
    SKIPPED_COLLECTIONS.contains(&collection)
}

/// Why a value could not be taken over. Each variant prints as one fixed word.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
pub enum Reason {
    /// A required field is not in the document.
    Missing,
    /// A required field is null.
    Null,
    /// The BSON type is not the expected one; carries the name of the type found.
    WrongType(&'static str),
    /// A double where an integer is stored, with a fractional part.
    NotIntegral,
    /// An integer outside the range of the column.
    OutOfRange,
    /// A string that is not one of the enum's variants (or `_id` of the group order).
    UnknownValue,
    /// A field no rule knows and that is not allow-listed in the config.
    UnknownField,
    /// Two documents with the same `_id` or the same unique key.
    DuplicateKey,
    /// The stored `name_key` differs from the one computed from `name`.
    KeyMismatch,
    /// A Yjs state that does not decode.
    Undecodable,
    /// A reference to a user, place, group or document that does not exist.
    Dangling,
    /// The count in the dump differs from the expected count of the config.
    CountMismatch,
    /// The text of the Yjs state differs from `content` (the room may not have saved yet).
    StateTextDiffers,
    /// The table holds a different number of rows than the dump.
    TargetCountMismatch,
    /// The digests of the two sides differ.
    DigestMismatch,
    /// Rows are expected, but the digest is the one of no rows.
    EmptyDigest,
    /// A row read back from Postgres through the server's code differs from the raw row.
    RereadDiffers,
    /// A string with U+0000, which Postgres `text` and `jsonb` cannot hold.
    NulCharacter,
}

impl fmt::Display for Reason {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Reason::Missing => write!(f, "missing"),
            Reason::Null => write!(f, "null"),
            Reason::WrongType(found) => write!(f, "wrong_type:{found}"),
            Reason::NotIntegral => write!(f, "not_integral"),
            Reason::OutOfRange => write!(f, "out_of_range"),
            Reason::UnknownValue => write!(f, "unknown_value"),
            Reason::UnknownField => write!(f, "unknown_field"),
            Reason::DuplicateKey => write!(f, "duplicate_key"),
            Reason::KeyMismatch => write!(f, "key_mismatch"),
            Reason::Undecodable => write!(f, "undecodable"),
            Reason::Dangling => write!(f, "dangling"),
            Reason::CountMismatch => write!(f, "count_mismatch"),
            Reason::StateTextDiffers => write!(f, "state_text_differs"),
            Reason::TargetCountMismatch => write!(f, "target_count_mismatch"),
            Reason::DigestMismatch => write!(f, "digest_mismatch"),
            Reason::EmptyDigest => write!(f, "empty_digest"),
            Reason::RereadDiffers => write!(f, "reread_differs"),
            Reason::NulCharacter => write!(f, "nul_character"),
        }
    }
}

/// One thing that is wrong with a document: the collection, the dotted field name and the
/// reason. Never the id, never the value.
#[derive(Debug, Clone, PartialEq, Eq, PartialOrd, Ord)]
pub struct Problem {
    pub collection: &'static str,
    pub field: String,
    pub reason: Reason,
}

impl Problem {
    pub fn new(collection: &'static str, field: impl Into<String>, reason: Reason) -> Self {
        Self {
            collection,
            field: field.into(),
            reason,
        }
    }
}

impl fmt::Display for Problem {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        if self.field.is_empty() {
            write!(f, "{} {}", self.collection, self.reason)
        } else {
            write!(f, "{}.{} {}", self.collection, self.field, self.reason)
        }
    }
}

/// The numbers of one collection.
#[derive(Debug, Default, Clone, PartialEq, Eq)]
pub struct CollectionCounts {
    /// From the config, never from the dump.
    pub expected: Option<u64>,
    /// Documents in the dump.
    pub source: Option<u64>,
    /// Rows in the table after writing.
    pub target: Option<u64>,
    pub inserted: u64,
    pub updated: u64,
    pub unchanged: u64,
    pub source_digest: Option<String>,
    pub target_digest: Option<String>,
}

/// A cross-collection count that must agree on both sides.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Invariant {
    pub name: &'static str,
    pub expected: i64,
    pub actual: i64,
}

#[derive(Debug, Default)]
pub struct Report {
    pub collections: BTreeMap<&'static str, CollectionCounts>,
    /// How often each conversion rule was applied, by `collection.field rule`.
    pub rules: BTreeMap<String, u64>,
    /// Problems that do not block, by their text.
    pub warnings: BTreeMap<String, u64>,
    /// Problems that block, by their text.
    pub errors: BTreeMap<String, u64>,
    pub invariants: Vec<Invariant>,
    /// Set by `judge`, read by the binary for its exit code.
    pub verified: bool,
}

impl Report {
    pub fn new() -> Self {
        let mut report = Self::default();
        for collection in COLLECTIONS {
            report
                .collections
                .insert(collection, CollectionCounts::default());
        }
        report
    }

    pub fn collection(&mut self, name: &'static str) -> &mut CollectionCounts {
        self.collections.entry(name).or_default()
    }

    pub fn rule(&mut self, collection: &str, field: &str, rule: &str) {
        let key = if field.is_empty() {
            format!("{collection} {rule}")
        } else {
            format!("{collection}.{field} {rule}")
        };
        *self.rules.entry(key).or_default() += 1;
    }

    pub fn warn(&mut self, problem: Problem) {
        *self.warnings.entry(problem.to_string()).or_default() += 1;
    }

    pub fn error(&mut self, problem: Problem) {
        *self.errors.entry(problem.to_string()).or_default() += 1;
    }

    pub fn invariant(&mut self, name: &'static str, expected: i64, actual: i64) {
        self.invariants.push(Invariant {
            name,
            expected,
            actual,
        });
    }

    pub fn has_errors(&self) -> bool {
        !self.errors.is_empty()
    }

    /// Decides `verified`. True only when nothing is wrong at all: no error, every
    /// collection counted on both sides as expected, every digest equal and not the one of
    /// no rows where rows are expected, every invariant holding. The counts come from the
    /// config, so a dump that read nothing cannot pass.
    pub fn judge(&mut self) -> bool {
        let mut problems = Vec::new();
        for collection in COLLECTIONS {
            let counts = self
                .collections
                .get(collection)
                .cloned()
                .unwrap_or_default();
            let Some(expected) = counts.expected else {
                problems.push(Problem::new(collection, "expected", Reason::Missing));
                continue;
            };
            if counts.source != Some(expected) {
                problems.push(Problem::new(collection, "", Reason::CountMismatch));
            }
            if is_skipped(collection) {
                continue;
            }
            if counts.target != Some(expected) {
                problems.push(Problem::new(collection, "", Reason::TargetCountMismatch));
            }
            match (&counts.source_digest, &counts.target_digest) {
                (Some(source), Some(target)) if source == target => {
                    if expected > 0 && source == EMPTY_DIGEST {
                        problems.push(Problem::new(collection, "", Reason::EmptyDigest));
                    }
                }
                _ => problems.push(Problem::new(collection, "", Reason::DigestMismatch)),
            }
        }
        for invariant in &self.invariants {
            if invariant.expected != invariant.actual {
                problems.push(Problem::new(
                    invariant.name,
                    "",
                    Reason::TargetCountMismatch,
                ));
            }
        }
        for problem in problems {
            self.error(problem);
        }
        self.verified = !self.has_errors();
        self.verified
    }

    /// The digest over all collection digests, in `COLLECTIONS` order; part of the verified
    /// line so the rehearsal and the cutover can be compared with one string.
    pub fn combined_digest(&self) -> String {
        let mut hasher = Sha256::new();
        for collection in COLLECTIONS {
            if let Some(digest) = self
                .collections
                .get(collection)
                .and_then(|counts| counts.target_digest.as_deref())
            {
                hasher.update(collection.as_bytes());
                hasher.update(digest.as_bytes());
            }
        }
        hex(&hasher.finalize())
    }

    /// The whole report as printed. The last line is `MIGRATION VERIFIED …` or
    /// `MIGRATION FAILED`; the cutover script looks for the first.
    pub fn render(&self) -> String {
        use std::fmt::Write;
        let mut out = String::new();
        let _ = writeln!(out, "collections:");
        for (name, c) in &self.collections {
            let _ = write!(out, "  {name:<22}");
            let _ = write!(out, " expected={}", opt(c.expected));
            let _ = write!(out, " source={}", opt(c.source));
            if is_skipped(name) {
                let _ = writeln!(out, " skipped");
                continue;
            }
            let _ = writeln!(
                out,
                " target={} inserted={} updated={} unchanged={}",
                opt(c.target),
                c.inserted,
                c.updated,
                c.unchanged
            );
            let _ = writeln!(
                out,
                "    source digest {}",
                c.source_digest.as_deref().unwrap_or("-")
            );
            let _ = writeln!(
                out,
                "    target digest {}",
                c.target_digest.as_deref().unwrap_or("-")
            );
        }
        let _ = writeln!(out, "invariants:");
        for invariant in &self.invariants {
            let _ = writeln!(
                out,
                "  {:<40} expected={} actual={} {}",
                invariant.name,
                invariant.expected,
                invariant.actual,
                if invariant.expected == invariant.actual {
                    "ok"
                } else {
                    "MISMATCH"
                }
            );
        }
        let _ = writeln!(out, "rules applied:");
        for (rule, n) in &self.rules {
            let _ = writeln!(out, "  {rule} {n}");
        }
        let _ = writeln!(out, "warnings: {}", self.warnings.values().sum::<u64>());
        for (warning, n) in &self.warnings {
            let _ = writeln!(out, "  {warning} {n}");
        }
        let _ = writeln!(out, "errors: {}", self.errors.values().sum::<u64>());
        for (error, n) in &self.errors {
            let _ = writeln!(out, "  {error} {n}");
        }
        if self.verified {
            let _ = write!(out, "MIGRATION VERIFIED");
            for collection in COLLECTIONS {
                let count = self
                    .collections
                    .get(collection)
                    .and_then(|c| c.expected)
                    .unwrap_or(0);
                let _ = write!(out, " {collection}={count}");
            }
            let _ = writeln!(out, " digest={}", self.combined_digest());
        } else {
            let _ = writeln!(out, "MIGRATION FAILED");
        }
        out
    }
}

fn opt(value: Option<u64>) -> String {
    value.map_or_else(|| "-".to_string(), |v| v.to_string())
}

pub fn hex(bytes: &[u8]) -> String {
    let mut s = String::with_capacity(bytes.len() * 2);
    for b in bytes {
        s.push(char::from_digit((b >> 4) as u32, 16).unwrap_or('0'));
        s.push(char::from_digit((b & 0xf) as u32, 16).unwrap_or('0'));
    }
    s
}

#[cfg(test)]
mod tests {
    use super::*;

    fn complete_report() -> Report {
        let mut report = Report::new();
        for collection in COLLECTIONS {
            let c = report.collection(collection);
            c.expected = Some(0);
            c.source = Some(0);
            if !is_skipped(collection) {
                c.target = Some(0);
                c.source_digest = Some(EMPTY_DIGEST.to_string());
                c.target_digest = Some(EMPTY_DIGEST.to_string());
            }
        }
        report
    }

    #[test]
    fn an_empty_dump_with_empty_expectations_passes() {
        let mut report = complete_report();
        assert!(report.judge());
        assert!(report.render().contains("MIGRATION VERIFIED users=0"));
    }

    #[test]
    fn the_empty_digest_is_refused_where_rows_are_expected() {
        let mut report = complete_report();
        let users = report.collection("users");
        users.expected = Some(3);
        users.source = Some(3);
        users.target = Some(3);
        assert!(!report.judge());
        assert_eq!(report.errors.get("users empty_digest"), Some(&1));
        assert!(report.render().ends_with("MIGRATION FAILED\n"));
    }

    #[test]
    fn a_missing_expectation_fails() {
        let mut report = complete_report();
        report.collection("places").expected = None;
        assert!(!report.judge());
        assert_eq!(report.errors.get("places.expected missing"), Some(&1));
    }

    #[test]
    fn a_differing_digest_or_count_fails() {
        let mut report = complete_report();
        report.collection("meetings").target_digest = Some("ff".to_string());
        report.collection("documents").target = Some(1);
        report.invariant("meeting_changes", 2, 1);
        assert!(!report.judge());
        assert_eq!(report.errors.get("meetings digest_mismatch"), Some(&1));
        assert_eq!(
            report.errors.get("documents target_count_mismatch"),
            Some(&1)
        );
        assert_eq!(
            report.errors.get("meeting_changes target_count_mismatch"),
            Some(&1)
        );
    }

    #[test]
    fn a_skipped_collection_needs_only_its_source_count() {
        let mut report = complete_report();
        let drafts = report.collection("email_drafts");
        drafts.expected = Some(3);
        drafts.source = Some(3);
        assert!(report.judge());
        let drafts = report.collection("email_drafts");
        drafts.source = Some(2);
        assert!(!report.judge());
        assert_eq!(report.errors.get("email_drafts count_mismatch"), Some(&1));
    }

    #[test]
    fn problems_print_names_and_reasons_only() {
        let problem = Problem::new("users", "member.honorary", Reason::Missing);
        assert_eq!(problem.to_string(), "users.member.honorary missing");
        let problem = Problem::new("meetings", "time", Reason::WrongType("string"));
        assert_eq!(problem.to_string(), "meetings.time wrong_type:string");
    }
}
