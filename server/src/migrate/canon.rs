//! Canonical hashing of rows (research-postgres §4.4, after v2's `hash.rs`). Each row is
//! encoded type-tagged and length-prefixed, timestamps as the i64 they are, floats by their
//! bit pattern, options with an explicit marker, then hashed with sha256. The same encoding
//! is taken of the dump's rows and of the rows read back from Postgres, so the two digests
//! of a collection are equal only if every field of every row survived exactly.

use super::report::hex;
use super::source::{
    DocumentRow, GroupOrderRow, GroupRow, OriginalUserRow, PlaceRow, UserRow, VersionRow,
};
use crate::types::{
    Address, ChangedMeeting, InternalMember, Meeting, MeetingLocation, MeetingTags, Name,
    OnlineMeeting, SentEmailLog, User,
};
use serde_json::Value;
use sha2::{Digest, Sha256};
use std::fmt::Debug;

const TAG_NULL: u8 = 0x00;
const TAG_SOME: u8 = 0x01;
const TAG_STR: u8 = 0x10;
const TAG_I64: u8 = 0x11;
const TAG_F32: u8 = 0x13;
const TAG_F64: u8 = 0x14;
const TAG_BOOL: u8 = 0x15;
const TAG_U8: u8 = 0x16;
const TAG_U16: u8 = 0x17;
const TAG_U32: u8 = 0x18;
const TAG_ENUM: u8 = 0x19;
const TAG_SEQ: u8 = 0x1A;
const TAG_BYTES: u8 = 0x1B;

#[derive(Default)]
pub struct Canon {
    buf: Vec<u8>,
}

impl Canon {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn finish(self) -> [u8; 32] {
        Sha256::digest(&self.buf).into()
    }

    fn tag(&mut self, t: u8) {
        self.buf.push(t);
    }

    fn len(&mut self, n: usize) {
        self.buf.extend_from_slice(&(n as u64).to_le_bytes());
    }

    pub fn str(&mut self, s: &str) -> &mut Self {
        self.tag(TAG_STR);
        self.len(s.len());
        self.buf.extend_from_slice(s.as_bytes());
        self
    }

    pub fn bytes(&mut self, b: &[u8]) -> &mut Self {
        self.tag(TAG_BYTES);
        self.len(b.len());
        self.buf.extend_from_slice(b);
        self
    }

    pub fn i64(&mut self, v: i64) -> &mut Self {
        self.tag(TAG_I64);
        self.buf.extend_from_slice(&v.to_le_bytes());
        self
    }

    pub fn u32(&mut self, v: u32) -> &mut Self {
        self.tag(TAG_U32);
        self.buf.extend_from_slice(&v.to_le_bytes());
        self
    }

    pub fn u16(&mut self, v: u16) -> &mut Self {
        self.tag(TAG_U16);
        self.buf.extend_from_slice(&v.to_le_bytes());
        self
    }

    pub fn u8(&mut self, v: u8) -> &mut Self {
        self.tag(TAG_U8);
        self.buf.push(v);
        self
    }

    pub fn f32(&mut self, v: f32) -> &mut Self {
        self.tag(TAG_F32);
        self.buf.extend_from_slice(&v.to_bits().to_le_bytes());
        self
    }

    pub fn f64(&mut self, v: f64) -> &mut Self {
        self.tag(TAG_F64);
        self.buf.extend_from_slice(&v.to_bits().to_le_bytes());
        self
    }

    pub fn bool(&mut self, v: bool) -> &mut Self {
        self.tag(TAG_BOOL);
        self.buf.push(u8::from(v));
        self
    }

    /// An enum by its variant name, which is also its label in Postgres and JSON.
    pub fn enum_name<T: Debug>(&mut self, v: &T) -> &mut Self {
        let name = format!("{v:?}");
        self.tag(TAG_ENUM);
        self.len(name.len());
        self.buf.extend_from_slice(name.as_bytes());
        self
    }

