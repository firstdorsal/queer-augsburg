use core::fmt;

use serde::{Deserialize, Serialize};
use serde_valid::Validate;
use ts_rs::TS;
use url::Url;
use utoipa::{IntoParams, ToSchema};

// Timestamps are `i64` milliseconds. ts-rs exports `i64` as `bigint`, but serde writes a
// plain JSON number and `JSON.parse` returns a `number`, so every such field carries
// `#[ts(type = "number")]` (or `"number | null"`).

#[derive(TS, ToSchema)]
#[ts(export, export_to = "../web/src/apiTypes/")]
#[derive(Deserialize, Debug, Serialize, PartialEq, Clone)]
pub struct Meeting {
    pub _id: String,
    pub title: String,
    pub authority: String,
    pub age_restriction: Vec<u8>,
    /// Start time as UTC timestamp in milliseconds; `None` for some old imported meetings.
    #[ts(type = "number | null")]
    pub time: Option<i64>,
    /// Copy of the place (`place_id`) for display and the iCal feed; `None` for online
    /// meetings and places to be announced.
    pub location: Option<MeetingLocation>,
    /// The stored place the meeting takes place at (id from `GET /api/places/`); the
    /// server derives `location` from it on save. Meetings imported before places
    /// existed may have only a `location`.
    pub place_id: Option<String>,
    /// Set for online meetings, which have no place.
    pub online: Option<OnlineMeeting>,
    /// The place is not fixed yet ("Ort wird noch bekanntgegeben"): no place, not online.
    /// Missing in meetings stored before it existed.
    #[serde(default)]
    pub place_to_be_announced: bool,
    pub description: String,
    pub price: Vec<f32>,
    pub trigger_warning: Option<String>,
    pub attendance: Option<u16>,
    pub rating: Option<f32>,
    pub accessibility: Option<String>,
    pub tags: MeetingTags,
    pub status: MeetingStatus,
    pub changed: Option<Vec<ChangedMeeting>>,
    pub cancelled: Option<bool>,
    /// Timestamp (ms) when the meeting was soft-deleted. None means not deleted.
    #[ts(type = "number | null")]
    pub deleted_at: Option<i64>,
}

#[derive(TS, ToSchema)]
#[ts(export, export_to = "../web/src/apiTypes/")]
#[derive(Deserialize, Debug, Serialize, PartialEq, Clone)]
pub struct ChangedMeeting {
    pub by: String,
    /// UTC timestamp in milliseconds. The first entry is the creation.
    #[ts(type = "number")]
    pub at: i64,
}

#[derive(TS, ToSchema)]
#[ts(export, export_to = "../web/src/apiTypes/")]
#[derive(Deserialize, Debug, Serialize, PartialEq, Clone, Copy)]
pub enum MeetingStatus {
    Planned,
    Active,
}

#[derive(TS, ToSchema)]
#[ts(export, export_to = "../web/src/apiTypes/")]
#[derive(Deserialize, Debug, Serialize, PartialEq, Clone)]
pub struct MeetingLocation {
    pub name: String,
    pub lat: f64,
    pub lon: f64,
}

#[derive(TS, ToSchema)]
#[ts(export, export_to = "../web/src/apiTypes/")]
#[derive(Deserialize, Debug, Serialize, PartialEq, Clone)]
pub struct OnlineMeeting {
    /// E.g. "Zoom"; may be empty.
    pub platform: String,
    /// Link to join. A members-only link is never sent in meeting lists, save responses or
    /// the iCal feed — not even to members; they fetch it from `GET /api/meeting_link/`.
    pub url: Option<String>,
    /// The link is only shown to verified members (and editors), never publicly.
    pub members_only: bool,
    /// Set by the server when `url` was withheld (never stored). Sending it back with
    /// `url: null` keeps the stored link; `url: ""` removes it.
    #[serde(default)]
    pub url_hidden: bool,
}

