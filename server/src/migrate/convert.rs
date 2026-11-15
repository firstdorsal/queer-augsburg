//! The conversion rules, collection by collection (research-postgres §4.2, shaped by
//! `data-shape.md`). Every document is read raw, field by field; a document with a problem
//! is reported by collection, field and reason and left out, and the run stops before
//! writing when anything was reported. The rules that default or drop something are counted
//! in the report so the rehearsal shows how often each one applied.

use super::config::Config;
use super::doc::{Doc, RuleUse};
use super::report::{Problem, Reason, Report, COLLECTIONS};
use super::source::{
    Converted, DocumentRow, GroupOrderRow, GroupRow, OriginalUserRow, PlaceRow, UserRow, VersionRow,
};
use crate::document_rooms::{text_of_state, MAX_STATE_BYTES};
use crate::document_rules::sort_key;
use crate::place_rules::place_name_key;
use crate::types::{
    Address, ChangedMeeting, InternalMember, Meeting, MeetingLocation, MeetingTags, Name,
    OnlineMeeting, SentEmailLog, User,
};
use bson::{Bson, Document};
use std::cell::RefCell;
use std::collections::{BTreeMap, HashSet};

/// The `_id` of the one group order record (`db.rs`).
const GROUP_ORDER_ID: &str = "main";

/// Converts every collection and runs the cross-collection checks. The counts of the dump
/// go to the report as `source`.
pub fn convert_all(
    raw: &BTreeMap<&'static str, Vec<Document>>,
    config: &Config,
    report: &mut Report,
) -> Converted {
    let mut converted = Converted::default();
    for collection in COLLECTIONS {
        let documents = raw.get(collection).map(Vec::as_slice).unwrap_or(&[]);
        report.collection(collection).source = Some(documents.len() as u64);
        match collection {
            "users" => converted.users = convert(collection, documents, config, report, user),
            "originalUsers" => {
                converted.original_users =
                    convert(collection, documents, config, report, original_user)
            }
            "places" => converted.places = convert(collection, documents, config, report, place),
            "meetings" => {
                converted.meetings = convert(collection, documents, config, report, meeting)
            }
            "sent_email_logs" => {
                converted.sent_email_logs =
                    convert(collection, documents, config, report, sent_email_log)
            }
            "email_drafts" => {}
            "documents" => {
                converted.documents = convert(collection, documents, config, report, document)
            }
            "document_groups" => {
                converted.groups = convert(collection, documents, config, report, group)
            }
            "document_group_order" => {
                converted.group_order = convert(collection, documents, config, report, group_order)
            }
            "document_versions" => {
                converted.versions = convert(collection, documents, config, report, version)
            }
            _ => {}
        }
    }
    cross_checks(&converted, report);
    converted
}

