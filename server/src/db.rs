//! Every query of the server, on Postgres. The methods keep the signatures the handlers
//! had against MongoDB (research-postgres §3.3): the HTTP API and `web/` do not know the
//! storage. Queries are checked at compile time against `migrations-sql/` (through
//! `DATABASE_URL` or the committed `.sqlx/` cache); the one runtime query is the member list
//! with its dynamic sort, see `get_users`.

use crate::document_rooms::{
    initial_state, DocumentStore, LoadedState, NewVersion, SaveOutcome, SavedState,
};
use crate::document_rules::{derive_title, sort_key, ListedDocument, StoredGroup};
use crate::interossea::Auth;
use crate::place_rules::place_name_key;
use crate::types::{
    Address, ChangedMeeting, CommonMeetingTag, DraftStatus, EmailAttachment, EmailDraft,
    InternalMember, Meeting, MeetingLocation, MeetingStatus, MeetingTags, MeetingTypeQuery,
    MemberType, MembershipStatus, Name, OnlineMeeting, Place, QueerMeetingTag, SentEmailLog,
    SubmittedMember, User, UserCapabilities, WikiDocument, WikiDocumentVersion,
};
use crate::utils::{fresh_ids, generate_id};
use anyhow::{bail, Context};
use futures_util::future::BoxFuture;
use futures_util::stream::BoxStream;
use serde::Deserialize;
use sqlx::postgres::{PgConnection, PgPool, PgPoolOptions};
use sqlx::types::Json;
use sqlx::{AssertSqlSafe, Postgres};
use std::borrow::Cow;
use std::collections::HashSet;
use std::time::Duration;

/// The schema, applied at every start (`DB::migrate`).
pub static MIGRATOR: sqlx::migrate::Migrator = sqlx::migrate!("./migrations-sql");

/// One process, few concurrent requests; the document search holds at most two connections
/// for its streaming cursor, plus the rooms saving.
const MAX_CONNECTIONS: u32 = 8;
/// A dead database fails requests fast instead of hanging.
const ACQUIRE_TIMEOUT: Duration = Duration::from_secs(5);

/// Versions kept and served per document; the migrator's verification compares that many.
pub(crate) const MAX_DOCUMENT_VERSIONS: i64 = 50;
/// Opening and closing a room in a loop must not push the good versions out.
const MIN_MS_BETWEEN_VERSIONS: i64 = 60_000;

/// `_id` of the one record in `document_group_order`.
const GROUP_ORDER_ID: &str = "main";

/// The fields a search reads.
#[derive(Debug, Deserialize)]
pub struct SearchableDocument {
    pub _id: String,
    pub title: String,
    pub content: String,
}

/// What can go wrong naming a group.
#[derive(Debug, thiserror::Error)]
pub enum GroupNameError {
    #[error("Eine Gruppe mit diesem Namen gibt es schon.")]
    Taken,
    #[error(transparent)]
    Database(#[from] anyhow::Error),
}

fn is_unique_violation(error: &sqlx::Error) -> bool {
    matches!(error, sqlx::Error::Database(e) if e.is_unique_violation())
}

/// Postgres `text` and `jsonb` cannot hold U+0000, BSON strings could. No id or key the
/// server stores has one (they are generated, or validated like names), so a lookup by a
/// value with one finds nothing, as on MongoDB, without asking the database (which would
/// refuse the parameter with SQLSTATE 22021).
fn storable(value: &str) -> bool {
    !value.contains('\0')
}

/// Whether every string of a value (object keys included) can be stored. The handlers that
/// store client text refuse it otherwise, as invalid input, instead of failing the write.
pub fn storable_value<T: serde::Serialize>(value: &T) -> bool {
    fn walk(value: &serde_json::Value) -> bool {
        match value {
            serde_json::Value::String(s) => storable(s),
            serde_json::Value::Array(items) => items.iter().all(walk),
            serde_json::Value::Object(fields) => fields
                .iter()
                .all(|(key, value)| storable(key) && walk(value)),
            _ => true,
        }
    }
    // Serializing these plain structs cannot fail; if it did, the write would fail too.
    serde_json::to_value(value).is_ok_and(|value| walk(&value))
}

/// Whether `update_meeting` can store the meeting: its `_id` is only looked up (an unknown
/// one creates the meeting under a fresh id) and its `changed` is replaced by the server.
pub fn storable_meeting(meeting: &Meeting) -> bool {
    let mut stored = meeting.clone();
    stored._id = String::new();
    stored.changed = None;
    storable_value(&stored)
}

/// A document text as `documents.content` and `document_versions.content` hold it: without
/// U+0000 (see `storable`). The Yjs state, the source of truth, keeps the character.
pub fn storable_text(text: &str) -> Cow<'_, str> {
    if storable(text) {
        Cow::Borrowed(text)
    } else {
        Cow::Owned(text.replace('\0', ""))
    }
}