/// Online details of a meeting created in bulk: only what the author may set (the
/// hidden-link handshake of `OnlineMeeting` belongs to editing existing meetings).
#[derive(TS, ToSchema)]
#[ts(export, export_to = "../web/src/apiTypes/")]
#[derive(Deserialize, Debug, Serialize, PartialEq, Clone)]
#[serde(deny_unknown_fields)]
pub struct NewOnlineMeeting {
    /// E.g. "Zoom"; may be empty.
    pub platform: String,
    /// Link to join, if known.
    pub url: Option<String>,
    /// The link is only shown to verified members (and editors), never publicly.
    pub members_only: bool,
}

impl From<NewOnlineMeeting> for OnlineMeeting {
    fn from(online: NewOnlineMeeting) -> Self {
        OnlineMeeting {
            platform: online.platform,
            url: online.url,
            members_only: online.members_only,
            url_hidden: false,
        }
    }
}

impl Meeting {
    /// The meeting as it may be sent in lists and the iCal feed: members-only links removed.
    pub fn without_private_link(mut self) -> Self {
        if let Some(online) = &mut self.online {
            if online.members_only && online.url.is_some() {
                online.url = None;
                online.url_hidden = true;
            }
        }
        self
    }

    /// Where the meeting takes place. The stored fields allow combinations the save rules
    /// refuse (`place_rules::finish_venue`); this is the one precedence every reader uses.
    pub fn venue(&self) -> Venue<'_> {
        if self.place_to_be_announced {
            Venue::ToBeAnnounced
        } else if let Some(online) = &self.online {
            Venue::Online(online)
        } else if let Some(location) = &self.location {
            Venue::Place(location)
        } else {
            Venue::Unknown
        }
    }

    /// The meeting's page on the website (`ui_origin` is checked in `config::read_config`).
    pub fn page_url(&self, ui_origin: &Url) -> Url {
        let mut url = ui_origin.clone();
        url.set_path("/");
        url.query_pairs_mut().clear().append_pair("m", &self._id);
        url
    }
}

/// See `Meeting::venue`.
#[derive(Debug, PartialEq)]
pub enum Venue<'a> {
    ToBeAnnounced,
    Online(&'a OnlineMeeting),
    Place(&'a MeetingLocation),
    /// Meetings imported before places and online meetings existed may have neither.
    Unknown,
}

/// A place meetings can take place at.
#[derive(TS, ToSchema)]
#[ts(export, export_to = "../web/src/apiTypes/")]
#[derive(Deserialize, Debug, Serialize, PartialEq, Clone)]
pub struct Place {
    pub _id: String,
    pub name: String,
    pub lat: f64,
    pub lon: f64,
}

impl Place {
    /// The copy stored in `Meeting.location`. Renaming or moving a place later must
    /// rewrite these copies (and push a `changed` entry so delta sync delivers them).
    pub fn as_location(&self) -> MeetingLocation {
        MeetingLocation {
            name: self.name.clone(),
            lat: self.lat,
            lon: self.lon,
        }
    }
}

#[derive(TS, ToSchema)]
#[ts(export, export_to = "../web/src/apiTypes/")]
#[derive(Deserialize, Debug, Serialize, PartialEq, Clone)]
#[serde(deny_unknown_fields)]
pub struct CreatePlaceRequestBody {
    pub name: String,
    pub lat: f64,
    pub lon: f64,
}

#[derive(TS, ToSchema)]
#[ts(export, export_to = "../web/src/apiTypes/")]
#[derive(Deserialize, Debug, Serialize, PartialEq, Clone)]
pub struct CreatePlaceResponseBody {
    pub place: Place,
    /// false: a place with the same name (ignoring case, spacing and apostrophe style)
    /// already existed and is returned instead.
    pub created: bool,
}

#[derive(TS, ToSchema)]
#[ts(export, export_to = "../web/src/apiTypes/")]
#[derive(Deserialize, Debug, Serialize, PartialEq, Clone)]
pub struct GetPlacesResponseBody {
    pub places: Vec<Place>,
}

#[derive(TS, ToSchema)]
#[ts(export, export_to = "../web/src/apiTypes/")]
#[derive(Deserialize, Debug, Serialize, PartialEq, Clone)]
pub struct MeetingLinkResponseBody {
    pub url: Option<String>,
}

#[derive(TS, ToSchema)]
#[ts(export, export_to = "../web/src/apiTypes/")]
#[derive(Deserialize, Debug, Serialize, PartialEq, Clone)]
pub struct MeetingTags {
    pub freeform: Vec<String>,
    pub common: Vec<CommonMeetingTag>,
    pub queer: Vec<QueerMeetingTag>,
}

#[derive(TS, ToSchema)]
#[ts(export, export_to = "../web/src/apiTypes/")]
#[derive(Deserialize, Debug, Serialize, PartialEq, Eq, Hash, Clone, Copy)]
pub enum CommonMeetingTag {
    Kultur,
    Party,
    Orga,
    Sport,
    Education,
    Meet,
    Students,
    Marketing,
    Cinema,
    Talks,
    Open,
    Explores,
    Connect,
    Ostqueer,
    Queermas,
}

impl fmt::Display for CommonMeetingTag {
    fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
        write!(f, "{:?}", self)
    }
}