fn convert<T>(
    collection: &'static str,
    documents: &[Document],
    config: &Config,
    report: &mut Report,
    rule: fn(&Doc<'_>, &Document) -> Result<T, Problem>,
) -> Vec<T> {
    let rules = RefCell::new(Vec::<RuleUse>::new());
    let mut rows = Vec::with_capacity(documents.len());
    for document in documents {
        let doc = Doc::new(collection, document, &rules, config);
        match rule(&doc, document) {
            Ok(row) => rows.push(row),
            Err(problem) => report.error(problem),
        }
        for RuleUse { field, rule } in rules.borrow_mut().drain(..) {
            report.rule(collection, &field, rule);
        }
    }
    rows
}

fn user(d: &Doc<'_>, _raw: &Document) -> Result<UserRow, Problem> {
    let id = d.req_str("_id")?;
    let member = match d.opt_doc("member")? {
        None => None,
        Some(m) => Some(member(&m)?),
    };
    // Both a missing and a null list are the empty list (research-postgres §3.6 item 1).
    let capabilities = match d.opt_array("capabilities")? {
        None => {
            d.rule("capabilities", "missing_or_null_as_empty");
            Vec::new()
        }
        Some(_) => d.enum_array("capabilities")?,
    };
    // `admin`, `imported_from`, …: kept in `users.extra`, never read (research-postgres §4.2).
    // Relaxed Extended JSON in `jsonb`: integers stay exact JSON numbers, but Int32 and Int64
    // look the same and the key order is not kept. Nothing reads `extra`; the dump keeps the
    // exact BSON.
    let rest = d.unread();
    let extra = (!rest.is_empty()).then(|| Bson::Document(rest).into_relaxed_extjson());
    if extra
        .as_ref()
        .is_some_and(|extra| !crate::db::storable_value(extra))
    {
        return Err(Problem::new("users", "extra", Reason::NulCharacter));
    }
    Ok(UserRow {
        user: User {
            id,
            member,
            capabilities: Some(capabilities),
        },
        extra,
    })
}

fn member(d: &Doc<'_>) -> Result<InternalMember, Problem> {
    let _type = d.req_enum("type")?;
    let natural_person = d.req_bool("natural_person")?;
    let name = match d.opt_doc("name")? {
        None => None,
        Some(n) => {
            let name = Name {
                passport: n.req_str("passport")?,
                first_name: n.req_str("first_name")?,
                last_name: n.req_str("last_name")?,
            };
            n.finish()?;
            Some(name)
        }
    };
    let institution = d.opt_str("institution")?;
    let pronouns = d.opt_str("pronouns")?;
    let a = d.req_doc("address")?;
    let address = Address {
        street: a.req_str("street")?,
        number: a.req_str("number")?,
        addition: a.opt_str("addition")?,
        zip: a.req_str("zip")?,
        city: a.req_str("city")?,
        country: a.req_str("country")?,
    };
    a.finish()?;
    let member = InternalMember {
        _type,
        natural_person,
        name,
        institution,
        pronouns,
        address,
        email: d.req_str("email")?,
        phone: d.opt_str("phone")?,
        start_time_ms: d.req_i64("start_time_ms")?,
        end_time_ms: d.opt_i64("end_time_ms")?,
        status: d.opt_enum("status")?,
        user_notes: d.opt_str("user_notes")?,
        admin_notes: d.opt_str("admin_notes")?,
        reference: d.opt_str("reference")?,
        approved_charter: d.req_bool("approved_charter")?,
        approved_privacy: d.req_bool("approved_privacy")?,
        above_18: d.req_bool("above_18")?,
        honorary: d.req_bool("honorary")?,
    };
    d.finish()?;
    Ok(member)
}

/// The archive is kept as relaxed Extended JSON in `jsonb`, the shape the server writes new
/// snapshots in: every value as it was, integers as exact JSON numbers, but Int32 and Int64
/// look the same and the key order is not kept. Nothing reads the archive (the server only
/// inserts into `original_users`); the dump keeps the exact BSON. Only what the row needs is
/// checked: the user id and the time of the first submission, which the server set in the
/// same request that archived the user.
fn original_user(d: &Doc<'_>, raw: &Document) -> Result<OriginalUserRow, Problem> {
    let user_id = d.req_str("_id")?;
    let member = d.req_doc("member")?;
    // Snapshots from before the switch to milliseconds count in seconds.
    let created_at = match member.opt_i64("start_time_secs")? {
        Some(seconds) if member.opt_i64("start_time_ms")?.is_none() => {
            d.rule("member.start_time_secs", "as_created_at_in_ms");
            seconds * 1000
        }
        _ => {
            d.rule("member.start_time_ms", "as_created_at");
            member.req_i64("start_time_ms")?
        }
    };
    let snapshot = Bson::Document(raw.clone()).into_relaxed_extjson();
    if !crate::db::storable_value(&snapshot) {
        return Err(d.problem("", Reason::NulCharacter));
    }
    Ok(OriginalUserRow {
        user_id,
        snapshot,
        created_at,
    })
}

fn place(d: &Doc<'_>, _raw: &Document) -> Result<PlaceRow, Problem> {
    let _id = d.req_str("_id")?;
    let name = d.req_str("name")?;
    let name_key = d.req_str("name_key")?;
    let lat = d.req_f64("lat")?;
    let lon = d.req_f64("lon")?;
    let (created_by, created_at) = match d.opt_doc("created")? {
        None => (None, None),
        Some(c) => {
            let created = (Some(c.req_str("by")?), Some(c.req_i64("at")?));
            c.finish()?;
            created
        }
    };
    d.finish()?;
    // The key is what the unique index is on; the Rust and the mongosh implementation must
    // agree, else the row would be found under another name.
    if place_name_key(&name) != name_key {
        return Err(d.problem("name_key", Reason::KeyMismatch));
    }
    Ok(PlaceRow {
        _id,
        name,
        name_key,
        lat,
        lon,
        created_by,
        created_at,
    })
}

fn meeting(d: &Doc<'_>, _raw: &Document) -> Result<Meeting, Problem> {
    let _id = d.req_str("_id")?;
    let title = d.req_str("title")?;
    let authority = d.req_str("authority")?;
    let age_restriction = d
        .i64_array("age_restriction")?
        .into_iter()
        .map(|age| {
            u8::try_from(age).map_err(|_| d.problem("age_restriction[]", Reason::OutOfRange))
        })
        .collect::<Result<Vec<u8>, Problem>>()?;
    let time = d.opt_i64("time")?;
    let location = match d.opt_doc("location")? {
        None => None,
        Some(l) => {
            let location = MeetingLocation {
                name: l.req_str("name")?,
                lat: l.req_f64("lat")?,
                lon: l.req_f64("lon")?,
            };
            l.finish()?;
            Some(location)
        }
    };
    // 22 meetings from before places existed have a location and no `place_id` key.
    if location.is_some() && !d.has("place_id") {
        d.rule("place_id", "location_without_place_id");
    }
    let place_id = d.opt_str("place_id")?;
    let online = match d.opt_doc("online")? {
        None => None,
        Some(o) => {
            let online = OnlineMeeting {
                platform: o.req_str("platform")?,
                url: o.opt_str("url")?,
                members_only: o.req_bool("members_only")?,
                // A response flag (types.rs), never stored meaningfully.
                url_hidden: false,
            };
            o.ignore("url_hidden", "url_hidden_ignored");
            o.finish()?;
            Some(online)
        }
    };
    // `#[serde(default)]` in types.rs: the field exists since the places feature.
    let place_to_be_announced = match d.opt_bool("place_to_be_announced")? {
        Some(value) => value,
        None => {
            d.rule("place_to_be_announced", "missing_as_false");
            false
        }
    };
    let description = d.req_str("description")?;
    let price = d.f32_array("price")?;
    let trigger_warning = d.opt_str("trigger_warning")?;
    let attendance = d
        .opt_i64("attendance")?
        .map(|a| u16::try_from(a).map_err(|_| d.problem("attendance", Reason::OutOfRange)))
        .transpose()?;
    let rating = d.opt_f32("rating")?;
    let accessibility = d.opt_str("accessibility")?;
    let t = d.req_doc("tags")?;
    let tags = MeetingTags {
        freeform: t.string_array("freeform")?,
        common: t.enum_array("common")?,
        queer: t.enum_array("queer")?,
    };
    t.finish()?;
    let status = d.req_enum("status")?;
    let changed = match d.opt_array("changed")? {
        None => None,
        Some(_) => {
            let mut changes = Vec::new();
            for c in d.doc_array("changed")? {
                changes.push(ChangedMeeting {
                    by: c.req_str("by")?,
                    at: c.req_i64("at")?,
                });
                c.finish()?;
            }
            Some(changes)
        }
    };
    let cancelled = d.opt_bool("cancelled")?;
    let deleted_at = d.opt_i64("deleted_at")?;
    d.finish()?;
    Ok(Meeting {
        _id,
        title,
        authority,
        age_restriction,
        time,
        location,
        place_id,
        online,
        place_to_be_announced,
        description,
        price,
        trigger_warning,
        attendance,
        rating,
        accessibility,
        tags,
        status,
        changed,
        cancelled,
        deleted_at,
    })
}

/// A `u32` of the server that is stored in an `integer` column: `0..=i32::MAX`.
fn count_u32(d: &Doc<'_>, key: &str) -> Result<u32, Problem> {
    let value = d.req_i64(key)?;
    match i32::try_from(value) {
        Ok(fits) if fits >= 0 => Ok(fits as u32),
        _ => Err(d.problem(key, Reason::OutOfRange)),
    }
}

fn sent_email_log(d: &Doc<'_>, _raw: &Document) -> Result<SentEmailLog, Problem> {
    let log = SentEmailLog {
        _id: d.req_str("_id")?,
        sender_id: d.req_str("sender_id")?,
        sender_email: d.req_str("sender_email")?,
        subject: d.req_str("subject")?,
        body: d.req_str("body")?,
        attachment_names: d.string_array("attachment_names")?,
        sent_at: d.req_i64("sent_at")?,
        successful_count: count_u32(d, "successful_count")?,
        failed_count: count_u32(d, "failed_count")?,
        failed_emails: d.string_array("failed_emails")?,
        reply_to: d.opt_str("reply_to")?,
    };
    d.finish()?;
    Ok(log)
}

fn document(d: &Doc<'_>, _raw: &Document) -> Result<DocumentRow, Problem> {
    let row = DocumentRow {
        _id: d.req_str("_id")?,
        title: d.req_str("title")?,
        content: d.req_document_text("content")?,
        state: d.req_bytes("state")?,
        state_version: d.req_i64("state_version")?,
        group_ids: d.string_array("group_ids")?,
        created_by: d.req_str("created_by")?,
        created_at: d.req_i64("created_at")?,
        updated_at: d.req_i64("updated_at")?,
        deleted_by: d.opt_str("deleted_by")?,
        deleted_at: d.opt_i64("deleted_at")?,
    };
    d.finish()?;
    match (&row.deleted_by, &row.deleted_at) {
        (Some(_), None) => return Err(d.problem("deleted_at", Reason::Missing)),
        (None, Some(_)) => return Err(d.problem("deleted_by", Reason::Missing)),
        _ => {}
    }
    if row.state.len() > MAX_STATE_BYTES {
        return Err(d.problem("state", Reason::OutOfRange));
    }
    // The state is copied byte for byte; decoding it only proves the copy is a state.
    match text_of_state(&row.state) {
        Err(_) => return Err(d.problem("state", Reason::Undecodable)),
        Ok(text) if crate::db::storable_text(&text) != row.content.as_str() => {
            d.rule("state", "text_differs_from_content")
        }
        Ok(_) => {}
    }
    Ok(row)
}

fn group(d: &Doc<'_>, _raw: &Document) -> Result<GroupRow, Problem> {
    let row = GroupRow {
        _id: d.req_str("_id")?,
        name: d.req_str("name")?,
        name_key: d.req_str("name_key")?,
        document_order: d.string_array("document_order")?,
    };
    d.finish()?;
    if sort_key(&row.name) != row.name_key {
        return Err(d.problem("name_key", Reason::KeyMismatch));
    }
    Ok(row)
}

fn group_order(d: &Doc<'_>, _raw: &Document) -> Result<GroupOrderRow, Problem> {
    let row = GroupOrderRow {
        _id: d.req_str("_id")?,
        group_ids: d.string_array("group_ids")?,
    };
    d.finish()?;
    if row._id != GROUP_ORDER_ID {
        return Err(d.problem("_id", Reason::UnknownValue));
    }
    Ok(row)
}

fn version(d: &Doc<'_>, _raw: &Document) -> Result<VersionRow, Problem> {
    let row = VersionRow {
        _id: d.req_str("_id")?,
        document_id: d.req_str("document_id")?,
        content: d.req_document_text("content")?,
        editors: d.string_array("editors")?,
        saved_at: d.req_i64("saved_at")?,
    };
    d.finish()?;
    Ok(row)
}

/// Duplicate ids and keys, references between collections, and the one warning the data
/// may carry (a `place_id` without a place: v1 had no foreign key, and `location` is what
/// readers use, research-postgres §4.4 item 4).
fn cross_checks(c: &Converted, report: &mut Report) {
    duplicates("users", "_id", c.users.iter().map(|u| &u.user.id), report);
    duplicates(
        "originalUsers",
        "_id",
        c.original_users.iter().map(|u| &u.user_id),
        report,
    );
    duplicates("places", "_id", c.places.iter().map(|p| &p._id), report);
    duplicates(
        "places",
        "name_key",
        c.places.iter().map(|p| &p.name_key),
        report,
    );
    duplicates("meetings", "_id", c.meetings.iter().map(|m| &m._id), report);
    duplicates(
        "sent_email_logs",
        "_id",
        c.sent_email_logs.iter().map(|l| &l._id),
        report,
    );
    duplicates(
        "documents",
        "_id",
        c.documents.iter().map(|d| &d._id),
        report,
    );
    duplicates(
        "document_groups",
        "_id",
        c.groups.iter().map(|g| &g._id),
        report,
    );
    duplicates(
        "document_groups",
        "name_key",
        c.groups.iter().map(|g| &g.name_key),
        report,
    );
    duplicates(
        "document_group_order",
        "_id",
        c.group_order.iter().map(|o| &o._id),
        report,
    );
    duplicates(
        "document_versions",
        "_id",
        c.versions.iter().map(|v| &v._id),
        report,
    );

    let users: HashSet<&str> = c.users.iter().map(|u| u.user.id.as_str()).collect();
    for original in &c.original_users {
        if !users.contains(original.user_id.as_str()) {
            report.warn(Problem::new("originalUsers", "_id", Reason::Dangling));
        }
    }
    let places: HashSet<&str> = c.places.iter().map(|p| p._id.as_str()).collect();
    for meeting in &c.meetings {
        if let Some(place_id) = &meeting.place_id {
            if !places.contains(place_id.as_str()) {
                report.warn(Problem::new("meetings", "place_id", Reason::Dangling));
            }
        }
    }
    let groups: HashSet<&str> = c.groups.iter().map(|g| g._id.as_str()).collect();
    for document in &c.documents {
        for group_id in &document.group_ids {
            if !groups.contains(group_id.as_str()) {
                report.error(Problem::new("documents", "group_ids[]", Reason::Dangling));
            }
        }
        // An id twice is kept twice, as the server stores it (MongoDB stored the array as
        // sent).
    }
    let documents: HashSet<&str> = c.documents.iter().map(|d| d._id.as_str()).collect();
    for version in &c.versions {
        if !documents.contains(version.document_id.as_str()) {
            report.error(Problem::new(
                "document_versions",
                "document_id",
                Reason::Dangling,
            ));
        }
    }
}

fn duplicates<'a>(
    collection: &'static str,
    field: &str,
    values: impl Iterator<Item = &'a String>,
    report: &mut Report,
) {
    let mut seen = HashSet::new();
    for value in values {
        if !seen.insert(value.as_str()) {
            report.error(Problem::new(collection, field, Reason::DuplicateKey));
        }
    }
}