/// What can go wrong creating a batch, by what the caller can know about the outcome.
#[derive(Debug, thiserror::Error)]
pub enum CreateMeetingsError {
    #[error("looking up existing meeting ids failed: {0}")]
    IdLookup(#[source] Box<sqlx::Error>),
    /// Nothing was created: a statement failed and was rolled back, or the server answered
    /// the COMMIT with an error, which rolls the transaction back.
    #[error("creating meetings failed and was rolled back: {0}")]
    RolledBack(#[source] Box<sqlx::Error>),
    /// An insert failed and the ROLLBACK could not be sent either. Nothing was created: the
    /// COMMIT was never sent, and the server rolls back a transaction whose connection ends.
    #[error("inserting meetings failed ({insert}) and the rollback failed too ({rollback})")]
    RollbackFailed {
        insert: Box<sqlx::Error>,
        rollback: Box<sqlx::Error>,
    },
    /// The COMMIT was sent but no answer came back (the connection broke). The server may
    /// have committed the whole batch or nothing; this process cannot know which.
    #[error("the commit of the new meetings was not confirmed, they may exist: {0}")]
    CommitUnconfirmed(#[source] Box<sqlx::Error>),
}

/// A meeting row with its change history aggregated, see `MEETING_COLUMNS` in the queries.
struct MeetingRow {
    _id: String,
    title: String,
    authority: String,
    age_restriction: Vec<i16>,
    time: Option<i64>,
    location_name: Option<String>,
    location_lat: Option<f64>,
    location_lon: Option<f64>,
    place_id: Option<String>,
    online_platform: Option<String>,
    online_url: Option<String>,
    online_members_only: Option<bool>,
    place_to_be_announced: bool,
    description: String,
    price: Vec<f32>,
    trigger_warning: Option<String>,
    attendance: Option<i32>,
    rating: Option<f32>,
    accessibility: Option<String>,
    tags_freeform: Vec<String>,
    tags_common: Vec<CommonMeetingTag>,
    tags_queer: Vec<QueerMeetingTag>,
    status: MeetingStatus,
    cancelled: Option<bool>,
    deleted_at: Option<i64>,
    changed: Json<Vec<ChangedMeeting>>,
}

impl TryFrom<MeetingRow> for Meeting {
    type Error = anyhow::Error;

    fn try_from(row: MeetingRow) -> anyhow::Result<Self> {
        let location = match (row.location_name, row.location_lat, row.location_lon) {
            (Some(name), Some(lat), Some(lon)) => Some(MeetingLocation { name, lat, lon }),
            _ => None,
        };
        let online = match (row.online_platform, row.online_members_only) {
            (Some(platform), Some(members_only)) => Some(OnlineMeeting {
                platform,
                url: row.online_url,
                members_only,
                // A response-only flag (types.rs), never stored.
                url_hidden: false,
            }),
            _ => None,
        };
        let age_restriction = row
            .age_restriction
            .into_iter()
            .map(|age| u8::try_from(age).with_context(|| format!("age restriction {age}")))
            .collect::<anyhow::Result<_>>()?;
        let attendance = row
            .attendance
            .map(|attendance| u16::try_from(attendance).context("attendance"))
            .transpose()?;
        Ok(Meeting {
            _id: row._id,
            title: row.title,
            authority: row.authority,
            age_restriction,
            time: row.time,
            location,
            place_id: row.place_id,
            online,
            place_to_be_announced: row.place_to_be_announced,
            description: row.description,
            price: row.price,
            trigger_warning: row.trigger_warning,
            attendance,
            rating: row.rating,
            accessibility: row.accessibility,
            tags: MeetingTags {
                freeform: row.tags_freeform,
                common: row.tags_common,
                queer: row.tags_queer,
            },
            status: row.status,
            // Meetings from before the history existed have none, not an empty one.
            changed: (!row.changed.0.is_empty()).then_some(row.changed.0),
            cancelled: row.cancelled,
            deleted_at: row.deleted_at,
        })
    }
}

fn meetings_of(rows: Vec<MeetingRow>) -> anyhow::Result<Vec<Meeting>> {
    rows.into_iter().map(Meeting::try_from).collect()
}

fn age_restriction_of(meeting: &Meeting) -> Vec<i16> {
    meeting
        .age_restriction
        .iter()
        .map(|age| *age as i16)
        .collect()
}

/// Stores a new meeting without its history; the callers add it right before they commit,
/// see `change_now`.
async fn insert_meeting(
    connection: &mut PgConnection,
    meeting: &Meeting,
) -> Result<(), sqlx::Error> {
    sqlx::query!(
        r#"
        INSERT INTO meetings (
            _id, title, authority, age_restriction, time,
            location_name, location_lat, location_lon, place_id,
            online_platform, online_url, online_members_only, place_to_be_announced,
            description, price, trigger_warning, attendance, rating, accessibility,
            tags_freeform, tags_common, tags_queer, status, cancelled, deleted_at
        ) VALUES (
            $1, $2, $3, $4, $5,
            $6, $7, $8, $9,
            $10, $11, $12, $13,
            $14, $15, $16, $17, $18, $19,
            $20, $21, $22, $23, $24, $25
        )
        "#,
        meeting._id,
        meeting.title,
        meeting.authority,
        &age_restriction_of(meeting),
        meeting.time,
        meeting
            .location
            .as_ref()
            .map(|location| location.name.as_str()),
        meeting.location.as_ref().map(|location| location.lat),
        meeting.location.as_ref().map(|location| location.lon),
        meeting.place_id,
        meeting
            .online
            .as_ref()
            .map(|online| online.platform.as_str()),
        meeting
            .online
            .as_ref()
            .and_then(|online| online.url.as_deref()),
        meeting.online.as_ref().map(|online| online.members_only),
        meeting.place_to_be_announced,
        meeting.description,
        &meeting.price,
        meeting.trigger_warning,
        meeting.attendance.map(i32::from),
        meeting.rating,
        meeting.accessibility,
        &meeting.tags.freeform,
        &meeting.tags.common as &[CommonMeetingTag],
        &meeting.tags.queer as &[QueerMeetingTag],
        meeting.status as MeetingStatus,
        meeting.cancelled,
        meeting.deleted_at,
    )
    .execute(&mut *connection)
    .await?;
    Ok(())
}

/// The first history entry of new meetings, all at once.
async fn insert_first_changes(
    connection: &mut PgConnection,
    meeting_ids: &[String],
    change: &ChangedMeeting,
) -> Result<(), sqlx::Error> {
    sqlx::query!(
        r#"
        INSERT INTO meeting_changes (meeting_id, position, at, by)
        SELECT id, 0, $2, $3 FROM unnest($1::text[]) AS id
        "#,
        meeting_ids,
        change.at,
        change.by,
    )
    .execute(connection)
    .await?;
    Ok(())
}

/// A history entry stamped now. The delta sync hands clients the newest `at` they have seen
/// as their cursor and later asks only for changes after it, so a change must become visible
/// as soon after its `at` as possible: one that commits with an `at` below a cursor already
/// handed out is never delivered. MongoDB took the time right before its single write. Here
/// it is taken inside the transaction, after the row lock is held and the reads are done, so
/// only the write and the COMMIT lie between the stamp and its visibility.
fn change_now(by: String) -> ChangedMeeting {
    ChangedMeeting {
        at: chrono::Utc::now().timestamp_millis(),
        by,
    }
}

struct PlaceRow {
    _id: String,
    name: String,
    lat: f64,
    lon: f64,
}

impl From<PlaceRow> for Place {
    fn from(row: PlaceRow) -> Self {
        Place {
            _id: row._id,
            name: row.name,
            lat: row.lat,
            lon: row.lon,
        }
    }
}

/// A user with its member row joined; the member columns are null without one.
#[derive(sqlx::FromRow)]
struct UserRow {
    _id: String,
    capabilities: Vec<UserCapabilities>,
    member_type: Option<MemberType>,
    natural_person: Option<bool>,
    name_passport: Option<String>,
    name_first: Option<String>,
    name_last: Option<String>,
    institution: Option<String>,
    pronouns: Option<String>,
    address_street: Option<String>,
    address_number: Option<String>,
    address_addition: Option<String>,
    address_zip: Option<String>,
    address_city: Option<String>,
    address_country: Option<String>,
    email: Option<String>,
    phone: Option<String>,
    start_time_ms: Option<i64>,
    end_time_ms: Option<i64>,
    status: Option<MembershipStatus>,
    user_notes: Option<String>,
    admin_notes: Option<String>,
    reference: Option<String>,
    approved_charter: Option<bool>,
    approved_privacy: Option<bool>,
    above_18: Option<bool>,
    honorary: Option<bool>,
}

impl TryFrom<UserRow> for User {
    type Error = anyhow::Error;

    fn try_from(row: UserRow) -> anyhow::Result<Self> {
        let Some(member_type) = row.member_type else {
            return Ok(User {
                id: row._id,
                member: None,
                capabilities: Some(row.capabilities),
            });
        };
        // The schema makes these NOT NULL; a null here is a broken join, not data.
        fn required<T>(value: Option<T>, column: &str) -> anyhow::Result<T> {
            value.with_context(|| format!("members.{column} is null"))
        }
        let name = match (row.name_passport, row.name_first, row.name_last) {
            (Some(passport), Some(first_name), Some(last_name)) => Some(Name {
                passport,
                first_name,
                last_name,
            }),
            _ => None,
        };
        let member = InternalMember {
            _type: member_type,
            natural_person: required(row.natural_person, "natural_person")?,
            name,
            institution: row.institution,
            pronouns: row.pronouns,
            address: Address {
                street: required(row.address_street, "address_street")?,
                number: required(row.address_number, "address_number")?,
                addition: row.address_addition,
                zip: required(row.address_zip, "address_zip")?,
                city: required(row.address_city, "address_city")?,
                country: required(row.address_country, "address_country")?,
            },
            email: required(row.email, "email")?,
            phone: row.phone,
            start_time_ms: required(row.start_time_ms, "start_time_ms")?,
            end_time_ms: row.end_time_ms,
            status: row.status,
            user_notes: row.user_notes,
            admin_notes: row.admin_notes,
            reference: row.reference,
            approved_charter: required(row.approved_charter, "approved_charter")?,
            approved_privacy: required(row.approved_privacy, "approved_privacy")?,
            above_18: required(row.above_18, "above_18")?,
            honorary: required(row.honorary, "honorary")?,
        };
        Ok(User {
            id: row._id,
            member: Some(member),
            capabilities: Some(row.capabilities),
        })
    }
}

/// The columns of `UserRow`, for the member list (the one runtime query).
const USER_COLUMNS: &str = r#"
    u._id, u.capabilities,
    m.member_type, m.natural_person, m.name_passport, m.name_first, m.name_last,
    m.institution, m.pronouns, m.address_street, m.address_number, m.address_addition,
    m.address_zip, m.address_city, m.address_country, m.email, m.phone, m.start_time_ms,
    m.end_time_ms, m.status, m.user_notes, m.admin_notes, m.reference, m.approved_charter,
    m.approved_privacy, m.above_18, m.honorary
"#;

/// The member fields the list may be sorted by, as the client names them (the names of the
/// JSON fields, which the web sends; research-postgres §3.6 item 3). The enum columns sort
/// by their names, as their JSON strings did.
fn member_sort_column(field: &str) -> Option<&'static str> {
    Some(match field {
        "start_time_ms" => "m.start_time_ms",
        "end_time_ms" => "m.end_time_ms",
        "email" => "m.email",
        "status" => "m.status::text COLLATE \"C\"",
        "type" => "m.member_type::text COLLATE \"C\"",
        "institution" => "m.institution",
        "name.first_name" => "m.name_first",
        "name.last_name" => "m.name_last",
        _ => return None,
    })
}

/// `%`, `_` and `\` of a search term are text, not pattern characters.
fn like_pattern(term: &str) -> String {
    let mut pattern = String::with_capacity(term.len() + 2);
    pattern.push('%');
    for c in term.chars() {
        if matches!(c, '%' | '_' | '\\') {
            pattern.push('\\');
        }
        pattern.push(c);
    }
    pattern.push('%');
    pattern
}

struct DraftRow {
    _id: String,
    sender_id: String,
    sender_email: String,
    subject: String,
    body: String,
    attachments: Json<Vec<EmailAttachment>>,
    verification_code: String,
    created_at: i64,
    recipient_count: i32,
    status: DraftStatus,
    reply_to: Option<String>,
}

impl TryFrom<DraftRow> for EmailDraft {
    type Error = anyhow::Error;

    fn try_from(row: DraftRow) -> anyhow::Result<Self> {
        Ok(EmailDraft {
            _id: row._id,
            sender_id: row.sender_id,
            sender_email: row.sender_email,
            subject: row.subject,
            body: row.body,
            attachments: row.attachments.0,
            verification_code: row.verification_code,
            created_at: row.created_at,
            recipient_count: u32::try_from(row.recipient_count).context("recipient_count")?,
            status: row.status,
            reply_to: row.reply_to,
        })
    }
}

fn count_column(count: u32, what: &str) -> anyhow::Result<i32> {
    i32::try_from(count).with_context(|| format!("{what} does not fit the column"))
}

pub struct DB {
    pub pool: PgPool,
}

impl DB {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }

    pub async fn connect(url: &str) -> anyhow::Result<Self> {
        let pool = PgPoolOptions::new()
            .max_connections(MAX_CONNECTIONS)
            .acquire_timeout(ACQUIRE_TIMEOUT)
            .connect(url)
            .await
            .context("connecting to the database")?;
        Ok(Self::new(pool))
    }

    /// Brings the schema up to date; nothing to do when it is. Every start runs this.
    pub async fn migrate(&self) -> anyhow::Result<()> {
        MIGRATOR
            .run(&self.pool)
            .await
            .context("applying the database migrations")?;
        Ok(())
    }

    /// Published meetings starting in `[from, until)` (ms), earliest first (ties by id),
    /// at most `limit`.
    pub async fn get_published_meetings_between(
        &self,
        from: i64,
        until: i64,
        limit: i64,
    ) -> anyhow::Result<Vec<Meeting>> {
        let rows = sqlx::query_as!(
            MeetingRow,
            r#"
            SELECT m._id, m.title, m.authority, m.age_restriction, m.time,
                m.location_name, m.location_lat, m.location_lon, m.place_id,
                m.online_platform, m.online_url, m.online_members_only, m.place_to_be_announced,
                m.description, m.price, m.trigger_warning, m.attendance, m.rating, m.accessibility,
                m.tags_freeform,
                m.tags_common AS "tags_common: Vec<CommonMeetingTag>",
                m.tags_queer AS "tags_queer: Vec<QueerMeetingTag>",
                m.status AS "status: MeetingStatus", m.cancelled, m.deleted_at,
                (SELECT COALESCE(jsonb_agg(jsonb_build_object('by', c.by, 'at', c.at)
                                           ORDER BY c.position), '[]'::jsonb)
                 FROM meeting_changes c WHERE c.meeting_id = m._id)
                    AS "changed!: Json<Vec<ChangedMeeting>>"
            FROM meetings m
            WHERE m.status = 'Active' AND m.deleted_at IS NULL
                AND m.time >= $1 AND m.time < $2
            ORDER BY m.time, m._id
            LIMIT $3
            "#,
            from,
            until,
            limit,
        )
        .fetch_all(&self.pool)
        .await?;
        meetings_of(rows)
    }

    /// Get meetings by type.
    /// - `since`: If provided, returns only meetings updated/deleted since this timestamp (for delta sync)
    /// - `include_deleted`: If true, includes soft-deleted meetings in results
    /// - `starting_from`: If provided (and `since` is not), only meetings starting at or after
    ///   this timestamp; the count then counts only those
    pub async fn get_meetings(
        &self,
        meeting_type: MeetingTypeQuery,
        since: Option<i64>,
        include_deleted: bool,
        starting_from: Option<i64>,
    ) -> anyhow::Result<(Vec<Meeting>, u32)> {
        let status = match meeting_type {
            MeetingTypeQuery::Planned => MeetingStatus::Planned,
            MeetingTypeQuery::Active => MeetingStatus::Active,
        };
        // Delta sync (`since`) returns meetings changed or deleted after the timestamp, deleted
        // ones included so clients can drop them, and ignores `starting_from`. Otherwise
        // deleted meetings are left out unless asked for. Latest first, undated last, equal
        // times newest first: MongoDB scanned its `time` index backwards for every variant
        // of this query (`explain()`: IXSCAN time_1, direction backward), which returns equal
        // keys in reverse record order. The handlers keep this order (get_meetings only
        // reverses the upcoming part, ical_feed none), so it is what the web shows.
        let rows = sqlx::query_as!(
            MeetingRow,
            r#"
            SELECT m._id, m.title, m.authority, m.age_restriction, m.time,
                m.location_name, m.location_lat, m.location_lon, m.place_id,
                m.online_platform, m.online_url, m.online_members_only, m.place_to_be_announced,
                m.description, m.price, m.trigger_warning, m.attendance, m.rating, m.accessibility,
                m.tags_freeform,
                m.tags_common AS "tags_common: Vec<CommonMeetingTag>",
                m.tags_queer AS "tags_queer: Vec<QueerMeetingTag>",
                m.status AS "status: MeetingStatus", m.cancelled, m.deleted_at,
                (SELECT COALESCE(jsonb_agg(jsonb_build_object('by', c.by, 'at', c.at)
                                           ORDER BY c.position), '[]'::jsonb)
                 FROM meeting_changes c WHERE c.meeting_id = m._id)
                    AS "changed!: Json<Vec<ChangedMeeting>>"
            FROM meetings m
            WHERE m.status = $1
                AND ($2::bigint IS NULL
                     OR m.deleted_at > $2
                     OR EXISTS (SELECT 1 FROM meeting_changes c
                                WHERE c.meeting_id = m._id AND c.at > $2))
                AND ($2::bigint IS NOT NULL OR $3::boolean OR m.deleted_at IS NULL)
                AND ($2::bigint IS NOT NULL OR $4::bigint IS NULL OR m.time >= $4)
            ORDER BY m.time DESC NULLS LAST, m.seq DESC
            "#,
            status as MeetingStatus,
            since,
            include_deleted,
            starting_from,
        )
        .fetch_all(&self.pool)
        .await?;
        // The count is always of the live meetings of the type.
        let count = sqlx::query_scalar!(
            r#"
            SELECT count(*) AS "count!"
            FROM meetings
            WHERE status = $1 AND deleted_at IS NULL
                AND ($2::bigint IS NOT NULL OR $3::bigint IS NULL OR time >= $3)
            "#,
            status as MeetingStatus,
            since,
            starting_from,
        )
        .fetch_one(&self.pool)
        .await?;
        Ok((meetings_of(rows)?, count as u32))
    }

    /// Soft-delete a meeting by setting deleted_at timestamp and recording who deleted it
    pub async fn delete_meeting(&self, meeting_id: &str, auth: &Auth) -> anyhow::Result<()> {
        let by = auth
            .authenticated_user
            .clone()
            .unwrap_or_else(|| "unknown".to_string());
        if !storable(meeting_id) {
            bail!("Meeting not found");
        }
        let mut tx = self.pool.begin().await?;
        let found = sqlx::query_scalar!(
            "SELECT _id FROM meetings WHERE _id = $1 FOR UPDATE",
            meeting_id
        )
        .fetch_optional(&mut *tx)
        .await?
        .is_some();
        if !found {
            bail!("Meeting not found");
        }
        let change = change_now(by);
        // One statement for the stamp and the history entry, then the COMMIT.
        sqlx::query!(
            r#"
            WITH stamped AS (
                UPDATE meetings SET deleted_at = $2 WHERE _id = $1 RETURNING _id
            )
            INSERT INTO meeting_changes (meeting_id, position, at, by)
            SELECT stamped._id,
                COALESCE((SELECT max(position) + 1 FROM meeting_changes WHERE meeting_id = $1), 0),
                $2, $3
            FROM stamped
            "#,
            meeting_id,
            change.at,
            change.by,
        )
        .execute(&mut *tx)
        .await?;
        tx.commit().await?;
        Ok(())
    }

    /// Stores the meeting as sent, with a new entry in its history; `meeting.changed` is
    /// set to the stored history. An unknown id creates the meeting under a fresh id (the
    /// create path of the editor); the caller's meeting then stays as it was.
    pub async fn update_meeting(&self, meeting: &mut Meeting, auth: &Auth) -> anyhow::Result<()> {
        let by = auth.authenticated_user.clone().unwrap();
        let mut tx = self.pool.begin().await?;
        // An id no stored meeting can have is unknown, as on MongoDB: the create path.
        let exists = storable(&meeting._id)
            && sqlx::query_scalar!(
                "SELECT _id FROM meetings WHERE _id = $1 FOR UPDATE",
                meeting._id
            )
            .fetch_optional(&mut *tx)
            .await?
            .is_some();

        if exists {
            let mut changed = sqlx::query_as!(
                ChangedMeeting,
                "SELECT at, by FROM meeting_changes WHERE meeting_id = $1 ORDER BY position",
                meeting._id
            )
            .fetch_all(&mut *tx)
            .await?;
            let change = change_now(by);
            // One statement for the row and the history entry, then the COMMIT. The row lock
            // keeps every other writer of this history out, so the position is the count.
            sqlx::query!(
                r#"
                WITH updated AS (
                    UPDATE meetings SET
                        title = $2, authority = $3, age_restriction = $4, time = $5,
                        location_name = $6, location_lat = $7, location_lon = $8, place_id = $9,
                        online_platform = $10, online_url = $11, online_members_only = $12,
                        place_to_be_announced = $13, description = $14, price = $15,
                        trigger_warning = $16, attendance = $17, rating = $18,
                        accessibility = $19, tags_freeform = $20, tags_common = $21,
                        tags_queer = $22, status = $23, cancelled = $24, deleted_at = $25
                    WHERE _id = $1
                    RETURNING _id
                )
                INSERT INTO meeting_changes (meeting_id, position, at, by)
                SELECT updated._id, $26, $27, $28 FROM updated
                "#,
                meeting._id,
                meeting.title,
                meeting.authority,
                &age_restriction_of(meeting),
                meeting.time,
                meeting
                    .location
                    .as_ref()
                    .map(|location| location.name.as_str()),
                meeting.location.as_ref().map(|location| location.lat),
                meeting.location.as_ref().map(|location| location.lon),
                meeting.place_id,
                meeting
                    .online
                    .as_ref()
                    .map(|online| online.platform.as_str()),
                meeting
                    .online
                    .as_ref()
                    .and_then(|online| online.url.as_deref()),
                meeting.online.as_ref().map(|online| online.members_only),
                meeting.place_to_be_announced,
                meeting.description,
                &meeting.price,
                meeting.trigger_warning,
                meeting.attendance.map(i32::from),
                meeting.rating,
                meeting.accessibility,
                &meeting.tags.freeform,
                &meeting.tags.common as &[CommonMeetingTag],
                &meeting.tags.queer as &[QueerMeetingTag],
                meeting.status as MeetingStatus,
                meeting.cancelled,
                meeting.deleted_at,
                i32::try_from(changed.len()).context("history length")?,
                change.at,
                change.by,
            )
            .execute(&mut *tx)
            .await?;
            changed.push(change);
            meeting.changed = Some(changed);
        } else {
            let mut created = meeting.clone();
            created._id = generate_id(5);
            insert_meeting(&mut tx, &created).await?;
            let change = change_now(by);
            insert_first_changes(&mut tx, std::slice::from_ref(&created._id), &change).await?;
        }
        tx.commit().await?;
        Ok(())
    }

    pub async fn get_meeting(&self, meeting_id: &str) -> anyhow::Result<Option<Meeting>> {
        if !storable(meeting_id) {
            return Ok(None);
        }
        let row = sqlx::query_as!(
            MeetingRow,
            r#"
            SELECT m._id, m.title, m.authority, m.age_restriction, m.time,
                m.location_name, m.location_lat, m.location_lon, m.place_id,
                m.online_platform, m.online_url, m.online_members_only, m.place_to_be_announced,
                m.description, m.price, m.trigger_warning, m.attendance, m.rating, m.accessibility,
                m.tags_freeform,
                m.tags_common AS "tags_common: Vec<CommonMeetingTag>",
                m.tags_queer AS "tags_queer: Vec<QueerMeetingTag>",
                m.status AS "status: MeetingStatus", m.cancelled, m.deleted_at,
                (SELECT COALESCE(jsonb_agg(jsonb_build_object('by', c.by, 'at', c.at)
                                           ORDER BY c.position), '[]'::jsonb)
                 FROM meeting_changes c WHERE c.meeting_id = m._id)
                    AS "changed!: Json<Vec<ChangedMeeting>>"
            FROM meetings m
            WHERE m._id = $1
            "#,
            meeting_id,
        )
        .fetch_optional(&self.pool)
        .await?;
        row.map(Meeting::try_from).transpose()
    }

    /// All live documents and groups, for `document_rules::arrange_documents`.
    pub async fn get_document_list(
        &self,
    ) -> anyhow::Result<(Vec<StoredGroup>, Vec<String>, Vec<ListedDocument>)> {
        let groups = sqlx::query!("SELECT _id, name, document_order FROM document_groups")
            .fetch_all(&self.pool)
            .await?
            .into_iter()
            .map(|group| StoredGroup {
                _id: group._id,
                name: group.name,
                document_order: group.document_order,
            })
            .collect();
        let group_order = sqlx::query_scalar!(
            "SELECT group_ids FROM document_group_order WHERE _id = $1",
            GROUP_ORDER_ID
        )
        .fetch_optional(&self.pool)
        .await?
        .unwrap_or_default();
        let documents = sqlx::query!(
            r#"
            SELECT d._id, d.title,
                COALESCE((SELECT array_agg(m.group_id ORDER BY m.position)
                          FROM document_group_members m WHERE m.document_id = d._id), '{}')
                    AS "group_ids!"
            FROM documents d
            WHERE d.deleted_at IS NULL
            "#
        )
        .fetch_all(&self.pool)
        .await?
        .into_iter()
        .map(|document| ListedDocument {
            _id: document._id,
            title: document.title,
            group_ids: document.group_ids,
        })
        .collect();
        Ok((groups, group_order, documents))
    }

    pub async fn get_document(&self, document_id: &str) -> anyhow::Result<Option<WikiDocument>> {
        if !storable(document_id) {
            return Ok(None);
        }
        Ok(sqlx::query!(
            r#"
            SELECT d._id, d.title, d.content,
                COALESCE((SELECT array_agg(m.group_id ORDER BY m.position)
                          FROM document_group_members m WHERE m.document_id = d._id), '{}')
                    AS "group_ids!"
            FROM documents d
            WHERE d._id = $1 AND d.deleted_at IS NULL
            "#,
            document_id
        )
        .fetch_optional(&self.pool)
        .await?
        .map(|document| WikiDocument {
            _id: document._id,
            title: document.title,
            content: document.content,
            group_ids: document.group_ids,
            editing: false,
        }))
    }

    /// Every live document, without its state, one at a time, in the order MongoDB's
    /// unsorted find returned them (natural order, `seq`). The search sorts its hits stably,
    /// so hits that rank the same keep this order, and the first `MAX_HITS` are taken from it.
    pub async fn searchable_documents(
        &self,
    ) -> anyhow::Result<BoxStream<'_, Result<SearchableDocument, sqlx::Error>>> {
        Ok(sqlx::query_as!(
            SearchableDocument,
            "SELECT _id, title, content FROM documents WHERE deleted_at IS NULL ORDER BY seq"
        )
        .fetch(&self.pool))
    }