#[derive(TS, ToSchema)]
#[ts(export, export_to = "../web/src/apiTypes/")]
#[derive(Deserialize, Debug, Serialize, PartialEq, Eq, Hash, Clone, Copy)]
pub enum QueerMeetingTag {
    Everyone,
    Queer,
    Gay,
    Lesbian,
    Trans,
    Bi,
    Asexual,
    Aromantic,
    Inter,
    Poly,
    Pan,
}

#[derive(TS, ToSchema)]
#[ts(export, export_to = "../web/src/apiTypes/")]
#[derive(Deserialize, Debug, Serialize, Eq, PartialEq, Clone)]
pub struct User {
    #[serde(rename = "_id")]
    pub id: String,
    pub member: Option<InternalMember>,
    pub capabilities: Option<Vec<UserCapabilities>>,
}

impl User {
    pub fn has_capability(&self, capability: &UserCapabilities) -> bool {
        self.capabilities
            .as_ref()
            .is_some_and(|capabilities| capabilities.contains(capability))
    }

    /// Verified members (membership approved by the board) and editors may see
    /// members-only links of online meetings.
    pub fn may_see_members_only_links(&self) -> bool {
        self.has_capability(&UserCapabilities::UpdateMeetings)
            || self
                .member
                .as_ref()
                .is_some_and(|member| member.status == Some(MembershipStatus::Approved))
    }
}

#[derive(TS, ToSchema)]
#[ts(export, export_to = "../web/src/apiTypes/")]
#[derive(Deserialize, Debug, Serialize, Eq, PartialEq, Clone)]
pub enum UserCapabilities {
    UpdateMeetings,
    GetUsers,
    UpdateMemberStatus,
    CreateMember,
    SendMassEmail,
}

#[derive(TS, ToSchema, Validate)]
#[ts(export, export_to = "../web/src/apiTypes/")]
#[derive(Deserialize, Debug, Serialize, Eq, PartialEq, Clone)]
pub struct SubmittedMember {
    #[serde(rename = "type")]
    pub _type: MemberType,
    pub natural_person: bool,
    #[validate]
    pub name: Option<Name>,
    #[validate(max_length = 100)]
    pub institution: Option<String>,
    #[validate(max_length = 20)]
    pub pronouns: Option<String>,
    #[validate]
    pub address: Address,
    #[validate(pattern = r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$")]
    pub email: String,
    pub phone: Option<String>,
    #[validate(max_length = 500)]
    pub user_notes: Option<String>,
    #[validate(max_length = 100)]
    pub reference: Option<String>,
    pub approved_charter: bool,
    pub approved_privacy: bool,
    pub above_18: bool,
}

