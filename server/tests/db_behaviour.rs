//! Characterization tests: the observable behaviour of every `DB` method and of the document
//! store, through their own return values. They were written and made green against MongoDB
//! and are the oracle for the Postgres port: the test bodies do not change with the backend.
//! Only the `backend` module knows the storage, through two seams: raw fixtures in (the old
//! document shapes the methods must still read) and raw rows out (what no method returns).
//! The assertions that differ by backend say so where they stand (`KIND`).

#![forbid(unsafe_code)]

use backend::db::{CreateMeetingsError, GroupNameError, DB};
use backend::document_rooms::{text_of_state, DocumentStore, NewVersion, SaveOutcome, SavedState};
use backend::document_rules::arrange_documents;
use backend::interossea::Auth;
use backend::types::{
    ChangedMeeting, DraftStatus, EmailAttachment, EmailDraft, GetDocumentsResponseBody, Meeting,
    MeetingLocation, MeetingStatus, MeetingTypeQuery, MemberType, MembershipStatus, OnlineMeeting,
    SentEmailLog, SubmittedMember, User, UserCapabilities,
};
use serde_json::{json, Value};
use std::collections::HashSet;

use self::storage::{Backend, Kind, KIND};

mod db_support;
mod drop_guard;

/// The storage behind the tests. `TEST_DATABASE_URL` names a Postgres server, where each test
/// has a schema of its own (`db_support`); CI always sets it.
mod storage {
    use super::db_support::TestSchema;
    use backend::db::{PgDocumentStore, SearchableDocument, DB};
    use backend::document_rooms::DocumentStore;
    use backend::types::{Meeting, User};
    use futures_util::TryStreamExt;
    use serde_json::Value;
    use sqlx::types::Json;
    use sqlx::{AssertSqlSafe, PgPool};
    use std::sync::Arc;

    /// Which expectations apply where they differ; the other variant is never built here.
    #[allow(dead_code)]
    pub enum Kind {
        Mongo,
        Postgres,
    }

    pub const KIND: Kind = Kind::Postgres;

    pub struct Backend {
        pub db: Arc<DB>,
        schema: TestSchema,
    }

    impl Backend {
        /// A schema of its own, as tests run in parallel. `None` without a server, outside CI.
        pub async fn new() -> Option<Self> {
            let schema = TestSchema::new().await?;
            let db = schema.migrated(4).await;
            Some(Self {
                db: Arc::new(db),
                schema,
            })
        }

        fn pool(&self) -> &PgPool {
            &self.db.pool
        }

        pub fn store(&self) -> impl DocumentStore {
            PgDocumentStore(self.db.clone())
        }

        /// What the server does at every start.
        pub async fn prepare_again(&self) {
            self.db.migrate().await.unwrap();
        }

        /// A meeting as the migrator stores one from an old document: fields it did not
        /// have are null or their defaults, a missing history has no rows.
        pub async fn insert_meeting(&self, raw: Value) {
            let meeting: Meeting = serde_json::from_value(raw).unwrap();
            let location = meeting.location.as_ref();
            let online = meeting.online.as_ref();
            sqlx::query(
                r#"
                INSERT INTO meetings (
                    _id, title, authority, age_restriction, time,
                    location_name, location_lat, location_lon, place_id,
                    online_platform, online_url, online_members_only, place_to_be_announced,
                    description, price, trigger_warning, attendance, rating, accessibility,
                    tags_freeform, tags_common, tags_queer, status, cancelled, deleted_at
                ) VALUES (
                    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17,
                    $18, $19, $20, $21, $22, $23, $24, $25
                )
                "#,
            )
            .bind(&meeting._id)
            .bind(&meeting.title)
            .bind(&meeting.authority)
            .bind(
                meeting
                    .age_restriction
                    .iter()
                    .map(|age| *age as i16)
                    .collect::<Vec<_>>(),
            )
            .bind(meeting.time)
            .bind(location.map(|location| location.name.clone()))
            .bind(location.map(|location| location.lat))
            .bind(location.map(|location| location.lon))
            .bind(&meeting.place_id)
            .bind(online.map(|online| online.platform.clone()))
            .bind(online.and_then(|online| online.url.clone()))
            .bind(online.map(|online| online.members_only))
            .bind(meeting.place_to_be_announced)
            .bind(&meeting.description)
            .bind(&meeting.price)
            .bind(&meeting.trigger_warning)
            .bind(meeting.attendance.map(i32::from))
            .bind(meeting.rating)
            .bind(&meeting.accessibility)
            .bind(&meeting.tags.freeform)
            .bind(&meeting.tags.common)
            .bind(&meeting.tags.queer)
            .bind(meeting.status)
            .bind(meeting.cancelled)
            .bind(meeting.deleted_at)
            .execute(self.pool())
            .await
            .unwrap();
            for (position, change) in meeting.changed.iter().flatten().enumerate() {
                sqlx::query(
                    "INSERT INTO meeting_changes (meeting_id, position, at, by) VALUES ($1, $2, $3, $4)",
                )
                .bind(&meeting._id)
                .bind(position as i32)
                .bind(change.at)
                .bind(&change.by)
                .execute(self.pool())
                .await
                .unwrap();
            }
        }

        /// A user as the migrator stores one: `capabilities: null` becomes the empty list,
        /// the member its own row, unknown fields go to `extra`.
        pub async fn insert_user(&self, raw: Value) {
            let user: User = serde_json::from_value(raw.clone()).unwrap();
            let extra: serde_json::Map<String, Value> = raw
                .as_object()
                .unwrap()
                .iter()
                .filter(|(key, _)| !matches!(key.as_str(), "_id" | "member" | "capabilities"))
                .map(|(key, value)| (key.clone(), value.clone()))
                .collect();
            sqlx::query("INSERT INTO users (_id, capabilities, extra) VALUES ($1, $2, $3)")
                .bind(&user.id)
                .bind(user.capabilities.clone().unwrap_or_default())
                .bind((!extra.is_empty()).then_some(Json(Value::Object(extra))))
                .execute(self.pool())
                .await
                .unwrap();
            let Some(m) = &user.member else { return };
            sqlx::query(
                r#"
                INSERT INTO members (
                    user_id, member_type, natural_person, name_passport, name_first, name_last,
                    institution, pronouns, address_street, address_number, address_addition,
                    address_zip, address_city, address_country, email, phone, start_time_ms,
                    end_time_ms, status, user_notes, admin_notes, reference, approved_charter,
                    approved_privacy, above_18, honorary
                ) VALUES (
                    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17,
                    $18, $19, $20, $21, $22, $23, $24, $25, $26
                )
                "#,
            )
            .bind(&user.id)
            .bind(m._type)
            .bind(m.natural_person)
            .bind(m.name.as_ref().map(|name| name.passport.clone()))
            .bind(m.name.as_ref().map(|name| name.first_name.clone()))
            .bind(m.name.as_ref().map(|name| name.last_name.clone()))
            .bind(&m.institution)
            .bind(&m.pronouns)
            .bind(&m.address.street)
            .bind(&m.address.number)
            .bind(&m.address.addition)
            .bind(&m.address.zip)
            .bind(&m.address.city)
            .bind(&m.address.country)
            .bind(&m.email)
            .bind(&m.phone)
            .bind(m.start_time_ms)
            .bind(m.end_time_ms)
            .bind(m.status.clone())
            .bind(&m.user_notes)
            .bind(&m.admin_notes)
            .bind(&m.reference)
            .bind(m.approved_charter)
            .bind(m.approved_privacy)
            .bind(m.above_18)
            .bind(m.honorary)
            .execute(self.pool())
            .await
            .unwrap();
        }

        /// A place as stored, possibly without `created`.
        pub async fn insert_place(&self, raw: Value) {
            let created = &raw["created"];
            sqlx::query(
                r#"
                INSERT INTO places (_id, name, name_key, lat, lon, created_by, created_at)
                VALUES ($1, $2, $3, $4, $5, $6, $7)
                "#,
            )
            .bind(raw["_id"].as_str().unwrap())
            .bind(raw["name"].as_str().unwrap())
            .bind(raw["name_key"].as_str().unwrap())
            .bind(raw["lat"].as_f64().unwrap())
            .bind(raw["lon"].as_f64().unwrap())
            .bind(created["by"].as_str())
            .bind(created["at"].as_i64())
            .execute(self.pool())
            .await
            .unwrap();
        }

        /// A version as stored (`_id`, `document_id`, `content`, `editors`, `saved_at`).
        pub async fn insert_version(&self, raw: Value) {
            let editors: Vec<String> = serde_json::from_value(raw["editors"].clone()).unwrap();
            sqlx::query(
                r#"
                INSERT INTO document_versions (_id, document_id, content, editors, saved_at)
                VALUES ($1, $2, $3, $4, $5)
                "#,
            )
            .bind(raw["_id"].as_str().unwrap())
            .bind(raw["document_id"].as_str().unwrap())
            .bind(raw["content"].as_str().unwrap())
            .bind(editors)
            .bind(raw["saved_at"].as_i64().unwrap())
            .execute(self.pool())
            .await
            .unwrap();
        }

        /// The document's `created_at` changed in place, as a clock that went back or a
        /// migrated document would have it; MongoDB keeps an updated document where it was.
        pub async fn backdate_document(&self, document_id: &str, created_at: i64) {
            let updated = sqlx::query("UPDATE documents SET created_at = $2 WHERE _id = $1")
                .bind(document_id)
                .bind(created_at)
                .execute(self.pool())
                .await
                .unwrap();
            assert_eq!(updated.rows_affected(), 1, "{document_id}");
        }

        /// The stored Yjs state of a document, deleted or not.
        pub async fn document_state(&self, document_id: &str) -> Option<Vec<u8>> {
            sqlx::query_scalar("SELECT state FROM documents WHERE _id = $1")
                .bind(document_id)
                .fetch_optional(self.pool())
                .await
                .unwrap()
        }

        /// The archived users of a user id, oldest first.
        pub async fn original_user_snapshots(&self, user_id: &str) -> Vec<Value> {
            sqlx::query_scalar(
                "SELECT snapshot FROM original_users WHERE user_id = $1 ORDER BY created_at",
            )
            .bind(user_id)
            .fetch_all(self.pool())
            .await
            .unwrap()
        }

        pub async fn sent_email_log(&self, log_id: &str) -> Option<Value> {
            sqlx::query_scalar("SELECT to_jsonb(l) FROM sent_email_logs l WHERE _id = $1")
                .bind(log_id)
                .fetch_optional(self.pool())
                .await
                .unwrap()
        }

        pub async fn meeting_count(&self) -> u64 {
            let count: i64 = sqlx::query_scalar("SELECT count(*) FROM meetings")
                .fetch_one(self.pool())
                .await
                .unwrap();
            count as u64
        }

        pub async fn version_count(&self) -> u64 {
            let count: i64 = sqlx::query_scalar("SELECT count(*) FROM document_versions")
                .fetch_one(self.pool())
                .await
                .unwrap();
            count as u64
        }

        /// From now on, storing a meeting with this title fails.
        pub async fn refuse_meeting_title(&self, title: &str) {
            sqlx::query(AssertSqlSafe(format!(
                "ALTER TABLE meetings ADD CONSTRAINT refused_title CHECK (title <> '{title}')"
            )))
            .execute(self.pool())
            .await
            .unwrap();
        }

        /// Statistics as autovacuum keeps them on a running server, so the planner picks the
        /// plans production gets: for small tables a sequential scan, which returns rows in
        /// their physical order, where an edit can move a row to the end. Only the tables of
        /// this test's schema: a plain `ANALYZE` would change the other tests' statistics too.
        pub async fn analyze(&self) {
            let tables: Vec<String> = sqlx::query_scalar(
                "SELECT format('%I', tablename) FROM pg_tables WHERE schemaname = current_schema()",
            )
            .fetch_all(self.pool())
            .await
            .unwrap();
            assert!(!tables.is_empty(), "the schema has no tables");
            // The names come from the catalog, quoted by format('%I').
            sqlx::query(AssertSqlSafe(format!("ANALYZE {}", tables.join(", "))))
                .execute(self.pool())
                .await
                .unwrap();
        }

