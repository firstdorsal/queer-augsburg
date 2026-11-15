//! Typed access to a raw BSON document with the conversion rules of research-postgres §4.2:
//! missing and null both read as `None` for optional fields and are errors for required
//! ones; integers come as Int32, Int64 or an integral Double (anything else is an error);
//! every key read is remembered, so the keys nobody read are found at the end.

use super::config::Config;
use super::report::{Problem, Reason};
use bson::{Bson, Document};
use serde::de::DeserializeOwned;
use std::cell::RefCell;
use std::collections::HashSet;

/// One application of a conversion rule, collected for the report.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct RuleUse {
    pub field: String,
    pub rule: &'static str,
}

/// The BSON type of a value as one fixed word, for `Reason::WrongType`.
pub fn type_name(value: &Bson) -> &'static str {
    match value {
        Bson::Double(_) => "double",
        Bson::String(_) => "string",
        Bson::Array(_) => "array",
        Bson::Document(_) => "object",
        Bson::Boolean(_) => "bool",
        Bson::Null => "null",
        Bson::RegularExpression(_) => "regex",
        Bson::JavaScriptCode(_) => "javascript",
        Bson::JavaScriptCodeWithScope(_) => "javascript_with_scope",
        Bson::Int32(_) => "int",
        Bson::Int64(_) => "long",
        Bson::Timestamp(_) => "timestamp",
        Bson::Binary(_) => "binData",
        Bson::ObjectId(_) => "objectId",
        Bson::DateTime(_) => "date",
        Bson::Symbol(_) => "symbol",
        Bson::Decimal128(_) => "decimal",
        Bson::Undefined => "undefined",
        Bson::MaxKey => "maxKey",
        Bson::MinKey => "minKey",
        Bson::DbPointer(_) => "dbPointer",
    }
}

pub struct Doc<'a> {
    collection: &'static str,
    path: String,
    inner: &'a Document,
    seen: RefCell<HashSet<String>>,
    rules: &'a RefCell<Vec<RuleUse>>,
    config: &'a Config,
}

impl<'a> Doc<'a> {
    pub fn new(
        collection: &'static str,
        inner: &'a Document,
        rules: &'a RefCell<Vec<RuleUse>>,
        config: &'a Config,
    ) -> Self {
        Self {
            collection,
            path: String::new(),
            inner,
            seen: RefCell::new(HashSet::new()),
            rules,
            config,
        }
    }

    fn child(&self, key: &str, inner: &'a Document) -> Doc<'a> {
        Doc {
            collection: self.collection,
            path: self.field(key),
            inner,
            seen: RefCell::new(HashSet::new()),
            rules: self.rules,
            config: self.config,
        }
    }

    /// The dotted name of a key of this document.
    pub fn field(&self, key: &str) -> String {
        if self.path.is_empty() {
            key.to_string()
        } else {
            format!("{}.{key}", self.path)
        }
    }

    pub fn problem(&self, key: &str, reason: Reason) -> Problem {
        Problem::new(self.collection, self.field(key), reason)
    }

    pub fn rule(&self, key: &str, rule: &'static str) {
        self.rules.borrow_mut().push(RuleUse {
            field: self.field(key),
            rule,
        });
    }

    /// The value of a key, missing and null both as `None`; remembers the key as read.
    fn get(&self, key: &str) -> Option<&'a Bson> {
        self.seen.borrow_mut().insert(key.to_string());
        match self.inner.get(key) {
            None | Some(Bson::Null) => None,
            Some(value) => Some(value),
        }
    }