#[derive(TS, ToSchema)]
#[ts(export, export_to = "../web/src/apiTypes/")]
#[derive(Deserialize, Debug, Serialize, Eq, PartialEq, Clone)]
pub struct InternalMember {
    #[serde(rename = "type")]
    pub _type: MemberType,
    pub natural_person: bool,
    pub name: Option<Name>,
    pub institution: Option<String>,
    pub pronouns: Option<String>,
    pub address: Address,
    pub email: String,
    pub phone: Option<String>,
    #[ts(type = "number")]
    pub start_time_ms: i64,
    #[ts(type = "number | null")]
    pub end_time_ms: Option<i64>,
    pub status: Option<MembershipStatus>,
    pub user_notes: Option<String>,
    pub admin_notes: Option<String>,
    pub reference: Option<String>,
    pub approved_charter: bool,
    pub approved_privacy: bool,
    pub above_18: bool,
    pub honorary: bool,
}

#[derive(TS, ToSchema)]
#[ts(export, export_to = "../web/src/apiTypes/")]
#[derive(Deserialize, Debug, Serialize, Eq, PartialEq, Clone)]
pub enum MembershipStatus {
    Approved,
    Rejected,
    Pending,
    Left,
    Expelled,
}

#[derive(TS, ToSchema, Validate)]
#[ts(export, export_to = "../web/src/apiTypes/")]
#[derive(Deserialize, Debug, Serialize, Eq, PartialEq, Clone)]
pub struct Name {
    /// Voller Name wie er im Pass oder Personaldokument steht
    #[validate(min_length = 1)]
    #[validate(max_length = 100)]
    pub passport: String,
    #[validate(min_length = 1)]
    #[validate(max_length = 100)]
    pub first_name: String,
    #[validate(min_length = 1)]
    #[validate(max_length = 100)]
    pub last_name: String,
}

#[derive(TS, ToSchema)]
#[ts(export, export_to = "../web/src/apiTypes/")]
#[derive(Deserialize, Debug, Serialize, Eq, PartialEq, Clone, Copy)]
pub enum MemberType {
    Active,
    Supporting,
}

#[derive(TS, ToSchema, Validate)]
#[ts(export, export_to = "../web/src/apiTypes/")]
#[derive(Deserialize, Debug, Serialize, Eq, PartialEq, Clone)]
pub struct Address {
    #[validate(min_length = 1)]
    #[validate(max_length = 50)]
    pub street: String,
    #[validate(min_length = 1)]
    #[validate(max_length = 10)]
    pub number: String,
    #[validate(max_length = 50)]
    pub addition: Option<String>,
    #[validate(min_length = 5)]
    #[validate(max_length = 5)]
    pub zip: String,
    #[validate(min_length = 1)]
    #[validate(max_length = 50)]
    pub city: String,
    #[validate(min_length = 1)]
    #[validate(max_length = 50)]
    pub country: String,
}

#[derive(TS, ToSchema)]
#[ts(export, export_to = "../web/src/apiTypes/")]
#[derive(Deserialize, Debug, Serialize, PartialEq, Clone)]
pub struct UpdateMeetingRequestBody {
    pub meeting: Meeting,
    pub delete: Option<bool>,
}

/// The author-supplied content of a new meeting. Server-owned fields (`_id`,
/// `changed`, `deleted_at`, `attendance`, `rating`, `cancelled`, `location`, `status`)
/// are deliberately absent, and sending them is rejected, so a client cannot set them.
/// New meetings are always `Planned`: an editor publishes each one by hand.
#[derive(TS, ToSchema)]
#[ts(export, export_to = "../web/src/apiTypes/")]
#[derive(Deserialize, Debug, Serialize, PartialEq, Clone)]
#[serde(deny_unknown_fields)]
pub struct NewMeeting {
    pub title: String,
    pub authority: String,
    pub age_restriction: Vec<u8>,
    /// Start time as UTC timestamp in milliseconds.
    #[ts(type = "number")]
    pub time: i64,
    /// A stored place (the server copies its name and coordinates). Exactly one venue: a
    /// stored place (`place_id`), `online` details or `place_to_be_announced: true`.
    pub place_id: Option<String>,
    pub online: Option<NewOnlineMeeting>,
    /// The place is not fixed yet ("Ort wird noch bekanntgegeben").
    #[serde(default)]
    pub place_to_be_announced: bool,
    pub description: String,
    pub price: Vec<f32>,
    pub trigger_warning: Option<String>,
    pub accessibility: Option<String>,
    pub tags: MeetingTags,
}