        /// The user's row written again unchanged, as the migrator's re-run upserts every row.
        /// On Postgres the new version of a row goes after the others, so a plan that returns
        /// rows as stored returns it last; MongoDB leaves an updated document where it was.
        pub async fn rewrite_user(&self, id: &str) {
            self.rewrite(
                "users",
                "UPDATE users SET seq = seq WHERE _id = $1 RETURNING ctid::text",
                &[id],
            )
            .await;
        }

        /// The user's member row written again unchanged (see `rewrite_user`).
        pub async fn rewrite_member(&self, user_id: &str) {
            self.rewrite(
                "members",
                "UPDATE members SET status = status WHERE user_id = $1 RETURNING ctid::text",
                &[user_id],
            )
            .await;
        }

        /// The history entry at `position` written again unchanged (see `rewrite_user`).
        pub async fn rewrite_change(&self, meeting_id: &str, position: i32) {
            self.rewrite(
                "meeting_changes",
                "UPDATE meeting_changes SET at = at \
                 WHERE meeting_id = $1 AND position = $2::integer RETURNING ctid::text",
                &[meeting_id, &position.to_string()],
            )
            .await;
        }

        /// The document's group at `position` written again unchanged (see `rewrite_user`).
        pub async fn rewrite_group_membership(&self, document_id: &str, position: i32) {
            self.rewrite(
                "document_group_members",
                "UPDATE document_group_members SET group_id = group_id \
                 WHERE document_id = $1 AND position = $2::integer RETURNING ctid::text",
                &[document_id, &position.to_string()],
            )
            .await;
        }

        /// `update` rewrites exactly one row of `table` and returns its `ctid`, which must be
        /// the table's last one now.
        async fn rewrite(&self, table: &str, update: &'static str, keys: &[&str]) {
            let mut query = sqlx::query_scalar::<_, String>(update);
            for key in keys {
                query = query.bind(*key);
            }
            let rewritten = query.fetch_all(self.pool()).await.unwrap();
            assert_eq!(rewritten.len(), 1, "{update} {keys:?}");
            // The name is one of the literals above.
            let last: String = sqlx::query_scalar(AssertSqlSafe(format!(
                "SELECT max(ctid)::text FROM {table}"
            )))
            .fetch_one(self.pool())
            .await
            .unwrap();
            assert_eq!(
                rewritten[0], last,
                "the rewritten row of {table} is not its last"
            );
        }

        /// Everything `DB::searchable_documents` yields.
        pub async fn search_all(&self) -> Vec<SearchableDocument> {
            self.db
                .searchable_documents()
                .await
                .unwrap()
                .try_collect()
                .await
                .unwrap()
        }

        pub async fn drop(self) {
            self.db.pool.close().await;
            drop(self.db);
            self.schema.drop().await;
        }
    }
}

fn auth(user: Option<&str>) -> Auth {
    Auth {
        authenticated_user: user.map(str::to_string),
        token: None,
        user_assertion: None,
    }
}

/// A meeting of today's shape, as the handlers build one.
fn meeting(title: &str) -> Meeting {
    serde_json::from_value(json!({
        "_id": "", "title": title, "authority": "", "age_restriction": [0],
        "time": 1_793_124_000_000_i64, "location": null,
        "description": "", "price": [0.0], "trigger_warning": null, "attendance": null,
        "rating": null, "accessibility": null,
        "tags": {"freeform": [], "common": [], "queer": []}, "status": "Planned",
        "changed": null, "cancelled": false, "deleted_at": null
    }))
    .unwrap()
}

/// A meeting as stored before places, online meetings and "to be announced" existed: no
/// `place_id`, `online`, `place_to_be_announced` or `deleted_at`, `changed` and `cancelled`
/// null. Tests set what they need.
fn stored_meeting(id: &str, status: &str, time: Option<i64>) -> Value {
    json!({
        "_id": id, "title": format!("Treffen {id}"), "authority": "", "age_restriction": [0],
        "time": time, "location": null,
        "description": "", "price": [0.0], "trigger_warning": null, "attendance": null,
        "rating": null, "accessibility": null,
        "tags": {"freeform": [], "common": [], "queer": []}, "status": status,
        "changed": null, "cancelled": null
    })
}

fn changes(ats: &[i64]) -> Value {
    Value::Array(
        ats.iter()
            .map(|at| json!({ "by": "u", "at": at }))
            .collect(),
    )
}

fn member(email: &str, status: Option<&str>) -> Value {
    json!({
        "type": "Active", "natural_person": true, "name": null, "institution": null,
        "pronouns": null,
        "address": { "street": "S", "number": "1", "addition": null, "zip": "86150",
                     "city": "Augsburg", "country": "DE" },
        "email": email, "phone": null, "start_time_ms": 1_i64, "end_time_ms": null,
        "status": status, "user_notes": null, "admin_notes": null, "reference": null,
        "approved_charter": true, "approved_privacy": true, "above_18": true,
        "honorary": false,
    })
}

fn submitted(email: &str) -> SubmittedMember {
    serde_json::from_value(json!({
        "type": "Supporting", "natural_person": true,
        "name": { "passport": "Anna Muster", "first_name": "Anna", "last_name": "Muster" },
        "institution": null, "pronouns": "sie",
        "address": { "street": "Weg", "number": "2a", "addition": null, "zip": "86150",
                     "city": "Augsburg", "country": "DE" },
        "email": email, "phone": "+49 821 1", "user_notes": "Hallo", "reference": "Flyer",
        "approved_charter": true, "approved_privacy": true, "above_18": true
    }))
    .unwrap()
}

fn draft(id: &str) -> EmailDraft {
    EmailDraft {
        _id: id.to_string(),
        sender_id: "sender".to_string(),
        sender_email: "sender@example.invalid".to_string(),
        subject: "Betreff".to_string(),
        body: "Text".to_string(),
        attachments: vec![
            EmailAttachment {
                filename: "a.txt".to_string(),
                content_type: "text/plain".to_string(),
                data: "aGFsbG8=".to_string(),
            },
            EmailAttachment {
                filename: "leer.bin".to_string(),
                content_type: "application/octet-stream".to_string(),
                data: String::new(),
            },
        ],
        verification_code: "1234".to_string(),
        created_at: 1,
        recipient_count: 7,
        status: DraftStatus::Pending,
        reply_to: Some("reply@example.invalid".to_string()),
    }
}

fn ids(meetings: &[Meeting]) -> Vec<&str> {
    meetings
        .iter()
        .map(|meeting| meeting._id.as_str())
        .collect()
}

async fn listed(db: &DB) -> GetDocumentsResponseBody {
    let (groups, group_order, documents) = db.get_document_list().await.unwrap();
    arrange_documents(groups, &group_order, documents)
}

fn now_ms() -> i64 {
    chrono::Utc::now().timestamp_millis()
}

// --- schema -------------------------------------------------------------------------------

#[tokio::test]
async fn the_schema_can_be_prepared_again_on_every_start() {
    let Some(backend) = Backend::new().await else {
        return;
    };
    backend.prepare_again().await;
    backend.prepare_again().await;
    backend.drop().await;
}

// --- meetings -----------------------------------------------------------------------------

#[tokio::test]
async fn the_published_window_has_only_dated_active_live_meetings_in_time_order() {
    let Some(backend) = Backend::new().await else {
        return;
    };
    let db = &backend.db;
    for raw in [
        stored_meeting("b", "Active", Some(20)),
        stored_meeting("a", "Active", Some(20)),
        stored_meeting("c", "Active", Some(10)),
        stored_meeting("d", "Active", Some(30)),
        stored_meeting("e", "Active", Some(5)),
        stored_meeting("f", "Planned", Some(15)),
        stored_meeting("g", "Active", None),
    ] {
        backend.insert_meeting(raw).await;
    }
    let mut deleted = stored_meeting("h", "Active", Some(15));
    deleted["deleted_at"] = json!(16);
    backend.insert_meeting(deleted).await;

    let found = db.get_published_meetings_between(10, 30, 10).await.unwrap();
    assert_eq!(ids(&found), ["c", "a", "b"]);
    let found = db.get_published_meetings_between(10, 30, 2).await.unwrap();
    assert_eq!(ids(&found), ["c", "a"]);
    let found = db.get_published_meetings_between(31, 40, 10).await.unwrap();
    assert!(found.is_empty());
    backend.drop().await;
}

#[tokio::test]
async fn meeting_lists_leave_deleted_meetings_out_and_count_only_live_ones() {
    let Some(backend) = Backend::new().await else {
        return;
    };
    let db = &backend.db;
    let mut a = stored_meeting("a", "Active", Some(100));
    a["changed"] = changes(&[1]);
    let mut b = stored_meeting("b", "Active", Some(200));
    b["changed"] = changes(&[1]);
    b["deleted_at"] = json!(50);
    let c = stored_meeting("c", "Active", None);
    let p = stored_meeting("p", "Planned", Some(300));
    for raw in [a, b, c, p] {
        backend.insert_meeting(raw).await;
    }

    let (found, count) = db
        .get_meetings(MeetingTypeQuery::Active, None, false, None)
        .await
        .unwrap();
    assert_eq!(ids(&found), ["a", "c"], "latest first, undated last");
    assert_eq!(count, 2);

    let (found, count) = db
        .get_meetings(MeetingTypeQuery::Active, None, true, None)
        .await
        .unwrap();
    assert_eq!(ids(&found), ["b", "a", "c"]);
    assert_eq!(count, 2, "the count never includes deleted meetings");
    assert_eq!(found[0].deleted_at, Some(50));

    let (found, count) = db
        .get_meetings(MeetingTypeQuery::Active, None, false, Some(150))
        .await
        .unwrap();
    assert!(found.is_empty());
    assert_eq!(count, 0);
    let (found, count) = db
        .get_meetings(MeetingTypeQuery::Active, None, true, Some(150))
        .await
        .unwrap();
    assert_eq!(ids(&found), ["b"]);
    assert_eq!(count, 0);
    let (found, count) = db
        .get_meetings(MeetingTypeQuery::Active, None, false, Some(100))
        .await
        .unwrap();
    assert_eq!(ids(&found), ["a"], "starting_from is inclusive");
    assert_eq!(count, 1);

    let (found, count) = db
        .get_meetings(MeetingTypeQuery::Planned, None, false, None)
        .await
        .unwrap();
    assert_eq!(ids(&found), ["p"]);
    assert_eq!(count, 1);
    backend.drop().await;
}

#[tokio::test]
async fn delta_sync_returns_what_changed_or_was_deleted_after_since() {
    let Some(backend) = Backend::new().await else {
        return;
    };
    let db = &backend.db;
    let mut a = stored_meeting("a", "Active", Some(100));
    a["changed"] = changes(&[5, 15]);
    let mut b = stored_meeting("b", "Active", Some(200));
    b["changed"] = changes(&[5]);
    let mut c = stored_meeting("c", "Active", Some(300));
    c["deleted_at"] = json!(20);
    let mut d = stored_meeting("d", "Active", Some(400));
    d["changed"] = changes(&[5]);
    d["deleted_at"] = json!(8);
    let mut p = stored_meeting("p", "Planned", Some(500));
    p["changed"] = changes(&[15]);
    for raw in [a, b, c, d, p] {
        backend.insert_meeting(raw).await;
    }

    let (found, count) = db
        .get_meetings(MeetingTypeQuery::Active, Some(10), true, None)
        .await
        .unwrap();
    assert_eq!(
        ids(&found),
        ["c", "a"],
        "a later change counts even after an older one"
    );
    assert_eq!(count, 2, "the count is of all live meetings of the type");

    // `starting_from` is for the duplicate check and does not combine with `since`.
    let (found, count) = db
        .get_meetings(MeetingTypeQuery::Active, Some(10), true, Some(1_000))
        .await
        .unwrap();
    assert_eq!(ids(&found), ["c", "a"]);
    assert_eq!(count, 2);

    // MongoDB's `$gt` on both: a change or a deletion at exactly `since` is not newer.
    let (found, _) = db
        .get_meetings(MeetingTypeQuery::Active, Some(15), true, None)
        .await
        .unwrap();
    assert_eq!(ids(&found), ["c"], "a change at `since` is not after it");
    let (found, _) = db
        .get_meetings(MeetingTypeQuery::Active, Some(20), true, None)
        .await
        .unwrap();
    assert!(found.is_empty(), "a deletion at `since` is not after it");
    backend.drop().await;
}