    /// Whether all these groups exist.
    pub async fn document_groups_exist(&self, group_ids: &[String]) -> anyhow::Result<bool> {
        if !group_ids.iter().all(|id| storable(id)) {
            return Ok(false);
        }
        let unique: HashSet<&String> = group_ids.iter().collect();
        let found = sqlx::query_scalar!(
            r#"SELECT count(*) AS "count!" FROM document_groups WHERE _id = ANY($1)"#,
            group_ids
        )
        .fetch_one(&self.pool)
        .await?;
        Ok(found as usize == unique.len())
    }

    /// Returns the document as stored: its `content` without U+0000 (`storable_text`; the
    /// state keeps the text as sent) and the groups that existed when it was written.
    pub async fn create_document(
        &self,
        text: &str,
        group_ids: Vec<String>,
        created_by: &str,
    ) -> anyhow::Result<WikiDocument> {
        let now = chrono::offset::Utc::now().timestamp_millis();
        let mut document = WikiDocument {
            _id: generate_id(10),
            title: derive_title(text),
            content: storable_text(text).into_owned(),
            group_ids: Vec::new(),
            editing: false,
        };
        let mut tx = self.pool.begin().await?;
        sqlx::query!(
            r#"
            INSERT INTO documents (_id, title, content, state, state_version,
                                   created_by, created_at, updated_at)
            VALUES ($1, $2, $3, $4, 1, $5, $6, $6)
            "#,
            document._id,
            document.title,
            document.content,
            initial_state(text),
            created_by,
            now,
        )
        .execute(&mut *tx)
        .await?;
        let groups = lock_groups(&mut tx, &group_ids).await?;
        insert_group_members(&mut tx, &document._id, &groups).await?;
        tx.commit().await?;
        document.group_ids = groups;
        Ok(document)
    }