impl NewMeeting {
    /// The meeting to store, before `place_rules::finish_venue` resolves its place and the
    /// database assigns `_id` and `changed`.
    pub fn into_meeting(self) -> Meeting {
        Meeting {
            _id: String::new(),
            title: self.title,
            authority: self.authority,
            age_restriction: self.age_restriction,
            time: Some(self.time),
            location: None,
            place_id: self.place_id,
            online: self.online.map(OnlineMeeting::from),
            place_to_be_announced: self.place_to_be_announced,
            description: self.description,
            price: self.price,
            trigger_warning: self.trigger_warning,
            attendance: None,
            rating: None,
            accessibility: self.accessibility,
            tags: self.tags,
            status: MeetingStatus::Planned,
            changed: None,
            cancelled: Some(false),
            deleted_at: None,
        }
    }
}

#[derive(TS, ToSchema)]
#[ts(export, export_to = "../web/src/apiTypes/")]
#[derive(Deserialize, Debug, Serialize, PartialEq, Clone)]
#[serde(deny_unknown_fields)]
pub struct CreateMeetingsRequestBody {
    pub meetings: Vec<NewMeeting>,
}

/// The created meetings with their server-assigned `_id`, in request order. All are
/// `Planned`: not public until an editor sets them to `Active` via `update_meeting`.
#[derive(TS, ToSchema)]
#[ts(export, export_to = "../web/src/apiTypes/")]
#[derive(Deserialize, Debug, Serialize, PartialEq, Clone)]
pub struct CreateMeetingsResponseBody {
    pub meetings: Vec<Meeting>,
}

#[derive(TS, ToSchema)]
#[ts(export, export_to = "../web/src/apiTypes/")]
#[derive(Deserialize, Debug, Serialize, PartialEq, Eq, Clone, Copy)]
pub enum CreateMeetingsErrorCode {
    /// The body is not valid JSON or does not match `CreateMeetingsRequestBody`. Nothing was created.
    InvalidBody,
    /// At least one meeting failed validation (see `index`). Nothing was created.
    InvalidMeeting,
    /// The insert failed and was rolled back. Nothing was created.
    Internal,
    /// The insert failed and rolling it back failed too: some meetings may exist.
    PartiallyCreated,
}

/// Error body of `POST /api/create_meetings/`. `message` is German and meant for the member.
#[derive(TS, ToSchema)]
#[ts(export, export_to = "../web/src/apiTypes/")]
#[derive(Deserialize, Debug, Serialize, PartialEq, Clone)]
pub struct CreateMeetingsErrorBody {
    pub code: CreateMeetingsErrorCode,
    /// Zero-based index of the offending meeting for `InvalidMeeting`.
    pub index: Option<u32>,
    pub message: String,
}

#[derive(TS, ToSchema)]
#[ts(export, export_to = "../web/src/apiTypes/")]
#[derive(Deserialize, Debug, Serialize, PartialEq, Clone)]
pub struct GetMeetingsResponseBody {
    pub meetings: Vec<Meeting>,
    pub selected_total_count: u32,
    /// Latest `changed[].at` or `deleted_at` (ms) of the meetings selected by the query
    /// (all of the type, or those changed since `since`); `None` if there are none.
    #[ts(type = "number | null")]
    pub last_updated: Option<i64>,
}