#[tokio::test]
async fn deleting_a_meeting_stamps_it_and_records_who_did_it() {
    let Some(backend) = Backend::new().await else {
        return;
    };
    let db = &backend.db;
    let created = db
        .create_meetings(vec![meeting("A"), meeting("B")], "creator")
        .await
        .unwrap();
    let (a, b) = (&created[0]._id, &created[1]._id);

    let before = now_ms();
    db.delete_meeting(a, &auth(Some("x"))).await.unwrap();
    let stored = db.get_meeting(a).await.unwrap().unwrap();
    let deleted_at = stored.deleted_at.unwrap();
    assert!((before..=now_ms()).contains(&deleted_at));
    let changed = stored.changed.unwrap();
    assert_eq!(changed.len(), 2);
    assert_eq!(changed[0], created[0].changed.as_ref().unwrap()[0]);
    assert_eq!(changed[1].by, "x");
    assert_eq!(
        changed[1].at, deleted_at,
        "the change carries the deletion time"
    );

    db.delete_meeting(b, &auth(None)).await.unwrap();
    let stored = db.get_meeting(b).await.unwrap().unwrap();
    assert_eq!(stored.changed.unwrap()[1].by, "unknown");

    // Deleting again stamps again: the method does not check the state.
    db.delete_meeting(a, &auth(Some("y"))).await.unwrap();
    assert_eq!(
        db.get_meeting(a)
            .await
            .unwrap()
            .unwrap()
            .changed
            .unwrap()
            .len(),
        3
    );

    assert!(db.delete_meeting("nope", &auth(Some("x"))).await.is_err());
    backend.drop().await;
}

#[tokio::test]
async fn deleting_an_old_meeting_starts_its_history() {
    let Some(backend) = Backend::new().await else {
        return;
    };
    let db = &backend.db;
    backend
        .insert_meeting(stored_meeting("old01", "Active", Some(7)))
        .await;
    let mut no_history = stored_meeting("old02", "Active", Some(8));
    no_history.as_object_mut().unwrap().remove("changed");
    backend.insert_meeting(no_history).await;

    db.delete_meeting("old02", &auth(Some("x"))).await.unwrap();
    let stored = db.get_meeting("old02").await.unwrap().unwrap();
    let changed = stored.changed.unwrap();
    assert_eq!(changed.len(), 1);
    assert_eq!(Some(changed[0].at), stored.deleted_at);

    let result = db.delete_meeting("old01", &auth(Some("x"))).await;
    match KIND {
        // `$push` refuses a field that holds null instead of an array.
        Kind::Mongo => assert!(result.is_err()),
        Kind::Postgres => {
            result.unwrap();
            let stored = db.get_meeting("old01").await.unwrap().unwrap();
            assert_eq!(stored.changed.unwrap().len(), 1);
        }
    }
    backend.drop().await;
}

#[tokio::test]
async fn saving_a_meeting_appends_a_change_and_stores_everything_else_as_sent() {
    let Some(backend) = Backend::new().await else {
        return;
    };
    let db = &backend.db;
    let created = db
        .create_meetings(vec![meeting("A")], "creator")
        .await
        .unwrap();
    let first_change = created[0].changed.as_ref().unwrap()[0].clone();

    let mut sent = created[0].clone();
    sent.title = "Neu".to_string();
    sent.authority = "Orga".to_string();
    sent.age_restriction = vec![16, 18];
    sent.time = Some(1_793_200_000_000);
    sent.location = Some(MeetingLocation {
        name: "Café".to_string(),
        lat: 48.3705,
        lon: 10.8978,
    });
    sent.place_id = Some("pl1".to_string());
    sent.online = Some(OnlineMeeting {
        platform: "Zoom".to_string(),
        url: Some("https://example.invalid/z".to_string()),
        members_only: true,
        url_hidden: false,
    });
    sent.place_to_be_announced = false;
    sent.description = "Text\n\nmit Absatz".to_string();
    sent.price = vec![1.5, 2.25];
    sent.trigger_warning = Some("laut".to_string());
    sent.attendance = Some(12);
    sent.rating = Some(4.5);
    sent.accessibility = Some("ebenerdig".to_string());
    sent.tags = serde_json::from_value(json!({
        "freeform": ["Tanz", "Bar"], "common": ["Party", "Meet"], "queer": ["Trans", "Bi"]
    }))
    .unwrap();
    sent.status = MeetingStatus::Active;
    sent.cancelled = Some(true);
    // What a client sends as history is ignored.
    sent.changed = Some(vec![ChangedMeeting {
        by: "fake".to_string(),
        at: 1,
    }]);

    let before = now_ms();
    db.update_meeting(&mut sent, &auth(Some("editor")))
        .await
        .unwrap();
    let changed = sent.changed.clone().unwrap();
    assert_eq!(changed.len(), 2);
    assert_eq!(changed[0], first_change);
    assert_eq!(changed[1].by, "editor");
    assert!((before..=now_ms()).contains(&changed[1].at));

    let stored = db.get_meeting(&sent._id).await.unwrap().unwrap();
    assert_eq!(stored, sent);

    // The second save keeps both entries; an online meeting without a link and a place
    // to be announced round-trip too.
    sent.online = Some(OnlineMeeting {
        platform: String::new(),
        url: None,
        members_only: false,
        url_hidden: false,
    });
    sent.location = None;
    sent.place_id = None;
    sent.place_to_be_announced = true;
    sent.attendance = None;
    sent.rating = None;
    sent.cancelled = Some(false);
    db.update_meeting(&mut sent, &auth(Some("editor")))
        .await
        .unwrap();
    assert_eq!(sent.changed.as_ref().unwrap().len(), 3);
    assert_eq!(db.get_meeting(&sent._id).await.unwrap().unwrap(), sent);
    assert_eq!(backend.meeting_count().await, 1);
    backend.drop().await;
}

#[tokio::test]
async fn a_history_keeps_its_order_in_every_read_and_save() {
    let Some(backend) = Backend::new().await else {
        return;
    };
    let db = &backend.db;
    // Not in the order of `at` either, which has an index.
    let mut raw = stored_meeting("m", "Active", Some(20));
    raw["changed"] = changes(&[30, 10, 20]);
    backend.insert_meeting(raw).await;
    // As stored, the first entry now comes last.
    backend.rewrite_change("m", 0).await;
    backend.analyze().await;
    let ats = |meeting: &Meeting| -> Vec<i64> {
        meeting
            .changed
            .iter()
            .flatten()
            .map(|change| change.at)
            .collect()
    };

    let found = db.get_published_meetings_between(10, 30, 10).await.unwrap();
    assert_eq!(ats(&found[0]), [30, 10, 20], "the published window");
    let (found, _) = db
        .get_meetings(MeetingTypeQuery::Active, None, false, None)
        .await
        .unwrap();
    assert_eq!(ats(&found[0]), [30, 10, 20], "the meeting list");
    let mut stored = db.get_meeting("m").await.unwrap().unwrap();
    assert_eq!(ats(&stored), [30, 10, 20], "one meeting");
    db.update_meeting(&mut stored, &auth(Some("editor")))
        .await
        .unwrap();
    let saved = ats(&stored);
    assert_eq!(saved[..3], [30, 10, 20], "the saved meeting");
    assert_eq!(saved.len(), 4);
    backend.drop().await;
}

#[tokio::test]
async fn saving_an_unknown_meeting_creates_it_with_a_fresh_id() {
    let Some(backend) = Backend::new().await else {
        return;
    };
    let db = &backend.db;
    let mut sent = meeting("Neu");
    sent._id = "nope".to_string();
    sent.changed = Some(vec![ChangedMeeting {
        by: "fake".to_string(),
        at: 1,
    }]);
    db.update_meeting(&mut sent, &auth(Some("editor")))
        .await
        .unwrap();
    // The caller's meeting is left as it was: the handler returns it as sent.
    assert_eq!(sent._id, "nope");
    assert_eq!(sent.changed.as_ref().unwrap()[0].by, "fake");
    assert!(db.get_meeting("nope").await.unwrap().is_none());

    let (stored, count) = db
        .get_meetings(MeetingTypeQuery::Planned, None, false, None)
        .await
        .unwrap();
    assert_eq!(count, 1);
    assert_eq!(stored[0]._id.len(), 5);
    assert_eq!(stored[0].title, "Neu");
    let changed = stored[0].changed.as_ref().unwrap();
    assert_eq!(changed.len(), 1);
    assert_eq!(changed[0].by, "editor");
    backend.drop().await;
}

#[tokio::test]
async fn saving_an_old_meeting_starts_its_history() {
    let Some(backend) = Backend::new().await else {
        return;
    };
    let db = &backend.db;
    backend
        .insert_meeting(stored_meeting("old01", "Active", Some(7)))
        .await;
    let mut sent = db.get_meeting("old01").await.unwrap().unwrap();
    assert_eq!(sent.changed, None);
    sent.title = "Umbenannt".to_string();
    db.update_meeting(&mut sent, &auth(Some("editor")))
        .await
        .unwrap();
    let changed = sent.changed.clone().unwrap();
    assert_eq!(changed.len(), 1);
    assert_eq!(changed[0].by, "editor");
    assert_eq!(db.get_meeting("old01").await.unwrap().unwrap(), sent);
    backend.drop().await;
}

#[tokio::test]
async fn reading_a_meeting_works_for_deleted_ones_and_old_shapes() {
    let Some(backend) = Backend::new().await else {
        return;
    };
    let db = &backend.db;
    backend
        .insert_meeting(stored_meeting("old01", "Active", None))
        .await;
    let mut deleted = stored_meeting("gone1", "Active", Some(5));
    deleted["deleted_at"] = json!(9);
    deleted["changed"] = changes(&[9]);
    backend.insert_meeting(deleted).await;

    let old = db.get_meeting("old01").await.unwrap().unwrap();
    assert_eq!(old.time, None);
    assert_eq!(old.location, None);
    assert_eq!(old.place_id, None);
    assert_eq!(old.online, None);
    assert!(!old.place_to_be_announced);
    assert_eq!(old.changed, None);
    assert_eq!(old.cancelled, None);
    assert_eq!(old.deleted_at, None);
    assert_eq!(old.title, "Treffen old01");

    let gone = db.get_meeting("gone1").await.unwrap().unwrap();
    assert_eq!(gone.deleted_at, Some(9));
    assert_eq!(gone.changed.unwrap().len(), 1);
    assert!(db.get_meeting("nope").await.unwrap().is_none());
    backend.drop().await;
}

#[tokio::test]
async fn a_batch_of_meetings_gets_distinct_fresh_ids_in_request_order() {
    let Some(backend) = Backend::new().await else {
        return;
    };
    let db = &backend.db;
    let meetings = (0..50).map(|n| meeting(&format!("Treffen {n}"))).collect();
    let before = now_ms();
    let created = db.create_meetings(meetings, "user").await.unwrap();
    assert_eq!(created.len(), 50);
    let unique: HashSet<&str> = created.iter().map(|meeting| meeting._id.as_str()).collect();
    assert_eq!(unique.len(), 50);
    for (n, meeting) in created.iter().enumerate() {
        assert_eq!(meeting._id.len(), 5);
        assert_eq!(meeting.title, format!("Treffen {n}"));
        assert_eq!(meeting.status, MeetingStatus::Planned);
        let changed = meeting.changed.as_ref().unwrap();
        assert_eq!(changed.len(), 1);
        assert_eq!(changed[0].by, "user");
        assert!((before..=now_ms()).contains(&changed[0].at));
        assert_eq!(changed[0].at, created[0].changed.as_ref().unwrap()[0].at);
    }
    let (stored, count) = db
        .get_meetings(MeetingTypeQuery::Planned, None, false, None)
        .await
        .unwrap();
    assert_eq!(count, 50);
    let stored: HashSet<&str> = stored.iter().map(|meeting| meeting._id.as_str()).collect();
    assert_eq!(stored, unique);
    assert_eq!(
        db.get_meeting(&created[7]._id).await.unwrap().unwrap(),
        created[7]
    );
    backend.drop().await;
}