    /// Newest first.
    pub async fn get_document_versions(
        &self,
        document_id: &str,
    ) -> anyhow::Result<Vec<WikiDocumentVersion>> {
        if !storable(document_id) {
            return Ok(Vec::new());
        }
        Ok(sqlx::query_as!(
            WikiDocumentVersion,
            r#"
            SELECT _id, content, editors, saved_at FROM document_versions
            WHERE document_id = $1
            ORDER BY saved_at DESC, _id DESC
            LIMIT $2
            "#,
            document_id,
            MAX_DOCUMENT_VERSIONS,
        )
        .fetch_all(&self.pool)
        .await?)
    }

    /// Returns whether there was such a document.
    pub async fn set_document_groups(
        &self,
        document_id: &str,
        group_ids: &[String],
    ) -> anyhow::Result<bool> {
        if !storable(document_id) {
            return Ok(false);
        }
        let mut tx = self.pool.begin().await?;
        let live = sqlx::query_scalar!(
            "SELECT _id FROM documents WHERE _id = $1 AND deleted_at IS NULL FOR UPDATE",
            document_id
        )
        .fetch_optional(&mut *tx)
        .await?
        .is_some();
        if !live {
            return Ok(false);
        }
        // The groups first, the memberships after them, see `lock_groups`.
        let groups = lock_groups(&mut tx, group_ids).await?;
        sqlx::query!(
            "DELETE FROM document_group_members WHERE document_id = $1",
            document_id
        )
        .execute(&mut *tx)
        .await?;
        insert_group_members(&mut tx, document_id, &groups).await?;
        tx.commit().await?;
        Ok(true)
    }