#[derive(TS, ToSchema)]
#[ts(export, export_to = "../web/src/apiTypes/")]
#[derive(Deserialize, Debug, Serialize, PartialEq, Clone)]
pub struct GetUsersResponseBody {
    pub users: Vec<User>,
    pub total_count: u32,
}

#[derive(TS, ToSchema)]
#[ts(export, export_to = "../web/src/apiTypes/")]
#[derive(Deserialize, Debug, Serialize, Eq, PartialEq, Clone, Copy)]
pub enum MeetingTypeQuery {
    Active,
    Planned,
}

#[derive(TS, ToSchema)]
#[ts(export, export_to = "../web/src/apiTypes/")]
#[derive(Deserialize, Debug, Serialize, PartialEq, Clone)]
pub struct SetOwnMemberDataRequestBody {
    pub member: SubmittedMember,
}

#[derive(TS, ToSchema)]
#[ts(export, export_to = "../web/src/apiTypes/")]
#[derive(Deserialize, Debug, Serialize, PartialEq, Clone)]
pub struct UpdateMemberStatusRequestBody {
    pub user_id: String,
    pub new_status: MembershipStatus,
    pub send_mail: bool,
    pub update_reason: Option<String>,
}

#[derive(TS, ToSchema)]
#[ts(export, export_to = "../web/src/apiTypes/")]
#[derive(Deserialize, Debug, Serialize, PartialEq, Clone)]
pub struct EmailAttachment {
    pub filename: String,
    pub content_type: String,
    /// base64 encoded data
    pub data: String,
}

#[derive(TS, ToSchema)]
#[ts(export, export_to = "../web/src/apiTypes/")]
#[derive(Deserialize, Debug, Serialize, PartialEq, Clone)]
pub struct SendEmailPreviewRequestBody {
    pub subject: String,
    pub body: String,
    pub attachments: Vec<EmailAttachment>,
    pub reply_to: Option<String>,
}

#[derive(TS, ToSchema)]
#[ts(export, export_to = "../web/src/apiTypes/")]
#[derive(Deserialize, Debug, Serialize, PartialEq, Clone)]
pub struct SendEmailPreviewResponseBody {
    pub preview_id: String,
    pub recipient_count: u32,
}

#[derive(TS, ToSchema)]
#[ts(export, export_to = "../web/src/apiTypes/")]
#[derive(Deserialize, Debug, Serialize, PartialEq, Clone)]
pub struct ConfirmSendEmailRequestBody {
    pub preview_id: String,
    pub verification_code: String,
    pub testing_mode: Option<bool>,
}

#[derive(TS, ToSchema)]
#[ts(export, export_to = "../web/src/apiTypes/")]
#[derive(Deserialize, Debug, Serialize, PartialEq, Clone)]
pub struct ConfirmSendEmailResponseBody {
    pub sent_count: u32,
    pub failed_count: u32,
}

#[derive(Deserialize, Debug, Serialize, Clone, PartialEq)]
pub enum DraftStatus {
    Pending,
    Processing,
}

#[derive(Deserialize, Debug, Serialize, Clone)]
pub struct EmailDraft {
    pub _id: String,
    pub sender_id: String,
    pub sender_email: String,
    pub subject: String,
    pub body: String,
    pub attachments: Vec<EmailAttachment>,
    pub verification_code: String,
    pub created_at: i64,
    pub recipient_count: u32,
    pub status: DraftStatus,
    pub reply_to: Option<String>,
}

#[derive(Deserialize, Debug, Serialize, Clone)]
pub struct SentEmailLog {
    pub _id: String,
    pub sender_id: String,
    pub sender_email: String,
    pub subject: String,
    pub body: String,
    pub attachment_names: Vec<String>,
    pub sent_at: i64,
    pub successful_count: u32,
    pub failed_count: u32,
    pub failed_emails: Vec<String>,
    pub reply_to: Option<String>,
}