#[tokio::test]
async fn a_batch_that_fails_halfway_leaves_nothing_behind() {
    let Some(backend) = Backend::new().await else {
        return;
    };
    let db = &backend.db;
    backend.refuse_meeting_title("kaputt").await;

    let batch = vec![meeting("gut"), meeting("kaputt"), meeting("auch gut")];
    let error = db.create_meetings(batch, "user").await.unwrap_err();
    assert!(
        matches!(error, CreateMeetingsError::RolledBack(_)),
        "{error}"
    );
    assert_eq!(backend.meeting_count().await, 0);
    backend.drop().await;
}

// --- users and members --------------------------------------------------------------------

#[tokio::test]
async fn creating_a_user_is_idempotent_and_starts_without_capabilities() {
    let Some(backend) = Backend::new().await else {
        return;
    };
    let db = &backend.db;
    db.create_user("u1").await.unwrap();
    db.create_user("u1").await.unwrap();
    let user = db.get_user("u1").await.unwrap().unwrap();
    assert_eq!(user.id, "u1");
    assert_eq!(user.member, None);
    assert_eq!(user.capabilities, Some(vec![]));
    assert!(db.get_user("nope").await.unwrap().is_none());
    let (users, count) = db.get_users(None, 0, None, None, None).await.unwrap();
    assert!(users.is_empty() && count == 0, "no member, not listed");
    backend.drop().await;
}

#[tokio::test]
async fn users_stored_in_old_shapes_still_read() {
    let Some(backend) = Backend::new().await else {
        return;
    };
    let db = &backend.db;
    backend
        .insert_user(json!({ "_id": "nocap", "member": null, "capabilities": null }))
        .await;
    backend
        .insert_user(json!({
            "_id": "paper", "member": member("p@example.invalid", None),
            "capabilities": ["UpdateMeetings", "UpdateDocuments"],
            "admin": true, "imported_from": "papier",
        }))
        .await;

    let nocap = db.get_user("nocap").await.unwrap().unwrap();
    assert_eq!(nocap.member, None);
    // The one backend-specific expectation (research-postgres §3.6 item 1).
    match KIND {
        Kind::Mongo => assert_eq!(nocap.capabilities, None),
        Kind::Postgres => assert_eq!(nocap.capabilities, Some(vec![])),
    }
    assert!(!nocap.has_capability(&UserCapabilities::GetUsers));

    let paper = db.get_user("paper").await.unwrap().unwrap();
    let member = paper.member.unwrap();
    assert_eq!(member.status, None);
    assert_eq!(member.email, "p@example.invalid");
    assert_eq!(
        paper.capabilities,
        Some(vec![
            UserCapabilities::UpdateMeetings,
            UserCapabilities::UpdateDocuments
        ])
    );
    let (users, count) = db.get_users(None, 0, None, None, None).await.unwrap();
    assert_eq!(count, 1);
    assert_eq!(users[0].id, "paper");
    backend.drop().await;
}

#[tokio::test]
async fn the_first_submission_archives_the_user_and_later_ones_keep_the_board_fields() {
    let Some(backend) = Backend::new().await else {
        return;
    };
    let db = &backend.db;
    db.create_user("u1").await.unwrap();

    let before = now_ms();
    assert!(db
        .update_member_data("u1", submitted("a@example.invalid"))
        .await
        .unwrap());
    let user = db.get_user("u1").await.unwrap().unwrap();
    let snapshots = backend.original_user_snapshots("u1").await;
    assert_eq!(snapshots.len(), 1);
    assert_eq!(
        snapshots[0],
        serde_json::to_value(&user).unwrap(),
        "the archive is the user with the first submission as stored"
    );

    let first = user.member.unwrap();
    assert_eq!(first.status, Some(MembershipStatus::Pending));
    assert_eq!(first.email, "a@example.invalid");
    assert_eq!(first.name.as_ref().unwrap().first_name, "Anna");
    assert_eq!(first.pronouns.as_deref(), Some("sie"));
    assert_eq!(first.user_notes.as_deref(), Some("Hallo"));
    assert_eq!(first.reference.as_deref(), Some("Flyer"));
    assert_eq!(first.admin_notes, None);
    assert_eq!(first.end_time_ms, None);
    assert!(!first.honorary);
    // Whole seconds: the start is taken from a second clock, times 1000.
    assert!((before - 1_000..=now_ms()).contains(&first.start_time_ms));
    assert_eq!(first.start_time_ms % 1_000, 0);

    db.update_member_status("u1", &MembershipStatus::Approved)
        .await
        .unwrap();
    assert!(!db
        .update_member_data("u1", submitted("b@example.invalid"))
        .await
        .unwrap());
    let again = db.get_user("u1").await.unwrap().unwrap().member.unwrap();
    assert_eq!(again.email, "b@example.invalid");
    assert_eq!(again.status, Some(MembershipStatus::Approved));
    assert_eq!(again.start_time_ms, first.start_time_ms);
    assert_eq!(backend.original_user_snapshots("u1").await.len(), 1);

    // Fields only the board sets survive a submission.
    let mut board = member("c@example.invalid", Some("Left"));
    board["admin_notes"] = json!("notiert");
    board["honorary"] = json!(true);
    board["end_time_ms"] = json!(5);
    board["start_time_ms"] = json!(3);
    backend
        .insert_user(json!({ "_id": "u2", "member": board, "capabilities": [] }))
        .await;
    assert!(!db
        .update_member_data("u2", submitted("d@example.invalid"))
        .await
        .unwrap());
    let kept = db.get_user("u2").await.unwrap().unwrap().member.unwrap();
    assert_eq!(kept.admin_notes.as_deref(), Some("notiert"));
    assert!(kept.honorary);
    assert_eq!(kept.end_time_ms, Some(5));
    assert_eq!(kept.start_time_ms, 3);
    assert_eq!(kept.status, Some(MembershipStatus::Left));
    assert_eq!(kept.email, "d@example.invalid");
    assert_eq!(kept._type, MemberType::Supporting);
    assert!(backend.original_user_snapshots("u2").await.is_empty());

    assert!(db
        .update_member_data("nope", submitted("e@example.invalid"))
        .await
        .is_err());
    backend.drop().await;
}

/// Users `m1`..`m4` with members starting at 1..4 ms, created in the order m3, m1, m4, m2,
/// then `nomember` and `nullmember`. Every field the web sorts by orders them differently,
/// so a sort on the wrong column cannot pass, and no search term below matches through more
/// than one field.
async fn seed_members(backend: &Backend) {
    // (id, start, email, first name, last name, institution, status, end)
    let people = [
        (
            "m3",
            3,
            "w@example.invalid",
            "Kim",
            "Müller",
            None,
            None,
            Some(30),
        ),
        (
            "m1",
            1,
            "e@example.invalid",
            "Cem",
            "Yilmaz",
            None,
            Some("Pending"),
            Some(40),
        ),
        (
            "m4",
            4,
            "r@example.invalid",
            "Ali",
            "Schmidt",
            Some("Jugendzentrum"),
            Some("Approved"),
            None,
        ),
        (
            "m2",
            2,
            "q@example.invalid",
            "Dora",
            "Adler",
            Some("Verein Regenbogen"),
            Some("Rejected"),
            None,
        ),
    ];
    for (id, start, email, first, last, institution, status, end) in people {
        let mut member = member(email, status);
        member["name"] = json!({ "passport": format!("{first} {last}"), "first_name": first,
                                 "last_name": last });
        member["institution"] = json!(institution);
        member["start_time_ms"] = json!(start as i64);
        member["end_time_ms"] = json!(end);
        backend
            .insert_user(json!({ "_id": id, "member": member, "capabilities": [] }))
            .await;
    }
    backend
        .insert_user(json!({ "_id": "nomember", "capabilities": [] }))
        .await;
    backend
        .insert_user(json!({ "_id": "nullmember", "member": null, "capabilities": [] }))
        .await;
}

fn user_ids(users: &[User]) -> Vec<&str> {
    users.iter().map(|user| user.id.as_str()).collect()
}

#[tokio::test]
async fn member_lists_hold_only_users_with_member_data_newest_first_and_page() {
    let Some(backend) = Backend::new().await else {
        return;
    };
    let db = &backend.db;
    seed_members(&backend).await;

    let (users, count) = db.get_users(None, 0, None, None, None).await.unwrap();
    assert_eq!(user_ids(&users), ["m4", "m3", "m2", "m1"]);
    assert_eq!(count, 4);
    assert_eq!(users[0].member.as_ref().unwrap().email, "r@example.invalid");

    let (users, count) = db.get_users(Some(2), 1, None, None, None).await.unwrap();
    assert_eq!(user_ids(&users), ["m3", "m2"]);
    assert_eq!(count, 4, "the count is of the whole selection");

    let (users, _) = db.get_users(Some(0), 0, None, None, None).await.unwrap();
    assert_eq!(users.len(), 4, "a limit of 0 is no limit");
    let (users, _) = db.get_users(Some(-2), 0, None, None, None).await.unwrap();
    assert_eq!(user_ids(&users), ["m4", "m3"], "a negative limit counts");
    let (users, _) = db.get_users(None, 10, None, None, None).await.unwrap();
    assert!(users.is_empty());

    let (users, _) = db
        .get_users(None, 0, None, None, Some("asc".to_string()))
        .await
        .unwrap();
    assert_eq!(user_ids(&users), ["m1", "m2", "m3", "m4"]);
    let (users, _) = db
        .get_users(None, 0, None, None, Some("anything".to_string()))
        .await
        .unwrap();
    assert_eq!(
        user_ids(&users),
        ["m4", "m3", "m2", "m1"],
        "not asc means desc"
    );
    backend.drop().await;
}

#[tokio::test]
async fn member_search_is_a_case_insensitive_substring_over_name_email_and_institution() {
    let Some(backend) = Backend::new().await else {
        return;
    };
    let db = &backend.db;
    seed_members(&backend).await;
    let search = |term: &str| {
        let term = term.to_string();
        async move {
            let (users, count) = db.get_users(None, 0, Some(term), None, None).await.unwrap();
            let ids: Vec<String> = user_ids(&users).into_iter().map(str::to_string).collect();
            (ids, count)
        }
    };

    // Each of the four fields alone, in the list and in its count.
    assert_eq!(
        search("kim").await,
        (vec!["m3".to_string()], 1),
        "first name"
    );
    assert_eq!(
        search("YILMAZ").await,
        (vec!["m1".to_string()], 1),
        "last name"
    );
    assert_eq!(search("r@exam").await, (vec!["m4".to_string()], 1), "email");
    assert_eq!(
        search("regenbogen").await,
        (vec!["m2".to_string()], 1),
        "institution"
    );
    assert_eq!(search("@example").await.1, 4);
    assert_eq!(search("üll").await, (vec!["m3".to_string()], 1));
    // Case folding beyond ASCII: Mongo's case-insensitive regex, Postgres ILIKE under the
    // builtin C.UTF-8 locale of the deployment.
    assert_eq!(search("ÜLL").await, (vec!["m3".to_string()], 1));
    assert_eq!(search("example.invalid").await.0, ["m4", "m3", "m2", "m1"]);
    assert_eq!(search("niemand").await, (vec![], 0));
    assert_eq!(search("   ").await.1, 4, "blank searches select everything");
    let (users, count) = db
        .get_users(Some(1), 0, Some("a".to_string()), None, None)
        .await
        .unwrap();
    assert_eq!(user_ids(&users), ["m4"]);
    assert_eq!(count, 4, "the count is of the matches, not the page");
    backend.drop().await;
}