    /// Returns whether there was such a document. It stays in the database, like meetings.
    pub async fn delete_document(&self, document_id: &str, user_id: &str) -> anyhow::Result<bool> {
        if !storable(document_id) {
            return Ok(false);
        }
        let now = chrono::offset::Utc::now().timestamp_millis();
        let result = sqlx::query!(
            r#"
            UPDATE documents SET deleted_by = $2, deleted_at = $3
            WHERE _id = $1 AND deleted_at IS NULL
            "#,
            document_id,
            user_id,
            now,
        )
        .execute(&self.pool)
        .await?;
        Ok(result.rows_affected() == 1)
    }

    pub async fn create_document_group(&self, name: &str) -> Result<(), GroupNameError> {
        let result = sqlx::query!(
            "INSERT INTO document_groups (_id, name, name_key) VALUES ($1, $2, $3)",
            generate_id(10),
            name,
            sort_key(name),
        )
        .execute(&self.pool)
        .await;
        match result {
            Ok(_) => Ok(()),
            Err(e) if is_unique_violation(&e) => Err(GroupNameError::Taken),
            Err(e) => Err(anyhow::Error::from(e).into()),
        }
    }

    /// Returns whether there was such a group.
    pub async fn rename_document_group(
        &self,
        group_id: &str,
        name: &str,
    ) -> Result<bool, GroupNameError> {
        if !storable(group_id) {
            return Ok(false);
        }
        let result = sqlx::query!(
            "UPDATE document_groups SET name = $2, name_key = $3 WHERE _id = $1",
            group_id,
            name,
            sort_key(name),
        )
        .execute(&self.pool)
        .await;
        match result {
            Ok(result) => Ok(result.rows_affected() == 1),
            Err(e) if is_unique_violation(&e) => Err(GroupNameError::Taken),
            Err(e) => Err(anyhow::Error::from(e).into()),
        }
    }

    /// Removes a group; its documents stay (their memberships go with it, every one, like
    /// MongoDB's `$pull`). Returns whether there was such a group. The DELETE locks the group
    /// row first and its cascade the memberships after it, the order `lock_groups` keeps.
    pub async fn delete_document_group(&self, group_id: &str) -> anyhow::Result<bool> {
        if !storable(group_id) {
            return Ok(false);
        }
        let result = sqlx::query!("DELETE FROM document_groups WHERE _id = $1", group_id)
            .execute(&self.pool)
            .await?;
        Ok(result.rows_affected() == 1)
    }

    /// The order is a wish list (`document_rules::apply_order` skips unknown ids), and no
    /// group id has a U+0000, so ids with one are left out: nothing can tell.
    pub async fn set_document_group_order(&self, group_ids: &[String]) -> anyhow::Result<()> {
        let group_ids = storable_ids(group_ids);
        sqlx::query!(
            r#"
            INSERT INTO document_group_order (_id, group_ids) VALUES ($1, $2)
            ON CONFLICT (_id) DO UPDATE SET group_ids = EXCLUDED.group_ids
            "#,
            GROUP_ORDER_ID,
            &group_ids as &[&str],
        )
        .execute(&self.pool)
        .await?;
        Ok(())
    }

    /// Returns whether there was such a group. Ids with a U+0000 are left out of the order,
    /// as in `set_document_group_order`.
    pub async fn set_group_document_order(
        &self,
        group_id: &str,
        document_ids: &[String],
    ) -> anyhow::Result<bool> {
        if !storable(group_id) {
            return Ok(false);
        }
        let document_ids = storable_ids(document_ids);
        let result = sqlx::query!(
            "UPDATE document_groups SET document_order = $2 WHERE _id = $1",
            group_id,
            &document_ids as &[&str],
        )
        .execute(&self.pool)
        .await?;
        Ok(result.rows_affected() == 1)
    }

    pub async fn get_places(&self) -> anyhow::Result<Vec<Place>> {
        let rows = sqlx::query_as!(
            PlaceRow,
            "SELECT _id, name, lat, lon FROM places ORDER BY name_key"
        )
        .fetch_all(&self.pool)
        .await?;
        Ok(rows.into_iter().map(Place::from).collect())
    }

    pub async fn get_place(&self, place_id: &str) -> anyhow::Result<Option<Place>> {
        if !storable(place_id) {
            return Ok(None);
        }
        Ok(sqlx::query_as!(
            PlaceRow,
            "SELECT _id, name, lat, lon FROM places WHERE _id = $1",
            place_id
        )
        .fetch_optional(&self.pool)
        .await?
        .map(Place::from))
    }