/// Query parameters for get_meetings endpoint
#[derive(Debug, Deserialize, ToSchema)]
pub struct GetMeetingsQuery {
    /// Meeting type: "Active" or "Planned"
    pub t: String,
    /// Limit number of results
    pub l: Option<i64>,
    /// From index (pagination offset)
    pub i: Option<i64>,
    /// Only return meetings updated/deleted since this timestamp (ms). Used for delta sync.
    pub since: Option<i64>,
    /// Only return meetings starting at or after this timestamp (ms), e.g. the upcoming
    /// ones for the duplicate check of the bulk import. Not combinable with `since`.
    pub from: Option<i64>,
}

/// Query parameters of `GET /api/meetings_overview/`. Dates, unlike the millisecond
/// timestamps of `get_meetings`.
#[derive(Debug, Deserialize, IntoParams)]
#[serde(deny_unknown_fields)]
pub struct MeetingsOverviewQuery {
    /// First day (YYYY-MM-DD, Berlin time); default today.
    pub from: Option<String>,
    /// Last day (YYYY-MM-DD, Berlin time, inclusive); default: no end.
    pub to: Option<String>,
}

/// Published meetings for AI assistants and other tools (`GET /api/meetings_overview/`).
/// Fields are only ever added, never renamed or retyped: tools outside this repository
/// read them.
#[derive(TS, ToSchema)]
#[ts(export, export_to = "../web/src/apiTypes/")]
#[derive(Serialize, Debug)]
pub struct MeetingsOverview {
    /// Always "Europe/Berlin": the zone of `start` and of the `from`/`to` days.
    pub time_zone: String,
    /// Sorted by start; at most 500, the earliest ones.
    pub meetings: Vec<MeetingSummary>,
    /// More meetings are in the range than were returned: ask again with a shorter one.
    pub truncated: bool,
}

/// One published meeting in `MeetingsOverview`: no description and no links to online
/// meetings. Exactly one of `place`, `online` and `place_to_be_announced` is set, unless
/// an old meeting has no venue at all.
#[derive(TS, ToSchema)]
#[ts(export, export_to = "../web/src/apiTypes/")]
#[derive(Serialize, Debug, PartialEq)]
pub struct MeetingSummary {
    pub id: String,
    /// Start in Berlin time, e.g. "2026-10-27T19:00".
    pub start: String,
    pub title: String,
    /// Name of the place; null for online meetings, places to be announced and old
    /// meetings without a place.
    pub place: Option<String>,
    /// An online meeting; its link is not part of the overview.
    pub online: bool,
    /// Platform of an online meeting, e.g. "Zoom"; null if not online or unknown.
    pub platform: Option<String>,
    pub place_to_be_announced: bool,
    pub cancelled: bool,
    /// The meeting's page on the website.
    pub url: String,
}

/// Query parameters for get_users endpoint
#[derive(Debug, Deserialize, ToSchema)]
pub struct GetUsersQuery {
    /// Limit number of results
    pub l: Option<i64>,
    /// From index (pagination offset)
    pub i: Option<i64>,
    /// Search term
    pub s: Option<String>,
    /// Sort by field
    pub sb: Option<String>,
    /// Sort order ("asc" or "desc")
    pub so: Option<String>,
}