    fn required(&self, key: &str) -> Result<&'a Bson, Problem> {
        self.seen.borrow_mut().insert(key.to_string());
        match self.inner.get(key) {
            None => Err(self.problem(key, Reason::Missing)),
            Some(Bson::Null) => Err(self.problem(key, Reason::Null)),
            Some(value) => Ok(value),
        }
    }

    /// Reads a key without using it (a field the server never stored meaningfully).
    pub fn ignore(&self, key: &str, rule: &'static str) {
        if self.inner.contains_key(key) {
            self.rule(key, rule);
        }
        self.seen.borrow_mut().insert(key.to_string());
    }

    pub fn has(&self, key: &str) -> bool {
        self.inner.contains_key(key)
    }

    /// A string Postgres can store: a BSON string may hold U+0000, `text` cannot.
    fn text(&self, key: &str, s: &str) -> Result<String, Problem> {
        if s.contains('\0') {
            return Err(self.problem(key, Reason::NulCharacter));
        }
        Ok(s.to_string())
    }

    pub fn req_str(&self, key: &str) -> Result<String, Problem> {
        match self.required(key)? {
            Bson::String(s) => self.text(key, s),
            other => Err(self.problem(key, Reason::WrongType(type_name(other)))),
        }
    }

    /// A document text as the server stores it (`db::storable_text`): a U+0000 is dropped
    /// and counted, the Yjs state keeps it.
    pub fn req_document_text(&self, key: &str) -> Result<String, Problem> {
        match self.required(key)? {
            Bson::String(s) => {
                let stored = crate::db::storable_text(s);
                if stored.len() != s.len() {
                    self.rule(key, "nul_dropped");
                }
                Ok(stored.into_owned())
            }
            other => Err(self.problem(key, Reason::WrongType(type_name(other)))),
        }
    }

    pub fn opt_str(&self, key: &str) -> Result<Option<String>, Problem> {
        match self.get(key) {
            None => Ok(None),
            Some(Bson::String(s)) => self.text(key, s).map(Some),
            Some(other) => Err(self.problem(key, Reason::WrongType(type_name(other)))),
        }
    }

    fn integer(&self, key: &str, value: &Bson) -> Result<i64, Problem> {
        match value {
            Bson::Int64(v) => Ok(*v),
            Bson::Int32(v) => {
                self.rule(key, "int32_as_i64");
                Ok(i64::from(*v))
            }
            Bson::Double(v) => {
                // Lossless only for whole numbers in the exactly representable range.
                if v.fract() != 0.0 || !v.is_finite() || v.abs() >= 9_007_199_254_740_992.0 {
                    return Err(self.problem(key, Reason::NotIntegral));
                }
                self.rule(key, "double_as_i64");
                Ok(*v as i64)
            }
            other => Err(self.problem(key, Reason::WrongType(type_name(other)))),
        }
    }

    pub fn req_i64(&self, key: &str) -> Result<i64, Problem> {
        let value = self.required(key)?;
        self.integer(key, value)
    }

    pub fn opt_i64(&self, key: &str) -> Result<Option<i64>, Problem> {
        self.get(key)
            .map(|value| self.integer(key, value))
            .transpose()
    }

    pub fn req_bool(&self, key: &str) -> Result<bool, Problem> {
        match self.required(key)? {
            Bson::Boolean(b) => Ok(*b),
            other => Err(self.problem(key, Reason::WrongType(type_name(other)))),
        }
    }

    pub fn opt_bool(&self, key: &str) -> Result<Option<bool>, Problem> {
        match self.get(key) {
            None => Ok(None),
            Some(Bson::Boolean(b)) => Ok(Some(*b)),
            Some(other) => Err(self.problem(key, Reason::WrongType(type_name(other)))),
        }
    }

    fn float(&self, key: &str, value: &Bson) -> Result<f64, Problem> {
        match value {
            Bson::Double(v) => Ok(*v),
            Bson::Int32(v) => {
                self.rule(key, "int_as_double");
                Ok(f64::from(*v))
            }
            Bson::Int64(v) => {
                self.rule(key, "int_as_double");
                Ok(*v as f64)
            }
            other => Err(self.problem(key, Reason::WrongType(type_name(other)))),
        }
    }

    pub fn req_f64(&self, key: &str) -> Result<f64, Problem> {
        let value = self.required(key)?;
        self.float(key, value)
    }

    /// `f32` as the server deserialised it: the double narrowed.
    pub fn opt_f32(&self, key: &str) -> Result<Option<f32>, Problem> {
        self.get(key)
            .map(|value| self.float(key, value).map(|v| v as f32))
            .transpose()
    }

    /// The bytes of a binary field, whatever their subtype.
    pub fn req_bytes(&self, key: &str) -> Result<Vec<u8>, Problem> {
        match self.required(key)? {
            Bson::Binary(binary) => Ok(binary.bytes.clone()),
            other => Err(self.problem(key, Reason::WrongType(type_name(other)))),
        }
    }

    pub fn req_doc(&self, key: &str) -> Result<Doc<'a>, Problem> {
        match self.required(key)? {
            Bson::Document(inner) => Ok(self.child(key, inner)),
            other => Err(self.problem(key, Reason::WrongType(type_name(other)))),
        }
    }

    pub fn opt_doc(&self, key: &str) -> Result<Option<Doc<'a>>, Problem> {
        match self.get(key) {
            None => Ok(None),
            Some(Bson::Document(inner)) => Ok(Some(self.child(key, inner))),
            Some(other) => Err(self.problem(key, Reason::WrongType(type_name(other)))),
        }
    }

    pub fn req_array(&self, key: &str) -> Result<&'a [Bson], Problem> {
        match self.required(key)? {
            Bson::Array(items) => Ok(items.as_slice()),
            other => Err(self.problem(key, Reason::WrongType(type_name(other)))),
        }
    }

    pub fn opt_array(&self, key: &str) -> Result<Option<&'a [Bson]>, Problem> {
        match self.get(key) {
            None => Ok(None),
            Some(Bson::Array(items)) => Ok(Some(items.as_slice())),
            Some(other) => Err(self.problem(key, Reason::WrongType(type_name(other)))),
        }
    }

    /// The elements of an array as documents, each addressed as `key[]`.
    pub fn doc_array(&self, key: &str) -> Result<Vec<Doc<'a>>, Problem> {
        let element = format!("{key}[]");
        self.req_array(key)?
            .iter()
            .map(|item| match item {
                Bson::Document(inner) => Ok(self.child(&element, inner)),
                other => Err(self.problem(&element, Reason::WrongType(type_name(other)))),
            })
            .collect()
    }

    pub fn string_array(&self, key: &str) -> Result<Vec<String>, Problem> {
        let element = format!("{key}[]");
        self.req_array(key)?
            .iter()
            .map(|item| match item {
                Bson::String(s) => self.text(&element, s),
                other => Err(self.problem(&element, Reason::WrongType(type_name(other)))),
            })
            .collect()
    }

    pub fn i64_array(&self, key: &str) -> Result<Vec<i64>, Problem> {
        let element = format!("{key}[]");
        self.req_array(key)?
            .iter()
            .map(|item| self.integer(&element, item))
            .collect()
    }

    pub fn f32_array(&self, key: &str) -> Result<Vec<f32>, Problem> {
        let element = format!("{key}[]");
        self.req_array(key)?
            .iter()
            .map(|item| self.float(&element, item).map(|v| v as f32))
            .collect()
    }

    fn enum_value<T: DeserializeOwned>(&self, key: &str, value: &Bson) -> Result<T, Problem> {
        match value {
            Bson::String(s) => serde_json::from_value(serde_json::Value::String(s.clone()))
                .map_err(|_| self.problem(key, Reason::UnknownValue)),
            other => Err(self.problem(key, Reason::WrongType(type_name(other)))),
        }
    }

    /// A string that must be one of the variants of `T`.
    pub fn req_enum<T: DeserializeOwned>(&self, key: &str) -> Result<T, Problem> {
        let value = self.required(key)?;
        self.enum_value(key, value)
    }

    pub fn opt_enum<T: DeserializeOwned>(&self, key: &str) -> Result<Option<T>, Problem> {
        self.get(key)
            .map(|value| self.enum_value(key, value))
            .transpose()
    }

    pub fn enum_array<T: DeserializeOwned>(&self, key: &str) -> Result<Vec<T>, Problem> {
        let element = format!("{key}[]");
        self.req_array(key)?
            .iter()
            .map(|item| self.enum_value(&element, item))
            .collect()
    }

    /// The keys nobody read, sorted.
    pub fn unread_keys(&self) -> Vec<String> {
        let seen = self.seen.borrow();
        let mut keys: Vec<String> = self
            .inner
            .keys()
            .filter(|key| !seen.contains(key.as_str()))
            .cloned()
            .collect();
        keys.sort();
        keys
    }

    /// Fails on the first key nobody read, unless the config allows it to be dropped.
    pub fn finish(&self) -> Result<(), Problem> {
        for key in self.unread_keys() {
            let field = self.field(&key);
            if self.config.is_ignored(self.collection, &field) {
                self.rule(&key, "ignored_field");
                continue;
            }
            return Err(Problem::new(self.collection, field, Reason::UnknownField));
        }
        Ok(())
    }

    /// The keys nobody read with their values, as a document (for `users.extra`).
    pub fn unread(&self) -> Document {
        let mut rest = Document::new();
        for key in self.unread_keys() {
            if let Some(value) = self.inner.get(&key) {
                self.rule(&key, "kept_in_extra");
                rest.insert(key, value.clone());
            }
        }
        rest
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::types::MeetingStatus;
    use bson::doc;
    use std::collections::BTreeMap;

    fn config() -> Config {
        Config {
            dump_dir: "/dump".into(),
            database: "queer-augsburg".into(),
            expected_counts: BTreeMap::new(),
            ignored_fields: BTreeMap::from([("meetings".to_string(), vec!["legacy".to_string()])]),
        }
    }

    #[test]
    fn missing_and_null_read_as_none_for_optional_fields() {
        let config = config();
        let rules = RefCell::new(Vec::new());
        let inner = doc! {"a": Bson::Null, "n": 3_i32, "d": 4.0, "s": "Active"};
        let d = Doc::new("meetings", &inner, &rules, &config);
        assert_eq!(d.opt_str("a").unwrap(), None);
        assert_eq!(d.opt_str("missing").unwrap(), None);
        assert_eq!(d.req_str("a").unwrap_err().reason, Reason::Null);
        assert_eq!(d.req_str("missing").unwrap_err().reason, Reason::Missing);
        assert_eq!(d.req_i64("n").unwrap(), 3);
        assert_eq!(d.req_i64("d").unwrap(), 4);
        assert_eq!(
            d.req_enum::<MeetingStatus>("s").unwrap(),
            MeetingStatus::Active
        );
        assert_eq!(
            d.req_i64("s").unwrap_err().reason,
            Reason::WrongType("string")
        );
        let rules = rules.borrow();
        assert!(rules
            .iter()
            .any(|r| r.field == "n" && r.rule == "int32_as_i64"));
        assert!(rules
            .iter()
            .any(|r| r.field == "d" && r.rule == "double_as_i64"));
    }

    #[test]
    fn a_fractional_double_is_not_an_integer() {
        let config = config();
        let rules = RefCell::new(Vec::new());
        let inner = doc! {"at": 1.5};
        let d = Doc::new("meetings", &inner, &rules, &config);
        assert_eq!(d.req_i64("at").unwrap_err().reason, Reason::NotIntegral);
    }

    #[test]
    fn unread_keys_fail_unless_ignored_by_config() {
        let config = config();
        let rules = RefCell::new(Vec::new());
        let inner = doc! {"_id": "x", "legacy": 1, "surprise": true};
        let d = Doc::new("meetings", &inner, &rules, &config);
        d.req_str("_id").unwrap();
        let problem = d.finish().unwrap_err();
        assert_eq!(problem.to_string(), "meetings.surprise unknown_field");
        let inner = doc! {"_id": "x", "legacy": 1};
        let d = Doc::new("meetings", &inner, &rules, &config);
        d.req_str("_id").unwrap();
        d.finish().unwrap();
        assert!(rules
            .borrow()
            .iter()
            .any(|r| r.field == "legacy" && r.rule == "ignored_field"));
    }

    #[test]
    fn nested_fields_are_dotted() {
        let config = config();
        let rules = RefCell::new(Vec::new());
        let inner = doc! {"member": {"name": {"first_name": 5}}};
        let d = Doc::new("users", &inner, &rules, &config);
        let member = d.req_doc("member").unwrap();
        let name = member.req_doc("name").unwrap();
        let problem = name.req_str("first_name").unwrap_err();
        assert_eq!(
            problem.to_string(),
            "users.member.name.first_name wrong_type:int"
        );
        assert_eq!(
            name.req_str("last_name").unwrap_err().field,
            "member.name.last_name"
        );
    }
}