#[tokio::test]
async fn member_lists_sort_by_the_requested_member_field() {
    let Some(backend) = Backend::new().await else {
        return;
    };
    let db = &backend.db;
    seed_members(&backend).await;
    let sorted = |field: &str, order: &str| {
        let (field, order) = (field.to_string(), order.to_string());
        async move {
            let (users, _) = db
                .get_users(None, 0, None, Some(field), Some(order))
                .await
                .unwrap();
            user_ids(&users)
                .into_iter()
                .map(str::to_string)
                .collect::<Vec<_>>()
        }
    };

    // Every field in both directions; no two give the same order. Missing values come first
    // ascending and last descending, ties (the missing ones here) in the order the users
    // were created (m3, m1, m4, m2) in both directions.
    let expected = [
        (
            "start_time_ms",
            ["m1", "m2", "m3", "m4"],
            ["m4", "m3", "m2", "m1"],
        ),
        ("email", ["m1", "m2", "m4", "m3"], ["m3", "m4", "m2", "m1"]),
        (
            "name.first_name",
            ["m4", "m1", "m2", "m3"],
            ["m3", "m2", "m1", "m4"],
        ),
        (
            "name.last_name",
            ["m2", "m3", "m4", "m1"],
            ["m1", "m4", "m3", "m2"],
        ),
        // Statuses sort as their names.
        ("status", ["m3", "m4", "m1", "m2"], ["m2", "m1", "m4", "m3"]),
        (
            "end_time_ms",
            ["m4", "m2", "m3", "m1"],
            ["m1", "m3", "m4", "m2"],
        ),
        (
            "institution",
            ["m3", "m1", "m4", "m2"],
            ["m2", "m4", "m3", "m1"],
        ),
    ];
    for (field, ascending, descending) in expected {
        assert_eq!(sorted(field, "asc").await, ascending, "{field} asc");
        assert_eq!(sorted(field, "desc").await, descending, "{field} desc");
    }

    // Research-postgres §3.6 item 3: Mongo sorts by any name (here: no order at all),
    // Postgres only by the known fields.
    let unknown = db
        .get_users(None, 0, None, Some("nonsense".to_string()), None)
        .await;
    match KIND {
        Kind::Mongo => assert_eq!(unknown.unwrap().1, 4),
        Kind::Postgres => assert!(unknown.is_err()),
    }
    backend.drop().await;
}

#[tokio::test]
async fn membership_status_changes_need_a_member() {
    let Some(backend) = Backend::new().await else {
        return;
    };
    let db = &backend.db;
    backend
        .insert_user(
            json!({ "_id": "m", "member": member("m@example.invalid", None),
                             "capabilities": [] }),
        )
        .await;
    backend
        .insert_user(json!({ "_id": "n", "member": null, "capabilities": [] }))
        .await;
    for status in [
        MembershipStatus::Approved,
        MembershipStatus::Rejected,
        MembershipStatus::Pending,
        MembershipStatus::Left,
        MembershipStatus::Expelled,
    ] {
        db.update_member_status("m", &status).await.unwrap();
        let member = db.get_user("m").await.unwrap().unwrap().member.unwrap();
        assert_eq!(member.status, Some(status));
        assert_eq!(member.email, "m@example.invalid", "the rest stays");
    }
    assert!(db
        .update_member_status("n", &MembershipStatus::Approved)
        .await
        .is_err());
    assert!(db
        .update_member_status("nope", &MembershipStatus::Approved)
        .await
        .is_err());
    backend.drop().await;
}

#[tokio::test]
async fn mass_emails_reach_approved_members_only() {
    let Some(backend) = Backend::new().await else {
        return;
    };
    let db = &backend.db;
    for (id, member) in [
        ("f", Some(member("f@example.invalid", Some("Left")))),
        ("d", Some(member("d@example.invalid", Some("Approved")))),
        ("e", Some(member("e@example.invalid", None))),
        ("c", None),
        ("a", Some(member("a@example.invalid", Some("Approved")))),
        ("b", Some(member("b@example.invalid", Some("Pending")))),
    ] {
        backend
            .insert_user(json!({ "_id": id, "member": member, "capabilities": [] }))
            .await;
    }
    assert_eq!(db.count_approved_members().await.unwrap(), 2);
    // Status changes rewrite the row (Postgres) but leave the document where it was.
    db.update_member_status("d", &MembershipStatus::Pending)
        .await
        .unwrap();
    db.update_member_status("d", &MembershipStatus::Approved)
        .await
        .unwrap();
    // Now every order but the creation order has a before d: the ids, the members as stored
    // (d's row was rewritten) and the users as stored.
    backend.rewrite_user("d").await;
    backend.analyze().await;
    // In the order the users were created: the mail goes out in it, `failed_emails` too.
    assert_eq!(
        db.get_approved_member_emails().await.unwrap(),
        ["d@example.invalid", "a@example.invalid"]
    );
    backend.drop().await;
}

// --- email --------------------------------------------------------------------------------

#[tokio::test]
async fn an_email_draft_round_trips_and_can_be_claimed_only_once() {
    let Some(backend) = Backend::new().await else {
        return;
    };
    let db = &backend.db;
    let draft = draft("d1");
    db.insert_email_draft(&draft).await.unwrap();
    let read = db.get_email_draft("d1").await.unwrap().unwrap();
    assert_eq!(
        serde_json::to_value(&read).unwrap(),
        serde_json::to_value(&draft).unwrap()
    );
    assert!(db.get_email_draft("nope").await.unwrap().is_none());

    let claimed = db.claim_email_draft("d1").await.unwrap().unwrap();
    assert_eq!(claimed.status, DraftStatus::Processing);
    assert_eq!(claimed.attachments.len(), 2);
    assert_eq!(claimed.recipient_count, 7);
    assert!(db.claim_email_draft("d1").await.unwrap().is_none());
    assert!(db.claim_email_draft("nope").await.unwrap().is_none());
    let read = db.get_email_draft("d1").await.unwrap().unwrap();
    assert_eq!(read.status, DraftStatus::Processing);

    db.delete_email_draft("d1").await.unwrap();
    assert!(db.get_email_draft("d1").await.unwrap().is_none());
    db.delete_email_draft("d1").await.unwrap();
    backend.drop().await;
}

#[tokio::test]
async fn a_sent_email_log_keeps_every_field() {
    let Some(backend) = Backend::new().await else {
        return;
    };
    let db = &backend.db;
    let log = SentEmailLog {
        _id: "l1".to_string(),
        sender_id: "sender".to_string(),
        sender_email: "sender@example.invalid".to_string(),
        subject: "Betreff".to_string(),
        body: "Text".to_string(),
        attachment_names: vec!["a.txt".to_string(), "b.pdf".to_string()],
        sent_at: 1_793_124_000_000,
        successful_count: 2,
        failed_count: 1,
        failed_emails: vec!["x@example.invalid".to_string()],
        reply_to: None,
    };
    db.insert_sent_email_log(&log).await.unwrap();
    let stored = backend.sent_email_log("l1").await.unwrap();
    assert_eq!(stored, serde_json::to_value(&log).unwrap());
    assert!(backend.sent_email_log("nope").await.is_none());
    backend.drop().await;
}

// --- places -------------------------------------------------------------------------------

#[tokio::test]
async fn places_with_the_same_name_race_to_one_place() {
    let Some(backend) = Backend::new().await else {
        return;
    };
    let db = &backend.db;
    let (first, second) = tokio::join!(
        db.create_place("Café Neruda".to_string(), 48.0, 10.0, "a"),
        db.create_place("café  neruda".to_string(), 48.0, 10.0, "b"),
    );
    let (first, first_created) = first.unwrap();
    let (second, second_created) = second.unwrap();
    assert_eq!(first._id, second._id);
    assert!(first_created != second_created);
    assert_eq!(db.get_places().await.unwrap().len(), 1);
    backend.drop().await;
}

#[tokio::test]
async fn places_are_listed_by_their_normalized_name_and_read_by_id() {
    let Some(backend) = Backend::new().await else {
        return;
    };
    let db = &backend.db;
    // Migrated places have no `created`.
    backend
        .insert_place(
            json!({ "_id": "pl001", "name": "Zeughaus", "name_key": "zeughaus",
                              "lat": 48.368, "lon": 10.897 }),
        )
        .await;
    backend
        .insert_place(
            json!({ "_id": "pl002", "name": "Ärztehaus", "name_key": "ärztehaus",
                              "lat": 48.1, "lon": 10.1, "created": null }),
        )
        .await;
    backend
        .insert_place(
            json!({ "_id": "pl003", "name": "café Viktoria", "name_key": "café viktoria",
                              "lat": 48.3, "lon": 10.3 }),
        )
        .await;
    // As migrated places can be stored: their keys have the straight apostrophe and one space.
    backend
        .insert_place(
            json!({ "_id": "pl004", "name": "Henrys Bar", "name_key": "henrys bar",
                              "lat": 48.4, "lon": 10.4 }),
        )
        .await;
    backend
        .insert_place(
            json!({ "_id": "pl005", "name": "Henry\u{2018}s  Coffee", "name_key": "henry's coffee",
                              "lat": 48.5, "lon": 10.5 }),
        )
        .await;
    let (bar, created) = db
        .create_place("Bar Neruda".to_string(), 48.2, 10.2, "u")
        .await
        .unwrap();
    assert!(created);
    assert_eq!(bar._id.len(), 5);
    assert_eq!(bar.name, "Bar Neruda");

    // By key, bytewise. By name "Zeughaus" would come before "café Viktoria" (Z < c), by the
    // lower-case name "henrys bar" before "henry\u{2018}s  coffee" (s < U+2018), by id pl001
    // before pl003, and backwards "Ärztehaus" first.
    let places = db.get_places().await.unwrap();
    let names: Vec<&str> = places.iter().map(|place| place.name.as_str()).collect();
    assert_eq!(
        names,
        [
            "Bar Neruda",
            "café Viktoria",
            "Henry\u{2018}s  Coffee",
            "Henrys Bar",
            "Zeughaus",
            "Ärztehaus"
        ],
        "by key, bytewise"
    );

    assert_eq!(
        db.get_place("pl001").await.unwrap().unwrap().name,
        "Zeughaus"
    );
    assert_eq!(db.get_place(&bar._id).await.unwrap().unwrap(), bar);
    assert!(db.get_place("nope").await.unwrap().is_none());

    // The same name again, spelled differently, returns the stored place as it is.
    let (existing, created) = db
        .create_place("BAR   NERUDA".to_string(), 1.0, 2.0, "v")
        .await
        .unwrap();
    assert!(!created);
    assert_eq!(existing, bar);
    assert_eq!(db.get_places().await.unwrap().len(), 6);
    backend.drop().await;
}

// --- documents ----------------------------------------------------------------------------

#[tokio::test]
async fn a_new_document_stores_its_text_as_state_and_keeps_it_out_of_reads() {
    let Some(backend) = Backend::new().await else {
        return;
    };
    let db = &backend.db;
    let text = "# Größe\n\nÄnderung 🏳️‍🌈";
    let created = db.create_document(text, vec![], "user").await.unwrap();
    assert_eq!(created.title, "Größe");
    assert_eq!(created._id.len(), 10);
    assert_eq!(created.content, text);
    assert!(!created.editing);

    let read = db.get_document(&created._id).await.unwrap().unwrap();
    assert_eq!(read, created);
    assert!(db.get_document("nope").await.unwrap().is_none());

    let state = backend.document_state(&created._id).await.unwrap();
    assert_eq!(text_of_state(&state).unwrap(), text);
    backend.drop().await;
}

#[tokio::test]
async fn deleted_documents_disappear_from_lists_reads_and_search() {
    let Some(backend) = Backend::new().await else {
        return;
    };
    let db = &backend.db;
    let document = db.create_document("# Weg", vec![], "user").await.unwrap();
    assert!(db.delete_document(&document._id, "user").await.unwrap());
    assert!(!db.delete_document(&document._id, "user").await.unwrap());
    assert!(!db.delete_document("nope", "user").await.unwrap());

    assert!(listed(db).await.documents.is_empty());
    assert!(db.get_document(&document._id).await.unwrap().is_none());
    assert!(backend.search_all().await.is_empty());
    assert!(!db.set_document_groups(&document._id, &[]).await.unwrap());
    // The state stays, like a deleted meeting.
    assert!(backend.document_state(&document._id).await.is_some());
    backend.drop().await;
}

#[tokio::test]
async fn the_search_reads_every_live_document_with_its_title_and_text() {
    let Some(backend) = Backend::new().await else {
        return;
    };
    let db = &backend.db;
    let first = db
        .create_document("# Satzung\n\nText eins", vec![], "u")
        .await
        .unwrap();
    let second = db
        .create_document("Ohne Überschrift", vec![], "u")
        .await
        .unwrap();
    let gone = db.create_document("# Weg", vec![], "u").await.unwrap();
    db.delete_document(&gone._id, "u").await.unwrap();

    let mut found: Vec<(String, String, String)> = backend
        .search_all()
        .await
        .into_iter()
        .map(|document| (document._id, document.title, document.content))
        .collect();
    found.sort();
    let mut expected = vec![
        (
            first._id,
            "Satzung".to_string(),
            "# Satzung\n\nText eins".to_string(),
        ),
        (second._id, second.title, "Ohne Überschrift".to_string()),
    ];
    expected.sort();
    assert_eq!(found, expected);
    backend.drop().await;
}