/// A meeting as stored before places, online meetings and "to be announced" existed (no
/// `place_id`, `online` or `place_to_be_announced` in the document) and without a
/// location. Tests set what they need.
#[cfg(test)]
pub(crate) fn stored_test_meeting() -> Meeting {
    serde_json::from_value(serde_json::json!({
        "_id": "abcde", "title": "A", "authority": "", "age_restriction": [0],
        "time": 1_793_124_000_000_i64, "location": null,
        "description": "", "price": [0.0], "trigger_warning": null, "attendance": null,
        "rating": null, "accessibility": null,
        "tags": {"freeform": [], "common": [], "queer": []}, "status": "Active",
        "changed": null, "cancelled": false, "deleted_at": null
    }))
    .unwrap()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn stored_meetings_without_the_new_field_are_saved_with_it() {
        let meeting = stored_test_meeting();
        assert!(!meeting.place_to_be_announced);
        let saved = serde_json::to_value(&meeting).unwrap();
        assert_eq!(saved["place_to_be_announced"], serde_json::json!(false));
    }

    #[test]
    fn meeting_page_urls_are_built_from_the_origin() {
        let mut meeting = stored_test_meeting();
        meeting._id = "a b&c".to_string();
        for origin in ["https://queer-augsburg.de", "https://queer-augsburg.de/"] {
            assert_eq!(
                meeting.page_url(&Url::parse(origin).unwrap()).as_str(),
                "https://queer-augsburg.de/?m=a+b%26c"
            );
        }
    }

    #[test]
    fn into_meeting_sets_server_owned_fields() {
        let new_meeting = NewMeeting {
            title: "Stammtisch".to_string(),
            authority: "Paul".to_string(),
            age_restriction: vec![18],
            time: 1_793_124_000_000,
            place_id: Some("p1".to_string()),
            online: None,
            place_to_be_announced: false,
            description: "Beschreibung".to_string(),
            price: vec![5.0],
            trigger_warning: Some("Laut".to_string()),
            accessibility: None,
            tags: MeetingTags {
                freeform: vec!["Tanz".to_string()],
                common: vec![CommonMeetingTag::Meet],
                queer: vec![QueerMeetingTag::Everyone],
            },
        };

        let meeting = new_meeting.clone().into_meeting();

        assert_eq!(meeting._id, "");
        assert_eq!(meeting.changed, None);
        assert_eq!(meeting.time, Some(new_meeting.time));
        assert_eq!(meeting.attendance, None);
        assert_eq!(meeting.rating, None);
        assert_eq!(meeting.cancelled, Some(false));
        assert_eq!(meeting.deleted_at, None);
        assert_eq!(meeting.title, new_meeting.title);
        assert_eq!(
            meeting.location, None,
            "the server copies it from the place"
        );
        assert_eq!(meeting.place_id.as_deref(), Some("p1"));
        assert_eq!(meeting.tags, new_meeting.tags);
        assert_eq!(meeting.status, MeetingStatus::Planned);
    }

    #[test]
    fn new_meeting_rejects_server_owned_fields() {
        let json = r#"{"title":"A","authority":"","age_restriction":[0],"time":1793124000000,
            "place_id":"p1","online":null,"description":"","price":[0],
            "trigger_warning":null,"accessibility":null,
            "tags":{"freeform":[],"common":[],"queer":[]},"rating":5}"#;
        let err = serde_json::from_str::<NewMeeting>(json).unwrap_err();
        assert!(err.to_string().contains("unknown field `rating`"), "{err}");
        let with_status = json.replace(r#""rating":5"#, r#""status":"Active""#);
        let err = serde_json::from_str::<NewMeeting>(&with_status).unwrap_err();
        assert!(err.to_string().contains("unknown field `status`"), "{err}");
        // Coordinates never come from the client.
        let with_location = json.replace(r#","rating":5"#, "").replace(
            r#""place_id":"p1""#,
            r#""location":{"name":"X","lat":1,"lon":1}"#,
        );
        let err = serde_json::from_str::<NewMeeting>(&with_location).unwrap_err();
        assert!(
            err.to_string().contains("unknown field `location`"),
            "{err}"
        );
        // The hidden-link handshake is for editing stored meetings only.
        let with_hidden_link = json.replace(r#","rating":5"#, "").replace(
            r#""online":null"#,
            r#""online":{"platform":"Zoom","url":null,"members_only":true,"url_hidden":true}"#,
        );
        let err = serde_json::from_str::<NewMeeting>(&with_hidden_link).unwrap_err();
        assert!(
            err.to_string().contains("unknown field `url_hidden`"),
            "{err}"
        );
    }
}