    pub fn opt<T>(&mut self, v: Option<&T>, f: impl FnOnce(&mut Self, &T)) -> &mut Self {
        match v {
            None => self.tag(TAG_NULL),
            Some(inner) => {
                self.tag(TAG_SOME);
                f(self, inner);
            }
        }
        self
    }

    pub fn seq<T>(&mut self, items: &[T], mut f: impl FnMut(&mut Self, &T)) -> &mut Self {
        self.tag(TAG_SEQ);
        self.len(items.len());
        for item in items {
            f(self, item);
        }
        self
    }

    pub fn opt_str(&mut self, v: Option<&String>) -> &mut Self {
        self.opt(v, |c, s| {
            c.str(s);
        })
    }

    pub fn opt_i64(&mut self, v: Option<&i64>) -> &mut Self {
        self.opt(v, |c, i| {
            c.i64(*i);
        })
    }

    pub fn strs(&mut self, items: &[String]) -> &mut Self {
        self.seq(items, |c, s| {
            c.str(s);
        })
    }
}

/// JSON with the keys of every object sorted, so the value compares the same whether it
/// came from the dump or from a `jsonb` column (which does not keep key order).
pub fn canonical_json(value: &Value, out: &mut String) {
    match value {
        Value::Object(map) => {
            let mut keys: Vec<&String> = map.keys().collect();
            keys.sort();
            out.push('{');
            for (i, key) in keys.iter().enumerate() {
                if i > 0 {
                    out.push(',');
                }
                out.push_str(&Value::String((*key).clone()).to_string());
                out.push(':');
                canonical_json(&map[*key], out);
            }
            out.push('}');
        }
        Value::Array(items) => {
            out.push('[');
            for (i, item) in items.iter().enumerate() {
                if i > 0 {
                    out.push(',');
                }
                canonical_json(item, out);
            }
            out.push(']');
        }
        other => out.push_str(&other.to_string()),
    }
}

fn json(c: &mut Canon, value: &Value) {
    let mut text = String::new();
    canonical_json(value, &mut text);
    c.str(&text);
}

fn name(c: &mut Canon, n: &Name) {
    c.str(&n.passport).str(&n.first_name).str(&n.last_name);
}

fn address(c: &mut Canon, a: &Address) {
    c.str(&a.street)
        .str(&a.number)
        .opt_str(a.addition.as_ref())
        .str(&a.zip)
        .str(&a.city)
        .str(&a.country);
}

fn member(c: &mut Canon, m: &InternalMember) {
    c.enum_name(&m._type)
        .bool(m.natural_person)
        .opt(m.name.as_ref(), name)
        .opt_str(m.institution.as_ref())
        .opt_str(m.pronouns.as_ref());
    address(c, &m.address);
    c.str(&m.email)
        .opt_str(m.phone.as_ref())
        .i64(m.start_time_ms)
        .opt_i64(m.end_time_ms.as_ref())
        .opt(m.status.as_ref(), |c, s| {
            c.enum_name(s);
        })
        .opt_str(m.user_notes.as_ref())
        .opt_str(m.admin_notes.as_ref())
        .opt_str(m.reference.as_ref())
        .bool(m.approved_charter)
        .bool(m.approved_privacy)
        .bool(m.above_18)
        .bool(m.honorary);
}

fn user(c: &mut Canon, u: &User) {
    c.str(&u.id).opt(u.member.as_ref(), member).seq(
        u.capabilities.as_deref().unwrap_or(&[]),
        |c, cap| {
            c.enum_name(cap);
        },
    );
}

pub fn hash_user(row: &UserRow) -> [u8; 32] {
    let mut c = Canon::new();
    c.str("user");
    user(&mut c, &row.user);
    c.opt(row.extra.as_ref(), json);
    c.finish()
}

pub fn hash_original_user(row: &OriginalUserRow) -> [u8; 32] {
    let mut c = Canon::new();
    c.str("originalUser").str(&row.user_id);
    json(&mut c, &row.snapshot);
    c.i64(row.created_at);
    c.finish()
}