    /// Creates a place unless one with the same normalized name exists; that one is
    /// returned instead (`created == false`). `name` must already be validated.
    pub async fn create_place(
        &self,
        name: String,
        lat: f64,
        lon: f64,
        created_by: &str,
    ) -> anyhow::Result<(Place, bool)> {
        let name_key = place_name_key(&name);
        let created = sqlx::query_as!(
            PlaceRow,
            r#"
            INSERT INTO places (_id, name, name_key, lat, lon, created_by, created_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            ON CONFLICT (name_key) DO NOTHING
            RETURNING _id, name, lat, lon
            "#,
            generate_id(5),
            name,
            name_key,
            lat,
            lon,
            created_by,
            chrono::Utc::now().timestamp_millis(),
        )
        .fetch_optional(&self.pool)
        .await?;
        if let Some(created) = created {
            return Ok((created.into(), true));
        }
        // The unique key on name_key: the place exists (or was created concurrently).
        let existing = sqlx::query_as!(
            PlaceRow,
            "SELECT _id, name, lat, lon FROM places WHERE name_key = $1",
            name_key
        )
        .fetch_optional(&self.pool)
        .await?
        .ok_or_else(|| anyhow::anyhow!("duplicate place key vanished: {name_key}"))?;
        Ok((existing.into(), false))
    }

    /// Inserts new meetings with server-assigned ids and change history. Callers must
    /// validate the meetings and resolve their place first (see `meeting_validation`
    /// and `place_rules::finish_venue`).
    ///
    /// One transaction: a failing insert leaves nothing behind. The meetings are inserted in
    /// request order (their `seq` too, as MongoDB's `insert_many` gave them record ids), and
    /// their first history entry is stamped after the inserts, see `change_now`.
    pub async fn create_meetings(
        &self,
        mut meetings: Vec<Meeting>,
        created_by: &str,
    ) -> Result<Vec<Meeting>, CreateMeetingsError> {
        let mut tx = self
            .pool
            .begin()
            .await
            .map_err(|e| CreateMeetingsError::RolledBack(Box::new(e)))?;
        let ids = unused_meeting_ids(&mut tx, meetings.len()).await?;
        for (meeting, id) in meetings.iter_mut().zip(ids.iter()) {
            meeting._id = id.clone();
        }

        let inserted = async {
            for meeting in &meetings {
                insert_meeting(&mut tx, meeting).await?;
            }
            let created = change_now(created_by.to_string());
            insert_first_changes(&mut tx, &ids, &created).await?;
            Ok::<_, sqlx::Error>(created)
        }
        .await;
        let created = match inserted {
            Ok(created) => created,
            Err(insert) => {
                return match tx.rollback().await {
                    Ok(()) => Err(CreateMeetingsError::RolledBack(Box::new(insert))),
                    Err(rollback) => Err(CreateMeetingsError::RollbackFailed {
                        insert: Box::new(insert),
                        rollback: Box::new(rollback),
                    }),
                }
            }
        };
        tx.commit().await.map_err(|e| match e {
            // The server answered the COMMIT: an error answer means it rolled back.
            sqlx::Error::Database(_) => CreateMeetingsError::RolledBack(Box::new(e)),
            // No answer: the COMMIT may have been carried out before the connection broke.
            _ => CreateMeetingsError::CommitUnconfirmed(Box::new(e)),
        })?;
        for meeting in &mut meetings {
            meeting.changed = Some(vec![created.clone()]);
        }
        Ok(meetings)
    }

    pub async fn create_user(&self, user_id: &str) -> anyhow::Result<()> {
        sqlx::query!(
            "INSERT INTO users (_id) VALUES ($1) ON CONFLICT (_id) DO NOTHING",
            user_id
        )
        .execute(&self.pool)
        .await?;
        Ok(())
    }

    pub async fn get_user(&self, user_id: &str) -> anyhow::Result<Option<User>> {
        if !storable(user_id) {
            return Ok(None);
        }
        let row = sqlx::query_as!(
            UserRow,
            r#"
            SELECT u._id, u.capabilities AS "capabilities: Vec<UserCapabilities>",
                m.member_type AS "member_type?: MemberType", m.natural_person AS "natural_person?",
                m.name_passport, m.name_first, m.name_last, m.institution, m.pronouns,
                m.address_street AS "address_street?", m.address_number AS "address_number?",
                m.address_addition, m.address_zip AS "address_zip?", m.address_city AS "address_city?",
                m.address_country AS "address_country?", m.email AS "email?", m.phone,
                m.start_time_ms AS "start_time_ms?", m.end_time_ms,
                m.status AS "status?: MembershipStatus", m.user_notes, m.admin_notes, m.reference,
                m.approved_charter AS "approved_charter?", m.approved_privacy AS "approved_privacy?",
                m.above_18 AS "above_18?", m.honorary AS "honorary?"
            FROM users u LEFT JOIN members m ON m.user_id = u._id
            WHERE u._id = $1
            "#,
            user_id
        )
        .fetch_optional(&self.pool)
        .await?;
        row.map(User::try_from).transpose()
    }

    /// Stores a membership submission. The first one archives the user as stored right
    /// after it and returns `true`; later ones keep the fields only the board sets.
    pub async fn update_member_data(
        &self,
        user_id: &str,
        submitted_member: SubmittedMember,
    ) -> anyhow::Result<bool> {
        if !storable(user_id) {
            bail!("User not found")
        }
        let mut tx = self.pool.begin().await?;
        let Some(capabilities) = sqlx::query_scalar!(
            r#"SELECT capabilities AS "capabilities: Vec<UserCapabilities>"
               FROM users WHERE _id = $1 FOR UPDATE"#,
            user_id
        )
        .fetch_optional(&mut *tx)
        .await?
        else {
            bail!("User not found")
        };
        let present_member = sqlx::query!(
            r#"
            SELECT admin_notes, end_time_ms, honorary, start_time_ms,
                status AS "status: MembershipStatus"
            FROM members WHERE user_id = $1
            "#,
            user_id
        )
        .fetch_optional(&mut *tx)
        .await?;

        let updated_member = InternalMember {
            _type: submitted_member._type,
            name: submitted_member.name,
            institution: submitted_member.institution,
            email: submitted_member.email,
            phone: submitted_member.phone,
            address: submitted_member.address,
            above_18: submitted_member.above_18,
            approved_charter: submitted_member.approved_charter,
            approved_privacy: submitted_member.approved_privacy,
            natural_person: submitted_member.natural_person,
            admin_notes: present_member.as_ref().and_then(|m| m.admin_notes.clone()),
            reference: submitted_member.reference,
            end_time_ms: present_member.as_ref().and_then(|m| m.end_time_ms),
            honorary: present_member.as_ref().is_some_and(|m| m.honorary),
            pronouns: submitted_member.pronouns,
            start_time_ms: present_member.as_ref().map_or_else(
                || chrono::Utc::now().timestamp() * 1000,
                |m| m.start_time_ms,
            ),
            status: present_member
                .as_ref()
                .map_or(Some(MembershipStatus::Pending), |m| m.status.clone()),
            user_notes: submitted_member.user_notes,
        };
        let first_time = present_member.is_none();

        let m = &updated_member;
        sqlx::query!(
            r#"
            INSERT INTO members (
                user_id, member_type, natural_person, name_passport, name_first, name_last,
                institution, pronouns, address_street, address_number, address_addition,
                address_zip, address_city, address_country, email, phone, start_time_ms,
                end_time_ms, status, user_notes, admin_notes, reference, approved_charter,
                approved_privacy, above_18, honorary
            ) VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18,
                $19, $20, $21, $22, $23, $24, $25, $26
            )
            ON CONFLICT (user_id) DO UPDATE SET
                member_type = EXCLUDED.member_type, natural_person = EXCLUDED.natural_person,
                name_passport = EXCLUDED.name_passport, name_first = EXCLUDED.name_first,
                name_last = EXCLUDED.name_last, institution = EXCLUDED.institution,
                pronouns = EXCLUDED.pronouns, address_street = EXCLUDED.address_street,
                address_number = EXCLUDED.address_number,
                address_addition = EXCLUDED.address_addition, address_zip = EXCLUDED.address_zip,
                address_city = EXCLUDED.address_city, address_country = EXCLUDED.address_country,
                email = EXCLUDED.email, phone = EXCLUDED.phone,
                start_time_ms = EXCLUDED.start_time_ms, end_time_ms = EXCLUDED.end_time_ms,
                status = EXCLUDED.status, user_notes = EXCLUDED.user_notes,
                admin_notes = EXCLUDED.admin_notes, reference = EXCLUDED.reference,
                approved_charter = EXCLUDED.approved_charter,
                approved_privacy = EXCLUDED.approved_privacy, above_18 = EXCLUDED.above_18,
                honorary = EXCLUDED.honorary
            "#,
            user_id,
            m._type as MemberType,
            m.natural_person,
            m.name.as_ref().map(|name| name.passport.as_str()),
            m.name.as_ref().map(|name| name.first_name.as_str()),
            m.name.as_ref().map(|name| name.last_name.as_str()),
            m.institution,
            m.pronouns,
            m.address.street,
            m.address.number,
            m.address.addition,
            m.address.zip,
            m.address.city,
            m.address.country,
            m.email,
            m.phone,
            m.start_time_ms,
            m.end_time_ms,
            m.status.clone() as Option<MembershipStatus>,
            m.user_notes,
            m.admin_notes,
            m.reference,
            m.approved_charter,
            m.approved_privacy,
            m.above_18,
            m.honorary,
        )
        .execute(&mut *tx)
        .await?;

        if first_time {
            let snapshot = User {
                id: user_id.to_string(),
                member: Some(updated_member),
                capabilities: Some(capabilities),
            };
            sqlx::query!(
                "INSERT INTO original_users (user_id, snapshot, created_at) VALUES ($1, $2, $3)",
                user_id,
                Json(&snapshot) as Json<&User>,
                chrono::Utc::now().timestamp_millis(),
            )
            .execute(&mut *tx)
            .await?;
        }
        tx.commit().await?;
        Ok(first_time)
    }