#[tokio::test]
async fn group_names_are_unique_ignoring_case_and_accents() {
    let Some(backend) = Backend::new().await else {
        return;
    };
    let db = &backend.db;
    db.create_document_group("Vorstand").await.unwrap();
    let error = db.create_document_group("vorständ").await.unwrap_err();
    assert!(matches!(error, GroupNameError::Taken));

    db.create_document_group("Orga").await.unwrap();
    let groups = listed(db).await.groups;
    assert_eq!(groups.len(), 2);
    assert_eq!(groups[0].name, "Orga");
    assert_eq!(groups[0]._id.len(), 10);
    let orga = groups[0]._id.clone();
    let error = db
        .rename_document_group(&orga, "VORSTAND")
        .await
        .unwrap_err();
    assert!(matches!(error, GroupNameError::Taken));
    assert!(db.rename_document_group(&orga, "Team").await.unwrap());
    assert!(db.rename_document_group(&orga, "Team").await.unwrap());
    assert!(!db.rename_document_group("nope", "Egal").await.unwrap());
    assert_eq!(listed(db).await.groups[0].name, "Team");
    backend.drop().await;
}

#[tokio::test]
async fn orders_survive_and_a_deleted_group_leaves_its_documents() {
    let Some(backend) = Backend::new().await else {
        return;
    };
    let db = &backend.db;
    db.create_document_group("Alpha").await.unwrap();
    db.create_document_group("Beta").await.unwrap();
    let groups = listed(db).await.groups;
    let (alpha, beta) = (groups[0]._id.clone(), groups[1]._id.clone());

    let first = db
        .create_document("# A", vec![alpha.clone()], "u")
        .await
        .unwrap();
    let second = db
        .create_document("# B", vec![alpha.clone(), beta.clone()], "u")
        .await
        .unwrap();
    assert_eq!(second.group_ids, vec![alpha.clone(), beta.clone()]);
    assert_eq!(
        db.get_document(&second._id)
            .await
            .unwrap()
            .unwrap()
            .group_ids,
        vec![alpha.clone(), beta.clone()]
    );

    db.set_document_group_order(&[beta.clone(), alpha.clone()])
        .await
        .unwrap();
    assert!(db
        .set_group_document_order(&alpha, &[second._id.clone(), first._id.clone()])
        .await
        .unwrap());
    assert!(!db
        .set_group_document_order("nope", std::slice::from_ref(&first._id))
        .await
        .unwrap());

    let body = listed(db).await;
    assert_eq!(body.groups[0]._id, beta);
    assert_eq!(
        body.groups[1].document_ids,
        vec![second._id.clone(), first._id.clone()]
    );

    // The order is one record, set again and again.
    db.set_document_group_order(std::slice::from_ref(&alpha))
        .await
        .unwrap();
    let body = listed(db).await;
    assert_eq!(body.groups[0]._id, alpha);

    assert!(db.delete_document_group(&alpha).await.unwrap());
    let body = listed(db).await;
    assert_eq!(body.groups.len(), 1);
    assert_eq!(body.groups[0].document_ids, vec![second._id.clone()]);
    assert_eq!(body.ungrouped_ids, vec![first._id.clone()]);
    assert!(!db.delete_document_group(&alpha).await.unwrap());
    assert_eq!(
        db.get_document(&second._id)
            .await
            .unwrap()
            .unwrap()
            .group_ids,
        vec![beta.clone()]
    );
    backend.drop().await;
}

#[tokio::test]
async fn documents_can_change_their_groups() {
    let Some(backend) = Backend::new().await else {
        return;
    };
    let db = &backend.db;
    db.create_document_group("Alpha").await.unwrap();
    db.create_document_group("Beta").await.unwrap();
    let groups = listed(db).await.groups;
    let (alpha, beta) = (groups[0]._id.clone(), groups[1]._id.clone());
    let document = db.create_document("# A", vec![], "u").await.unwrap();
    assert_eq!(listed(db).await.ungrouped_ids, vec![document._id.clone()]);

    assert!(db
        .set_document_groups(&document._id, &[beta.clone(), alpha.clone()])
        .await
        .unwrap());
    let read = db.get_document(&document._id).await.unwrap().unwrap();
    assert_eq!(read.group_ids, vec![beta.clone(), alpha.clone()], "as sent");
    let body = listed(db).await;
    assert_eq!(body.groups[0].document_ids, vec![document._id.clone()]);
    assert_eq!(body.groups[1].document_ids, vec![document._id.clone()]);
    assert!(body.ungrouped_ids.is_empty());

    assert!(db
        .set_document_groups(&document._id, std::slice::from_ref(&beta))
        .await
        .unwrap());
    let body = listed(db).await;
    assert!(body.groups[0].document_ids.is_empty());
    assert_eq!(body.groups[1].document_ids, vec![document._id.clone()]);

    // A group that vanished between the handler's check and the write is simply not shown.
    // MongoDB stored the dead id and served it in `group_ids`; Postgres leaves it out (the
    // foreign key), so the document reads as ungrouped there too (issue.md decision 5).
    assert!(db
        .set_document_groups(&document._id, &["weg".to_string()])
        .await
        .unwrap());
    let body = listed(db).await;
    assert!(body
        .groups
        .iter()
        .all(|group| group.document_ids.is_empty()));
    assert_eq!(body.ungrouped_ids, vec![document._id.clone()]);
    let read = db.get_document(&document._id).await.unwrap().unwrap();
    match KIND {
        Kind::Mongo => assert_eq!(read.group_ids, ["weg"]),
        Kind::Postgres => assert!(read.group_ids.is_empty()),
    }
    let dangling = db
        .create_document("# B", vec!["weg".to_string(), alpha.clone()], "u")
        .await
        .unwrap();
    let body = listed(db).await;
    assert_eq!(body.groups[0].document_ids, vec![dangling._id.clone()]);
    assert_eq!(body.ungrouped_ids, vec![document._id.clone()]);
    // The answer of the create is what a read returns.
    let read = db.get_document(&dangling._id).await.unwrap().unwrap();
    assert_eq!(dangling.group_ids, read.group_ids);
    match KIND {
        Kind::Mongo => assert_eq!(read.group_ids, vec!["weg".to_string(), alpha.clone()]),
        Kind::Postgres => assert_eq!(read.group_ids, vec![alpha.clone()]),
    }

    assert!(!db.set_document_groups("nope", &[]).await.unwrap());
    backend.drop().await;
}

#[tokio::test]
async fn a_documents_groups_keep_their_order_in_every_read() {
    let Some(backend) = Backend::new().await else {
        return;
    };
    let db = &backend.db;
    for name in ["Alpha", "Beta", "Gamma"] {
        db.create_document_group(name).await.unwrap();
    }
    let mut ids: Vec<String> = listed(db)
        .await
        .groups
        .into_iter()
        .map(|group| group._id)
        .collect();
    ids.sort();
    // The ids are random: sent in neither their order nor its reverse, so that a read by id
    // cannot match by chance.
    let sent = [ids[1].clone(), ids[2].clone(), ids[0].clone()];
    let document = db.create_document("# A", vec![], "u").await.unwrap();
    assert!(db.set_document_groups(&document._id, &sent).await.unwrap());
    // As stored, the first group now comes last.
    backend.rewrite_group_membership(&document._id, 0).await;
    backend.analyze().await;

    let read = db.get_document(&document._id).await.unwrap().unwrap();
    assert_eq!(read.group_ids, sent, "one document");
    let (_, _, documents) = db.get_document_list().await.unwrap();
    assert_eq!(documents[0].group_ids, sent, "the document list");
    backend.drop().await;
}

#[tokio::test]
async fn only_existing_groups_count() {
    let Some(backend) = Backend::new().await else {
        return;
    };
    let db = &backend.db;
    db.create_document_group("Alpha").await.unwrap();
    let alpha = listed(db).await.groups.remove(0)._id;
    assert!(db
        .document_groups_exist(std::slice::from_ref(&alpha))
        .await
        .unwrap());
    assert!(db
        .document_groups_exist(&[alpha.clone(), alpha.clone()])
        .await
        .unwrap());
    assert!(db.document_groups_exist(&[]).await.unwrap());
    assert!(!db
        .document_groups_exist(&[alpha, "weg".to_string()])
        .await
        .unwrap());
    backend.drop().await;
}

#[tokio::test]
async fn versions_are_listed_newest_first_and_capped() {
    let Some(backend) = Backend::new().await else {
        return;
    };
    let db = &backend.db;
    let d = db.create_document("# D", vec![], "u").await.unwrap()._id;
    let e = db.create_document("# E", vec![], "u").await.unwrap()._id;
    let other = db.create_document("# O", vec![], "u").await.unwrap()._id;
    let version = |id: &str, document_id: &str, content: &str, saved_at: i64| {
        json!({ "_id": id, "document_id": document_id, "content": content,
                "editors": ["a", "b"], "saved_at": saved_at })
    };
    // The ties stored neither in the order of their ids nor in its reverse, and their texts in
    // yet another order.
    backend
        .insert_version(version("v1", &d, "Stand eins", 10))
        .await;
    backend
        .insert_version(version("v2", &d, "Stand zwei", 20))
        .await;
    backend
        .insert_version(version("v4", &d, "Stand vier", 20))
        .await;
    backend
        .insert_version(version("v3", &d, "Stand drei", 20))
        .await;
    backend
        .insert_version(version("v9", &other, "Stand neun", 99))
        .await;
    backend.analyze().await;

    let versions = db.get_document_versions(&d).await.unwrap();
    let ids: Vec<&str> = versions
        .iter()
        .map(|version| version._id.as_str())
        .collect();
    assert_eq!(ids, ["v4", "v3", "v2", "v1"], "ties by id, descending");
    assert_eq!(versions[0].content, "Stand vier");
    assert_eq!(versions[0].editors, vec!["a".to_string(), "b".to_string()]);
    assert_eq!(versions[0].saved_at, 20);
    assert!(db.get_document_versions("nope").await.unwrap().is_empty());

    for n in 0..55 {
        backend
            .insert_version(version(&format!("w{n:02}"), &e, "Stand", 1_000 + n))
            .await;
    }
    let versions = db.get_document_versions(&e).await.unwrap();
    assert_eq!(versions.len(), 50);
    assert_eq!(versions[0]._id, "w54");
    assert_eq!(versions[49]._id, "w05");
    backend.drop().await;
}

#[tokio::test]
async fn a_room_saves_into_the_database_with_its_derived_fields() {
    let Some(backend) = Backend::new().await else {
        return;
    };
    let db = &backend.db;
    let store = backend.store();
    let document = db.create_document("# Alt\n", vec![], "u").await.unwrap();

    let loaded = store
        .load_state(document._id.clone())
        .await
        .unwrap()
        .unwrap();
    assert_eq!(loaded.state_version, 1);
    assert_eq!(text_of_state(&loaded.state).unwrap(), "# Alt\n");
    assert!(store
        .load_state("nope".to_string())
        .await
        .unwrap()
        .is_none());

    let saved = SavedState {
        state: loaded.state.clone(),
        content: "# Neu\n".to_string(),
        title: "Neu".to_string(),
        state_version: 1,
    };
    let outcome = store
        .save_state(document._id.clone(), saved.clone())
        .await
        .unwrap();
    assert_eq!(outcome, SaveOutcome::Saved { state_version: 2 });
    let read = db.get_document(&document._id).await.unwrap().unwrap();
    assert_eq!(read.title, "Neu");
    assert_eq!(read.content, "# Neu\n");
    let loaded = store
        .load_state(document._id.clone())
        .await
        .unwrap()
        .unwrap();
    assert_eq!(loaded.state_version, 2);
    assert_eq!(loaded.state, saved.state);

    // The same version again means a second writer, a deleted document the end of the room.
    let outcome = store
        .save_state(document._id.clone(), saved.clone())
        .await
        .unwrap();
    assert_eq!(outcome, SaveOutcome::Gone);
    db.delete_document(&document._id, "u").await.unwrap();
    let late = SavedState {
        state_version: 2,
        ..saved
    };
    assert_eq!(
        store.save_state(document._id.clone(), late).await.unwrap(),
        SaveOutcome::Gone
    );
    assert!(store
        .load_state(document._id.clone())
        .await
        .unwrap()
        .is_none());
    backend.drop().await;
}