pub fn hash_place(row: &PlaceRow) -> [u8; 32] {
    let mut c = Canon::new();
    c.str("place")
        .str(&row._id)
        .str(&row.name)
        .str(&row.name_key)
        .f64(row.lat)
        .f64(row.lon)
        .opt_str(row.created_by.as_ref())
        .opt_i64(row.created_at.as_ref());
    c.finish()
}

fn location(c: &mut Canon, l: &MeetingLocation) {
    c.str(&l.name).f64(l.lat).f64(l.lon);
}

fn online(c: &mut Canon, o: &OnlineMeeting) {
    // `url_hidden` is a response flag, never stored.
    c.str(&o.platform)
        .opt_str(o.url.as_ref())
        .bool(o.members_only);
}

fn tags(c: &mut Canon, t: &MeetingTags) {
    c.strs(&t.freeform)
        .seq(&t.common, |c, tag| {
            c.enum_name(tag);
        })
        .seq(&t.queer, |c, tag| {
            c.enum_name(tag);
        });
}

fn change(c: &mut Canon, ch: &ChangedMeeting) {
    c.str(&ch.by).i64(ch.at);
}

pub fn hash_meeting(m: &Meeting) -> [u8; 32] {
    let mut c = Canon::new();
    c.str("meeting")
        .str(&m._id)
        .str(&m.title)
        .str(&m.authority)
        .seq(&m.age_restriction, |c, v| {
            c.u8(*v);
        })
        .opt_i64(m.time.as_ref())
        .opt(m.location.as_ref(), location)
        .opt_str(m.place_id.as_ref())
        .opt(m.online.as_ref(), online)
        .bool(m.place_to_be_announced)
        .str(&m.description)
        .seq(&m.price, |c, p| {
            c.f32(*p);
        })
        .opt_str(m.trigger_warning.as_ref())
        .opt(m.attendance.as_ref(), |c, v| {
            c.u16(*v);
        })
        .opt(m.rating.as_ref(), |c, v| {
            c.f32(*v);
        })
        .opt_str(m.accessibility.as_ref());
    tags(&mut c, &m.tags);
    c.enum_name(&m.status)
        // `None` and `Some([])` are the same row in Postgres (research-postgres §2.3).
        .seq(m.changed.as_deref().unwrap_or(&[]), change)
        .opt(m.cancelled.as_ref(), |c, v| {
            c.bool(*v);
        })
        .opt_i64(m.deleted_at.as_ref());
    c.finish()
}

pub fn hash_sent_email_log(l: &SentEmailLog) -> [u8; 32] {
    let mut c = Canon::new();
    c.str("sentEmailLog")
        .str(&l._id)
        .str(&l.sender_id)
        .str(&l.sender_email)
        .str(&l.subject)
        .str(&l.body)
        .strs(&l.attachment_names)
        .i64(l.sent_at)
        .u32(l.successful_count)
        .u32(l.failed_count)
        .strs(&l.failed_emails)
        .opt_str(l.reply_to.as_ref());
    c.finish()
}

pub fn hash_document(d: &DocumentRow) -> [u8; 32] {
    let mut c = Canon::new();
    c.str("document")
        .str(&d._id)
        .str(&d.title)
        .str(&d.content)
        .bytes(&d.state)
        .i64(d.state_version)
        .strs(&d.group_ids)
        .str(&d.created_by)
        .i64(d.created_at)
        .i64(d.updated_at)
        .opt_str(d.deleted_by.as_ref())
        .opt_i64(d.deleted_at.as_ref());
    c.finish()
}

pub fn hash_group(g: &GroupRow) -> [u8; 32] {
    let mut c = Canon::new();
    c.str("documentGroup")
        .str(&g._id)
        .str(&g.name)
        .str(&g.name_key)
        .strs(&g.document_order);
    c.finish()
}

pub fn hash_group_order(o: &GroupOrderRow) -> [u8; 32] {
    let mut c = Canon::new();
    c.str("documentGroupOrder").str(&o._id).strs(&o.group_ids);
    c.finish()
}