    /// Users with member data: `search` is a case-insensitive substring of the first or
    /// last name, the email or the institution; `sort_by` one of `member_sort_column`,
    /// descending unless `sort_order` is `asc`; `limit` 0 or `None` means all (and a negative
    /// limit counts, as the old driver took it). Also returns the total of the selection.
    ///
    /// Members with the same value come in the order their users were created (`u.seq`), in
    /// both directions: MongoDB scanned the users in natural order and sorted them stably
    /// (`explain()`: COLLSCAN, SORT). That holds for every request the web makes (no `l`);
    /// with a limit MongoDB sorted with a bounded heap that leaves ties in no defined order.
    pub async fn get_users(
        &self,
        limit: Option<i64>,
        from_index: u64,
        search: Option<String>,
        sort_by: Option<String>,
        sort_order: Option<String>,
    ) -> anyhow::Result<(Vec<User>, u32)> {
        let sort_field = sort_by.as_deref().unwrap_or("start_time_ms");
        let sort_column = member_sort_column(sort_field)
            .ok_or_else(|| anyhow::anyhow!("unknown sort field: {sort_field}"))?;
        let direction = match sort_order.as_deref() {
            Some("asc") => "ASC NULLS FIRST",
            _ => "DESC NULLS LAST",
        };
        let pattern = search
            .filter(|term| !term.trim().is_empty())
            .map(|term| like_pattern(&term));
        // No stored text has a U+0000, so such a term matches nothing; MongoDB refused it as a
        // regular expression (500), this search is literal (research-postgres §3.6 item 2).
        if pattern.as_deref().is_some_and(|pattern| !storable(pattern)) {
            return Ok((Vec::new(), 0));
        }
        let limit = limit.map(i64::abs).filter(|limit| *limit != 0);
        let from_index = i64::try_from(from_index).context("from_index")?;

        // The sort column is one of a fixed set of literals, so this is the one query that
        // is not checked at compile time; the count below is, and both share the filter.
        let sql = format!(
            r#"
            SELECT {USER_COLUMNS}
            FROM users u JOIN members m ON m.user_id = u._id
            WHERE ($1::text IS NULL
                   OR m.name_first ILIKE $1 ESCAPE '\'
                   OR m.name_last ILIKE $1 ESCAPE '\'
                   OR m.email ILIKE $1 ESCAPE '\'
                   OR m.institution ILIKE $1 ESCAPE '\')
            ORDER BY {sort_column} {direction}, u.seq
            OFFSET $2 LIMIT $3
            "#
        );
        let rows: Vec<UserRow> = sqlx::query_as(AssertSqlSafe(sql))
            .bind(&pattern)
            .bind(from_index)
            .bind(limit)
            .fetch_all(&self.pool)
            .await?;
        let count = sqlx::query_scalar!(
            r#"
            SELECT count(*) AS "count!"
            FROM users u JOIN members m ON m.user_id = u._id
            WHERE ($1::text IS NULL
                   OR m.name_first ILIKE $1 ESCAPE '\'
                   OR m.name_last ILIKE $1 ESCAPE '\'
                   OR m.email ILIKE $1 ESCAPE '\'
                   OR m.institution ILIKE $1 ESCAPE '\')
            "#,
            pattern
        )
        .fetch_one(&self.pool)
        .await?;
        let users = rows
            .into_iter()
            .map(User::try_from)
            .collect::<anyhow::Result<_>>()?;
        Ok((users, count as u32))
    }

    pub async fn update_member_status(
        &self,
        user_id: &str,
        new_status: &MembershipStatus,
    ) -> anyhow::Result<()> {
        if !storable(user_id) {
            bail!("User not found")
        }
        let result = sqlx::query!(
            "UPDATE members SET status = $2 WHERE user_id = $1",
            user_id,
            new_status.clone() as MembershipStatus,
        )
        .execute(&self.pool)
        .await?;
        if result.rows_affected() == 1 {
            return Ok(());
        }
        let exists = sqlx::query_scalar!("SELECT _id FROM users WHERE _id = $1", user_id)
            .fetch_optional(&self.pool)
            .await?
            .is_some();
        if exists {
            bail!("User has no member data")
        }
        bail!("User not found")
    }

    // Email draft methods
    pub async fn insert_email_draft(&self, draft: &EmailDraft) -> anyhow::Result<()> {
        sqlx::query!(
            r#"
            INSERT INTO email_drafts (_id, sender_id, sender_email, subject, body, attachments,
                                      verification_code, created_at, recipient_count, status,
                                      reply_to)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
            "#,
            draft._id,
            draft.sender_id,
            draft.sender_email,
            draft.subject,
            draft.body,
            Json(&draft.attachments) as Json<&Vec<EmailAttachment>>,
            draft.verification_code,
            draft.created_at,
            count_column(draft.recipient_count, "recipient_count")?,
            draft.status.clone() as DraftStatus,
            draft.reply_to,
        )
        .execute(&self.pool)
        .await?;
        Ok(())
    }

    pub async fn get_email_draft(&self, draft_id: &str) -> anyhow::Result<Option<EmailDraft>> {
        if !storable(draft_id) {
            return Ok(None);
        }
        let row = sqlx::query_as!(
            DraftRow,
            r#"
            SELECT _id, sender_id, sender_email, subject, body,
                attachments AS "attachments: Json<Vec<EmailAttachment>>",
                verification_code, created_at, recipient_count, status AS "status: DraftStatus",
                reply_to
            FROM email_drafts WHERE _id = $1
            "#,
            draft_id
        )
        .fetch_optional(&self.pool)
        .await?;
        row.map(EmailDraft::try_from).transpose()
    }

    /// Atomically claims a draft by changing status from Pending to Processing.
    /// Returns None if draft doesn't exist or is already being processed.
    pub async fn claim_email_draft(&self, draft_id: &str) -> anyhow::Result<Option<EmailDraft>> {
        if !storable(draft_id) {
            return Ok(None);
        }
        let row = sqlx::query_as!(
            DraftRow,
            r#"
            UPDATE email_drafts SET status = 'Processing'
            WHERE _id = $1 AND status = 'Pending'
            RETURNING _id, sender_id, sender_email, subject, body,
                attachments AS "attachments: Json<Vec<EmailAttachment>>",
                verification_code, created_at, recipient_count, status AS "status: DraftStatus",
                reply_to
            "#,
            draft_id
        )
        .fetch_optional(&self.pool)
        .await?;
        row.map(EmailDraft::try_from).transpose()
    }

    pub async fn delete_email_draft(&self, draft_id: &str) -> anyhow::Result<()> {
        if !storable(draft_id) {
            return Ok(());
        }
        sqlx::query!("DELETE FROM email_drafts WHERE _id = $1", draft_id)
            .execute(&self.pool)
            .await?;
        Ok(())
    }

    /// In the order the users were created, as MongoDB's unsorted find returned them; the
    /// mail goes out in this order and `failed_emails` keeps it.
    pub async fn get_approved_member_emails(&self) -> anyhow::Result<Vec<String>> {
        Ok(sqlx::query_scalar!(
            r#"
            SELECT m.email FROM members m JOIN users u ON u._id = m.user_id
            WHERE m.status = 'Approved'
            ORDER BY u.seq
            "#
        )
        .fetch_all(&self.pool)
        .await?)
    }

    pub async fn count_approved_members(&self) -> anyhow::Result<u32> {
        let count = sqlx::query_scalar!(
            r#"SELECT count(*) AS "count!" FROM members WHERE status = 'Approved'"#
        )
        .fetch_one(&self.pool)
        .await?;
        Ok(count as u32)
    }

    pub async fn insert_sent_email_log(&self, log: &SentEmailLog) -> anyhow::Result<()> {
        sqlx::query!(
            r#"
            INSERT INTO sent_email_logs (_id, sender_id, sender_email, subject, body,
                                         attachment_names, sent_at, successful_count,
                                         failed_count, failed_emails, reply_to)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
            "#,
            log._id,
            log.sender_id,
            log.sender_email,
            log.subject,
            log.body,
            &log.attachment_names,
            log.sent_at,
            count_column(log.successful_count, "successful_count")?,
            count_column(log.failed_count, "failed_count")?,
            &log.failed_emails,
            log.reply_to,
        )
        .execute(&self.pool)
        .await?;
        Ok(())
    }
}

/// `count` distinct meeting ids that no stored meeting uses yet.
async fn unused_meeting_ids(
    tx: &mut sqlx::Transaction<'_, Postgres>,
    count: usize,
) -> Result<Vec<String>, CreateMeetingsError> {
    let mut taken = HashSet::new();
    // Collisions in a 64^5 id space are rare, so this almost always runs once.
    loop {
        let ids = fresh_ids(count, &taken, || generate_id(5));
        let existing = sqlx::query_scalar!("SELECT _id FROM meetings WHERE _id = ANY($1)", &ids)
            .fetch_all(&mut **tx)
            .await
            .map_err(|e| CreateMeetingsError::IdLookup(Box::new(e)))?;
        if existing.is_empty() {
            return Ok(ids);
        }
        taken.extend(existing);
    }
}

fn storable_ids(ids: &[String]) -> Vec<&str> {
    ids.iter()
        .map(String::as_str)
        .filter(|id| storable(id))
        .collect()
}

/// Of the groups a document is to be in, those that exist, in the order sent and as often as
/// sent (MongoDB stored `group_ids` as it came). The handler checked that they exist; a group
/// deleted since is simply gone.
///
/// The groups are locked against deletion (`FOR KEY SHARE`, in id order) before any
/// membership row is touched. A `delete_document_group` running at the same time locks its
/// group first and the memberships after it (its cascade), so the two never wait for each
/// other in a circle: either the delete waits for this transaction, or it committed first and
/// its group is not returned here. Without the lock the membership insert could pass a check
/// against a group whose deletion was not committed yet and then fail its foreign key, or
/// deadlock with the cascade.
async fn lock_groups(
    tx: &mut sqlx::Transaction<'_, Postgres>,
    group_ids: &[String],
) -> Result<Vec<String>, sqlx::Error> {
    if group_ids.is_empty() {
        return Ok(Vec::new());
    }
    let existing: HashSet<String> = sqlx::query_scalar!(
        "SELECT _id FROM document_groups WHERE _id = ANY($1) ORDER BY _id FOR KEY SHARE",
        &storable_ids(group_ids) as &[&str],
    )
    .fetch_all(&mut **tx)
    .await?
    .into_iter()
    .collect();
    Ok(group_ids
        .iter()
        .filter(|id| existing.contains(*id))
        .cloned()
        .collect())
}

/// Stores the memberships of a document that has none, in this order.
async fn insert_group_members(
    tx: &mut sqlx::Transaction<'_, Postgres>,
    document_id: &str,
    group_ids: &[String],
) -> Result<(), sqlx::Error> {
    if group_ids.is_empty() {
        return Ok(());
    }
    sqlx::query!(
        r#"
        INSERT INTO document_group_members (document_id, group_id, position)
        SELECT $1, wanted.group_id, wanted.position - 1
        FROM unnest($2::text[]) WITH ORDINALITY AS wanted(group_id, position)
        "#,
        document_id,
        group_ids,
    )
    .execute(&mut **tx)
    .await?;
    Ok(())
}

/// The database as seen by the document rooms.
pub struct PgDocumentStore(pub std::sync::Arc<DB>);

impl DocumentStore for PgDocumentStore {
    fn load_state(
        &self,
        document_id: String,
    ) -> BoxFuture<'static, anyhow::Result<Option<LoadedState>>> {
        let db = self.0.clone();
        Box::pin(async move {
            if !storable(&document_id) {
                return Ok(None);
            }
            let stored = sqlx::query!(
                "SELECT state, state_version FROM documents WHERE _id = $1 AND deleted_at IS NULL",
                document_id
            )
            .fetch_optional(&db.pool)
            .await?;
            Ok(stored.map(|stored| LoadedState {
                state: stored.state,
                state_version: stored.state_version,
            }))
        })
    }

    fn save_state(
        &self,
        document_id: String,
        saved: SavedState,
    ) -> BoxFuture<'static, anyhow::Result<SaveOutcome>> {
        let db = self.0.clone();
        Box::pin(async move {
            if !storable(&document_id) {
                return Ok(SaveOutcome::Gone);
            }
            let now = chrono::offset::Utc::now().timestamp_millis();
            // The state goes in byte for byte, U+0000 included; the derived text without it
            // (`storable_text`), else every save of such a text would fail.
            let content = storable_text(&saved.content);
            // Optimistic: only the version the room loaded or saved last can be overwritten.
            let result = sqlx::query!(
                r#"
                UPDATE documents
                SET state = $3, content = $4, title = $5, updated_at = $6,
                    state_version = state_version + 1
                WHERE _id = $1 AND deleted_at IS NULL AND state_version = $2
                "#,
                document_id,
                saved.state_version,
                saved.state,
                content.as_ref(),
                saved.title,
                now,
            )
            .execute(&db.pool)
            .await?;
            Ok(if result.rows_affected() == 1 {
                SaveOutcome::Saved {
                    state_version: saved.state_version + 1,
                }
            } else {
                SaveOutcome::Gone
            })
        })
    }