#[tokio::test]
async fn versions_skip_repeats_are_spaced_and_keep_the_newest() {
    let Some(backend) = Backend::new().await else {
        return;
    };
    let db = &backend.db;
    let store = backend.store();
    let d = db.create_document("# D", vec![], "u").await.unwrap()._id;
    let e = db.create_document("# E", vec![], "u").await.unwrap()._id;
    let add = |document_id: &str, content: &str| {
        store.add_version(
            document_id.to_string(),
            NewVersion {
                content: content.to_string(),
                editors: vec!["u".to_string()],
            },
        )
    };
    add(&d, "eins").await.unwrap();
    add(&d, "eins").await.unwrap();
    add(&d, "gleich danach").await.unwrap();
    let versions = db.get_document_versions(&d).await.unwrap();
    assert_eq!(versions.len(), 1);
    assert_eq!(versions[0].content, "eins");
    assert_eq!(versions[0].editors, vec!["u".to_string()]);
    assert_eq!(versions[0]._id.len(), 12);
    assert!(versions[0].saved_at <= now_ms());

    // Long after the newest version, the same text still adds none (a room adds the loaded
    // text when its first change comes in), another text does.
    let f = db.create_document("# F", vec![], "u").await.unwrap()._id;
    backend
        .insert_version(json!({
            "_id": "old", "document_id": &f, "content": "gleich", "editors": [],
            "saved_at": now_ms() - 10 * 60_000,
        }))
        .await;
    add(&f, "gleich").await.unwrap();
    assert_eq!(db.get_document_versions(&f).await.unwrap().len(), 1);
    add(&f, "anders").await.unwrap();
    let versions = db.get_document_versions(&f).await.unwrap();
    assert_eq!(versions.len(), 2);
    assert_eq!(versions[0].content, "anders");

    for n in 0..60 {
        backend
            .insert_version(json!({
                "_id": format!("v{n:02}"), "document_id": &e, "content": format!("Stand {n}"),
                "editors": [], "saved_at": 1_000 + n,
            }))
            .await;
    }
    add(&e, "neu").await.unwrap();
    let versions = db.get_document_versions(&e).await.unwrap();
    assert_eq!(versions.len(), 50);
    assert_eq!(versions[0].content, "neu");
    assert_eq!(versions[49]._id, "v11");
    assert_eq!(
        backend.version_count().await,
        53,
        "d keeps its one, f its two"
    );
    backend.drop().await;
}

/// The text of a new version is compared with the newest one: the latest `saved_at`, and of
/// two saved in the same millisecond the greater id, however the rows are stored. A new text
/// equal to the newest one is not stored; equal to an older one, it is.
#[tokio::test]
async fn a_new_version_is_compared_with_the_newest_one() {
    let Some(backend) = Backend::new().await else {
        return;
    };
    let db = &backend.db;
    let store = backend.store();
    let long_ago = now_ms() - 10 * 60_000;
    let g = db.create_document("# G", vec![], "u").await.unwrap()._id;
    let h = db.create_document("# H", vec![], "u").await.unwrap()._id;
    // Stored oldest first, as they were saved. g's older version has the greater id; of h's
    // two in one millisecond the newer (greater id) has the smaller text.
    for (id, document_id, content, saved_at) in [
        ("g9", &g, "eins", long_ago - 60_000),
        ("g2", &g, "zwei", long_ago),
        ("h1", &h, "zwei", long_ago),
        ("h2", &h, "eins", long_ago),
    ] {
        backend
            .insert_version(json!({
                "_id": id, "document_id": document_id, "content": content, "editors": [],
                "saved_at": saved_at,
            }))
            .await;
    }
    backend.analyze().await;
    for (document_id, stored, newest) in [(&g, 3, "eins"), (&h, 2, "h2")] {
        store
            .add_version(
                document_id.clone(),
                NewVersion {
                    content: "eins".to_string(),
                    editors: vec!["u".to_string()],
                },
            )
            .await
            .unwrap();
        let versions = db.get_document_versions(document_id).await.unwrap();
        assert_eq!(versions.len(), stored, "{document_id}");
        if stored == 3 {
            assert_eq!(versions[0].content, newest, "g: the newest says zwei");
        } else {
            assert_eq!(versions[0]._id, newest, "h: the newest says eins already");
        }
    }
    backend.drop().await;
}

#[tokio::test]
async fn two_people_sorting_at_once_lose_no_document() {
    let Some(backend) = Backend::new().await else {
        return;
    };
    let db = &backend.db;
    db.create_document_group("Alpha").await.unwrap();
    let alpha = listed(db).await.groups.remove(0)._id;
    let first = db
        .create_document("# A", vec![alpha.clone()], "u")
        .await
        .unwrap();
    let second = db
        .create_document("# B", vec![alpha.clone()], "u")
        .await
        .unwrap();

    let order = [second._id.clone()];
    let new_one = db.create_document("# C", vec![alpha.clone()], "u");
    let (reordered, added) = tokio::join!(db.set_group_document_order(&alpha, &order), new_one);
    assert!(reordered.unwrap());
    let added = added.unwrap();

    let body = listed(db).await;
    let ids = &body.groups[0].document_ids;
    assert_eq!(ids[0], second._id);
    assert!(ids.contains(&first._id) && ids.contains(&added._id));
    assert_eq!(ids.len(), 3);
    backend.drop().await;
}

// --- orders of equal sort keys (the order MongoDB kept its documents in) ------------------

#[tokio::test]
async fn meetings_at_the_same_time_come_newest_first_in_every_list() {
    let Some(backend) = Backend::new().await else {
        return;
    };
    let db = &backend.db;
    // Inserted in this order, which is not the id order. MongoDB scanned its `time` index
    // backwards: equal times newest first, the undated ones last, newest first too.
    let mut raws = Vec::new();
    for id in ["zz001", "AA002", "mm003", "bb004"] {
        let mut raw = stored_meeting(id, "Active", Some(500));
        raw["changed"] = changes(&[10]);
        raws.push(raw);
    }
    raws[2]["deleted_at"] = json!(600);
    raws.push(stored_meeting("x0005", "Active", Some(900)));
    raws.push(stored_meeting("n0006", "Active", None));
    raws.push(stored_meeting("a0007", "Active", None));
    raws.push(stored_meeting("p0008", "Planned", None));
    raws.push(stored_meeting("c0009", "Planned", None));
    for raw in raws {
        backend.insert_meeting(raw).await;
    }
    let list = |since: Option<i64>, include_deleted: bool, from: Option<i64>| async move {
        let (found, _) = db
            .get_meetings(MeetingTypeQuery::Active, since, include_deleted, from)
            .await
            .unwrap();
        found
            .into_iter()
            .map(|meeting| meeting._id)
            .collect::<Vec<_>>()
    };

    assert_eq!(
        list(None, false, None).await,
        ["x0005", "bb004", "AA002", "zz001", "a0007", "n0006"]
    );
    assert_eq!(
        list(None, true, None).await,
        ["x0005", "bb004", "mm003", "AA002", "zz001", "a0007", "n0006"]
    );
    assert_eq!(
        list(Some(1), true, None).await,
        ["bb004", "mm003", "AA002", "zz001"]
    );
    assert_eq!(
        list(None, false, Some(500)).await,
        ["x0005", "bb004", "AA002", "zz001"]
    );
    let (planned, _) = db
        .get_meetings(MeetingTypeQuery::Planned, None, false, None)
        .await
        .unwrap();
    assert_eq!(ids(&planned), ["c0009", "p0008"]);

    // Saving keeps a meeting's place: MongoDB replaced the document in place.
    let mut oldest = db.get_meeting("zz001").await.unwrap().unwrap();
    oldest.title = "Neu".to_string();
    db.update_meeting(&mut oldest, &auth(Some("editor")))
        .await
        .unwrap();
    assert_eq!(
        list(None, false, None).await,
        ["x0005", "bb004", "AA002", "zz001", "a0007", "n0006"]
    );

    // A batch gets its places in request order, after everything stored before.
    let created = db
        .create_meetings(vec![meeting("Erstes"), meeting("Zweites")], "u")
        .await
        .unwrap();
    let (planned, _) = db
        .get_meetings(MeetingTypeQuery::Planned, None, false, None)
        .await
        .unwrap();
    assert_eq!(
        ids(&planned),
        [
            created[1]._id.as_str(),
            created[0]._id.as_str(),
            "c0009",
            "p0008"
        ]
    );
    backend.drop().await;
}

#[tokio::test]
async fn members_with_equal_values_come_in_the_order_their_users_were_created() {
    let Some(backend) = Backend::new().await else {
        return;
    };
    let db = &backend.db;
    // MongoDB scanned the users in natural order and sorted stably, so ties keep the
    // creation order in both directions. All the same start, email and status.
    let created = ["u5", "u1", "u9", "u3"];
    for id in created {
        backend
            .insert_user(json!({ "_id": id, "member": member("x@example.invalid",
                                 Some("Approved")), "capabilities": [] }))
            .await;
    }
    // As stored, u5 now comes last in both tables, and the ids sort it third.
    backend.rewrite_user("u5").await;
    backend.rewrite_member("u5").await;
    backend.analyze().await;
    for field in [None, Some("email"), Some("status"), Some("institution")] {
        for order in ["asc", "desc"] {
            let (users, count) = db
                .get_users(
                    None,
                    0,
                    None,
                    field.map(str::to_string),
                    Some(order.to_string()),
                )
                .await
                .unwrap();
            assert_eq!(user_ids(&users), created, "{field:?} {order}");
            assert_eq!(count, 4);
        }
    }
    let (users, _) = db.get_users(None, 1, None, None, None).await.unwrap();
    assert_eq!(
        user_ids(&users),
        ["u1", "u9", "u3"],
        "an offset keeps the order"
    );
    let (users, _) = db
        .get_users(None, 0, Some("x@".to_string()), None, None)
        .await
        .unwrap();
    assert_eq!(user_ids(&users), created, "a search keeps the order");

    // A new submission keeps a member's place, and a new user comes last.
    db.update_member_data("u1", submitted("x@example.invalid"))
        .await
        .unwrap();
    db.update_member_status("u1", &MembershipStatus::Approved)
        .await
        .unwrap();
    db.create_user("u0").await.unwrap();
    db.update_member_data("u0", submitted("x@example.invalid"))
        .await
        .unwrap();
    db.update_member_status("u0", &MembershipStatus::Approved)
        .await
        .unwrap();
    let (users, _) = db
        .get_users(None, 0, None, Some("email".to_string()), None)
        .await
        .unwrap();
    assert_eq!(user_ids(&users), ["u5", "u1", "u9", "u3", "u0"]);
    assert_eq!(
        db.get_approved_member_emails().await.unwrap().len(),
        5,
        "u1 resubmitted and approved again"
    );
    backend.drop().await;
}