pub fn hash_version(v: &VersionRow) -> [u8; 32] {
    let mut c = Canon::new();
    c.str("documentVersion")
        .str(&v._id)
        .str(&v.document_id)
        .str(&v.content)
        .strs(&v.editors)
        .i64(v.saved_at);
    c.finish()
}

/// The digest of a collection: the row hashes in the byte order of their ids, hashed again.
/// Over no rows it is `report::EMPTY_DIGEST`.
pub fn digest(rows: impl IntoIterator<Item = (String, [u8; 32])>) -> String {
    let mut rows: Vec<(String, [u8; 32])> = rows.into_iter().collect();
    rows.sort_by(|a, b| a.0.as_bytes().cmp(b.0.as_bytes()));
    let mut hasher = Sha256::new();
    for (_, hash) in rows {
        hasher.update(hash);
    }
    hex(&hasher.finalize())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::migrate::report::EMPTY_DIGEST;
    use crate::types::{CommonMeetingTag, MeetingStatus, QueerMeetingTag};

    fn meeting() -> Meeting {
        Meeting {
            _id: "abcde".into(),
            title: "T".into(),
            authority: "QA".into(),
            age_restriction: vec![18],
            time: Some(1_700_000_000_000),
            location: Some(MeetingLocation {
                name: "Loc".into(),
                lat: 48.37,
                lon: 10.9,
            }),
            place_id: None,
            online: None,
            place_to_be_announced: false,
            description: "desc".into(),
            price: vec![0.1, 5.0],
            trigger_warning: None,
            attendance: Some(42),
            rating: None,
            accessibility: None,
            tags: MeetingTags {
                freeform: vec!["x".into()],
                common: vec![CommonMeetingTag::Party],
                queer: vec![QueerMeetingTag::Queer],
            },
            status: MeetingStatus::Active,
            changed: Some(vec![ChangedMeeting {
                by: "u1".into(),
                at: 1_700_000_000_001,
            }]),
            cancelled: Some(false),
            deleted_at: None,
        }
    }

    #[test]
    fn the_hash_is_stable_and_sensitive() {
        let m = meeting();
        assert_eq!(hash_meeting(&m), hash_meeting(&m.clone()));
        let mut later = m.clone();
        later.changed.as_mut().unwrap()[0].at += 1;
        assert_ne!(
            hash_meeting(&m),
            hash_meeting(&later),
            "one millisecond matters"
        );
        let mut priced = m.clone();
        priced.price[0] = f32::from_bits(0.1f32.to_bits() + 1);
        assert_ne!(hash_meeting(&m), hash_meeting(&priced));
        let mut empty_text = m.clone();
        empty_text.accessibility = Some(String::new());
        assert_ne!(hash_meeting(&m), hash_meeting(&empty_text));
    }

    #[test]
    fn no_history_and_empty_history_are_the_same_row() {
        let mut none = meeting();
        none.changed = None;
        let mut empty = meeting();
        empty.changed = Some(vec![]);
        assert_eq!(hash_meeting(&none), hash_meeting(&empty));
    }

    #[test]
    fn the_digest_ignores_input_order_and_is_known_for_nothing() {
        let a = ("a".to_string(), [1u8; 32]);
        let b = ("b".to_string(), [2u8; 32]);
        assert_eq!(
            digest(vec![a.clone(), b.clone()]),
            digest(vec![b.clone(), a.clone()])
        );
        assert_ne!(digest(vec![a.clone()]), digest(vec![a, b]));
        assert_eq!(digest(Vec::new()), EMPTY_DIGEST);
    }

    #[test]
    fn json_keys_are_sorted() {
        let value = serde_json::json!({"b": [1, {"z": null, "a": "x"}], "a": true});
        let mut out = String::new();
        canonical_json(&value, &mut out);
        assert_eq!(out, r#"{"a":true,"b":[1,{"a":"x","z":null}]}"#);
    }
}