    fn add_version(
        &self,
        document_id: String,
        version: NewVersion,
    ) -> BoxFuture<'static, anyhow::Result<()>> {
        let db = self.0.clone();
        Box::pin(async move {
            // Compared and stored as `documents.content` holds it.
            let content = storable_text(&version.content);
            let mut tx = db.pool.begin().await?;
            let newest = sqlx::query!(
                r#"
                SELECT content, saved_at FROM document_versions
                WHERE document_id = $1
                ORDER BY saved_at DESC, _id DESC
                LIMIT 1
                "#,
                document_id
            )
            .fetch_optional(&mut *tx)
            .await?;
            let now = chrono::offset::Utc::now().timestamp_millis();
            if newest.is_some_and(|newest| {
                newest.content == content || now - newest.saved_at < MIN_MS_BETWEEN_VERSIONS
            }) {
                return Ok(());
            }
            sqlx::query!(
                r#"
                INSERT INTO document_versions (_id, document_id, content, editors, saved_at)
                VALUES ($1, $2, $3, $4, $5)
                "#,
                generate_id(12),
                document_id,
                content.as_ref(),
                &version.editors,
                now,
            )
            .execute(&mut *tx)
            .await?;
            // Everything older than the oldest kept version goes.
            sqlx::query!(
                r#"
                DELETE FROM document_versions
                WHERE document_id = $1 AND saved_at < (
                    SELECT saved_at FROM document_versions
                    WHERE document_id = $1
                    ORDER BY saved_at DESC, _id DESC
                    OFFSET $2 LIMIT 1
                )
                "#,
                document_id,
                MAX_DOCUMENT_VERSIONS - 1,
            )
            .execute(&mut *tx)
            .await?;
            tx.commit().await?;
            Ok(())
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn search_terms_are_text_not_patterns() {
        assert_eq!(like_pattern("a_b%c\\d"), "%a\\_b\\%c\\\\d%");
        assert_eq!(like_pattern("Müller"), "%Müller%");
    }

    #[test]
    fn only_member_fields_sort_the_list() {
        assert_eq!(member_sort_column("start_time_ms"), Some("m.start_time_ms"));
        assert_eq!(member_sort_column("end_time_ms"), Some("m.end_time_ms"));
        assert_eq!(member_sort_column("email"), Some("m.email"));
        assert_eq!(member_sort_column("institution"), Some("m.institution"));
        assert_eq!(member_sort_column("name.first_name"), Some("m.name_first"));
        assert_eq!(member_sort_column("name.last_name"), Some("m.name_last"));
        assert_eq!(member_sort_column("_id"), None);
        assert_eq!(member_sort_column("start_time_ms; DROP TABLE users"), None);
    }

    #[test]
    fn text_postgres_cannot_hold_is_found_everywhere_in_a_value() {
        assert!(storable("Größe 🏳️‍🌈\n\t"));
        assert!(!storable("a\u{0}b"));
        assert_eq!(storable_text("a\u{0}b\u{0}"), "ab");
        assert!(matches!(storable_text("ab"), Cow::Borrowed("ab")));

        assert!(storable_value(
            &serde_json::json!({"a": ["b", {"c": 1}], "d": null})
        ));
        assert!(!storable_value(
            &serde_json::json!({"a": ["b", {"c": "\u{0}"}]})
        ));
        assert!(!storable_value(&serde_json::json!({"a\u{0}": 1})));
        assert!(storable_ids(&["a".to_string(), "\u{0}".to_string()]) == ["a"]);
    }
}