#[tokio::test]
async fn member_names_compare_bytewise_and_a_missing_name_sorts_first() {
    let Some(backend) = Backend::new().await else {
        return;
    };
    let db = &backend.db;
    // MongoDB compared strings bytewise (no collation); the deployment's Postgres runs the
    // builtin C.UTF-8 locale, which compares code points: the same order. Under ICU de-DE
    // or a libc locale "de Vries" and "Özdemir" would move.
    for (id, start, first, last) in [
        ("p1", 1, "Zoe", "Zeller"),
        ("p2", 2, "anton", "de Vries"),
        ("p3", 3, "Ömer", "Özdemir"),
    ] {
        let mut member = member(&format!("{id}@example.invalid"), Some("Approved"));
        member["name"] = json!({ "passport": format!("{first} {last}"), "first_name": first,
                                 "last_name": last });
        member["start_time_ms"] = json!(start);
        backend
            .insert_user(json!({ "_id": id, "member": member, "capabilities": [] }))
            .await;
    }
    // An institution: no name at all.
    let mut institution = member("verein@example.invalid", Some("Approved"));
    institution["natural_person"] = json!(false);
    institution["institution"] = json!("Verein");
    institution["start_time_ms"] = json!(4);
    backend
        .insert_user(json!({ "_id": "p4", "member": institution, "capabilities": [] }))
        .await;
    let sorted = |field: &str, order: &str| {
        let (field, order) = (field.to_string(), order.to_string());
        async move {
            let (users, _) = db
                .get_users(None, 0, None, Some(field), Some(order))
                .await
                .unwrap();
            user_ids(&users)
                .into_iter()
                .map(str::to_string)
                .collect::<Vec<_>>()
        }
    };
    assert_eq!(
        sorted("name.last_name", "asc").await,
        ["p4", "p1", "p2", "p3"]
    );
    assert_eq!(
        sorted("name.last_name", "desc").await,
        ["p3", "p2", "p1", "p4"]
    );
    assert_eq!(
        sorted("name.first_name", "asc").await,
        ["p4", "p1", "p2", "p3"]
    );
    let search = |term: &str| {
        let term = term.to_string();
        async move {
            let (users, count) = db.get_users(None, 0, Some(term), None, None).await.unwrap();
            let ids: Vec<String> = user_ids(&users).into_iter().map(str::to_string).collect();
            (ids, count)
        }
    };
    assert_eq!(search("özdemir").await, (vec!["p3".to_string()], 1));
    assert_eq!(search("ÖZDEMIR").await, (vec!["p3".to_string()], 1));
    assert_eq!(search("ÖMER").await, (vec!["p3".to_string()], 1));
    assert_eq!(search("DE VRIES").await, (vec!["p2".to_string()], 1));
    backend.drop().await;
}

#[tokio::test]
async fn the_search_reads_documents_in_creation_order_even_after_edits() {
    let Some(backend) = Backend::new().await else {
        return;
    };
    let db = &backend.db;
    let store = backend.store();
    // Eight, so that neither the order of the random ids nor the physical order of rows
    // after an edit can match the creation order by chance.
    let mut created = Vec::new();
    for n in 1..=8 {
        let document = db
            .create_document(&format!("# Protokoll\n\nVorstand {n}"), vec![], "u")
            .await
            .unwrap();
        created.push(document._id);
    }
    let order = || async {
        backend
            .search_all()
            .await
            .into_iter()
            .map(|document| document._id)
            .collect::<Vec<_>>()
    };
    assert_eq!(order().await, created);

    // An edit rewrites the row; the hits with equal titles must not swap.
    let loaded = store.load_state(created[0].clone()).await.unwrap().unwrap();
    let saved = SavedState {
        state: loaded.state,
        content: "# Protokoll\n\nVorstand eins, ergänzt".to_string(),
        title: "Protokoll".to_string(),
        state_version: loaded.state_version,
    };
    assert_eq!(
        store.save_state(created[0].clone(), saved).await.unwrap(),
        SaveOutcome::Saved { state_version: 2 }
    );
    db.set_document_groups(&created[1], &[]).await.unwrap();
    backend.analyze().await;
    assert_eq!(order().await, created);

    // Not by `created_at`: the clock may go back between two documents, and two created in
    // one millisecond tie.
    for (n, id) in created.iter().enumerate() {
        backend.backdate_document(id, 1_000 - n as i64).await;
    }
    backend.analyze().await;
    assert_eq!(order().await, created);
    backend.drop().await;
}

#[tokio::test]
async fn a_group_sent_twice_is_kept_twice() {
    let Some(backend) = Backend::new().await else {
        return;
    };
    let db = &backend.db;
    db.create_document_group("Alpha").await.unwrap();
    db.create_document_group("Beta").await.unwrap();
    let groups = listed(db).await.groups;
    let (alpha, beta) = (groups[0]._id.clone(), groups[1]._id.clone());

    // MongoDB stored `group_ids` as sent.
    let twice = vec![alpha.clone(), beta.clone(), alpha.clone()];
    let created = db.create_document("# A", twice.clone(), "u").await.unwrap();
    assert_eq!(created.group_ids, twice);
    assert_eq!(
        db.get_document(&created._id)
            .await
            .unwrap()
            .unwrap()
            .group_ids,
        twice
    );
    let body = listed(db).await;
    assert_eq!(
        body.groups[0].document_ids,
        vec![created._id.clone(), created._id.clone()],
        "listed once per entry"
    );

    let document = db.create_document("# B", vec![], "u").await.unwrap();
    assert!(db
        .set_document_groups(&document._id, &[beta.clone(), beta.clone()])
        .await
        .unwrap());
    assert_eq!(
        db.get_document(&document._id)
            .await
            .unwrap()
            .unwrap()
            .group_ids,
        vec![beta.clone(), beta.clone()]
    );

    // Deleting a group takes every entry of it, like `$pull`.
    assert!(db.delete_document_group(&alpha).await.unwrap());
    assert_eq!(
        db.get_document(&created._id)
            .await
            .unwrap()
            .unwrap()
            .group_ids,
        vec![beta.clone()]
    );
    backend.drop().await;
}

// --- U+0000: BSON strings held it, Postgres text cannot ----------------------------------

#[tokio::test]
async fn ids_with_a_nul_character_find_nothing_and_change_nothing() {
    let Some(backend) = Backend::new().await else {
        return;
    };
    let db = &backend.db;
    let store = backend.store();
    let nul = "a\u{0}b";
    assert!(db.get_meeting(nul).await.unwrap().is_none());
    assert!(db.get_document(nul).await.unwrap().is_none());
    assert!(db.get_document_versions(nul).await.unwrap().is_empty());
    assert!(db.get_place(nul).await.unwrap().is_none());
    assert!(db.get_user(nul).await.unwrap().is_none());
    assert!(db.get_email_draft(nul).await.unwrap().is_none());
    assert!(db.claim_email_draft(nul).await.unwrap().is_none());
    db.delete_email_draft(nul).await.unwrap();
    assert!(store.load_state(nul.to_string()).await.unwrap().is_none());
    assert!(db.delete_meeting(nul, &auth(Some("x"))).await.is_err());
    assert!(db
        .update_member_status(nul, &MembershipStatus::Approved)
        .await
        .is_err());
    assert!(db
        .update_member_data(nul, submitted("a@example.invalid"))
        .await
        .is_err());
    assert!(!db.set_document_groups(nul, &[]).await.unwrap());
    assert!(!db.delete_document(nul, "u").await.unwrap());
    assert!(!db.rename_document_group(nul, "Egal").await.unwrap());
    assert!(!db.delete_document_group(nul).await.unwrap());
    assert!(!db.set_group_document_order(nul, &[]).await.unwrap());
    let saved = SavedState {
        state: backend::document_rooms::initial_state("x"),
        content: "x".to_string(),
        title: "x".to_string(),
        state_version: 1,
    };
    assert_eq!(
        store.save_state(nul.to_string(), saved).await.unwrap(),
        SaveOutcome::Gone
    );

    db.create_document_group("Alpha").await.unwrap();
    db.create_document_group("Beta").await.unwrap();
    let groups = listed(db).await.groups;
    let (alpha, beta) = (groups[0]._id.clone(), groups[1]._id.clone());
    assert!(!db
        .document_groups_exist(&[alpha.clone(), nul.to_string()])
        .await
        .unwrap());
    // The orders are wish lists: an id no group or document has changes nothing.
    db.set_document_group_order(&[nul.to_string(), beta.clone()])
        .await
        .unwrap();
    assert_eq!(listed(db).await.groups[0]._id, beta);
    let first = db
        .create_document("# A", vec![alpha.clone()], "u")
        .await
        .unwrap();
    let second = db
        .create_document("# B", vec![alpha.clone()], "u")
        .await
        .unwrap();
    assert!(db
        .set_group_document_order(&alpha, &[nul.to_string(), second._id.clone()])
        .await
        .unwrap());
    assert_eq!(
        listed(db).await.groups[1].document_ids,
        vec![second._id.clone(), first._id.clone()]
    );

    // An unknown id saves as a new meeting under a fresh id, this one too.
    let mut sent = meeting("Neu");
    sent._id = nul.to_string();
    db.update_meeting(&mut sent, &auth(Some("editor")))
        .await
        .unwrap();
    let (stored, count) = db
        .get_meetings(MeetingTypeQuery::Planned, None, false, None)
        .await
        .unwrap();
    assert_eq!(count, 1);
    assert_eq!(stored[0]._id.len(), 5);
    assert_eq!(stored[0].title, "Neu");

    // Searching for it: MongoDB refused the regular expression, the literal search of
    // Postgres finds nothing (research-postgres §3.6 item 2).
    let searched = db
        .get_users(None, 0, Some(nul.to_string()), None, None)
        .await;
    match KIND {
        Kind::Mongo => assert!(searched.is_err()),
        Kind::Postgres => {
            let (users, count) = searched.unwrap();
            assert!(users.is_empty());
            assert_eq!(count, 0);
        }
    }
    backend.drop().await;
}

#[tokio::test]
async fn a_document_text_with_a_nul_character_saves_and_its_state_keeps_it() {
    let Some(backend) = Backend::new().await else {
        return;
    };
    let db = &backend.db;
    let store = backend.store();
    let text = "# Titel\n\nvor\u{0}nach";
    let created = db.create_document(text, vec![], "u").await.unwrap();
    assert_eq!(created.title, "Titel");
    let state = backend.document_state(&created._id).await.unwrap();
    assert_eq!(text_of_state(&state).unwrap(), text, "the state is exact");
    let read = db.get_document(&created._id).await.unwrap().unwrap();
    assert_eq!(read, created);
    // The text derived from the state: MongoDB kept the character, Postgres text cannot.
    match KIND {
        Kind::Mongo => assert_eq!(read.content, text),
        Kind::Postgres => assert_eq!(read.content, "# Titel\n\nvornach"),
    }

    // A room save of such a text goes through, and the state comes back byte for byte.
    let edited = "# Titel\n\n\u{0}neu";
    let saved = SavedState {
        state: backend::document_rooms::initial_state(edited),
        content: edited.to_string(),
        title: "Titel".to_string(),
        state_version: 1,
    };
    assert_eq!(
        store
            .save_state(created._id.clone(), saved.clone())
            .await
            .unwrap(),
        SaveOutcome::Saved { state_version: 2 }
    );
    let loaded = store
        .load_state(created._id.clone())
        .await
        .unwrap()
        .unwrap();
    assert_eq!(loaded.state, saved.state);
    let read = db.get_document(&created._id).await.unwrap().unwrap();
    match KIND {
        Kind::Mongo => assert_eq!(read.content, edited),
        Kind::Postgres => assert_eq!(read.content, "# Titel\n\nneu"),
    }
    let found: Vec<String> = backend
        .search_all()
        .await
        .into_iter()
        .map(|document| document.content)
        .collect();
    assert_eq!(found, std::slice::from_ref(&read.content));

    store
        .add_version(
            created._id.clone(),
            NewVersion {
                content: edited.to_string(),
                editors: vec!["u".to_string()],
            },
        )
        .await
        .unwrap();
    let versions = db.get_document_versions(&created._id).await.unwrap();
    assert_eq!(versions.len(), 1);
    assert_eq!(versions[0].content, read.content);
    backend.drop().await;
}

#[tokio::test]
async fn the_database_layer_stores_meeting_text_with_a_nul_character_only_on_mongo() {
    let Some(backend) = Backend::new().await else {
        return;
    };
    let db = &backend.db;
    let created = db.create_meetings(vec![meeting("A")], "u").await.unwrap();
    let mut sent = created[0].clone();
    sent.description = "a\u{0}b".to_string();
    let saved = db.update_meeting(&mut sent, &auth(Some("editor"))).await;
    // The handler refuses such a meeting before it gets here (update_meeting.rs, 422).
    match KIND {
        Kind::Mongo => saved.unwrap(),
        Kind::Postgres => {
            assert!(saved.is_err());
            let stored = db.get_meeting(&created[0]._id).await.unwrap().unwrap();
            assert_eq!(stored, created[0], "nothing changed");
        }
    }
    backend.drop().await;
}
