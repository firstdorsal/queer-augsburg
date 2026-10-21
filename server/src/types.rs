use core::fmt;

use serde::{Deserialize, Serialize};
use serde_valid::Validate;
use ts_rs::TS;
use utoipa::ToSchema;

#[derive(TS, ToSchema)]
#[ts(export, export_to = "../web/src/apiTypes/")]
#[derive(Deserialize, Debug, Serialize, PartialEq, Clone)]
pub struct Meeting {
    pub _id: String,
    pub title: String,
    pub authority: String,
    pub age_restriction: Vec<u8>,
    pub time: Option<i64>,
    pub location: MeetingLocation,
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
    pub deleted_at: Option<i64>,
}

#[derive(TS, ToSchema)]
#[ts(export, export_to = "../web/src/apiTypes/")]
#[derive(Deserialize, Debug, Serialize, PartialEq, Clone)]
pub struct ChangedMeeting {
    pub by: String,
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
    pub start_time_ms: i64,
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
/// `changed`, `deleted_at`, `attendance`, `rating`, `cancelled`) are deliberately
/// absent so a client cannot set them.
#[derive(TS, ToSchema)]
#[ts(export, export_to = "../web/src/apiTypes/")]
#[derive(Deserialize, Debug, Serialize, PartialEq, Clone)]
#[serde(deny_unknown_fields)]
pub struct NewMeeting {
    pub title: String,
    pub authority: String,
    pub age_restriction: Vec<u8>,
    /// Start time as UTC timestamp in milliseconds.
    // Exported as `number` because the JSON value is a plain number, not a bigint.
    #[ts(type = "number")]
    pub time: i64,
    pub location: MeetingLocation,
    pub description: String,
    pub price: Vec<f32>,
    pub trigger_warning: Option<String>,
    pub accessibility: Option<String>,
    pub tags: MeetingTags,
    pub status: MeetingStatus,
}

impl NewMeeting {
    pub fn into_meeting(self, id: String, created: ChangedMeeting) -> Meeting {
        Meeting {
            _id: id,
            title: self.title,
            authority: self.authority,
            age_restriction: self.age_restriction,
            time: Some(self.time),
            location: self.location,
            description: self.description,
            price: self.price,
            trigger_warning: self.trigger_warning,
            attendance: None,
            rating: None,
            accessibility: self.accessibility,
            tags: self.tags,
            status: self.status,
            changed: Some(vec![created]),
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

/// The created meetings with their server-assigned `_id`, in request order.
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
    /// Timestamp (ms) of the most recent meeting update across all meetings of this type
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn into_meeting_sets_server_owned_fields() {
        let new_meeting = NewMeeting {
            title: "Stammtisch".to_string(),
            authority: "Paul".to_string(),
            age_restriction: vec![18],
            time: 1_793_124_000_000,
            location: MeetingLocation {
                name: "Café Neruda".to_string(),
                lat: 48.37,
                lon: 10.89,
            },
            description: "Beschreibung".to_string(),
            price: vec![5.0],
            trigger_warning: Some("Laut".to_string()),
            accessibility: None,
            tags: MeetingTags {
                freeform: vec!["Tanz".to_string()],
                common: vec![CommonMeetingTag::Meet],
                queer: vec![QueerMeetingTag::Everyone],
            },
            status: MeetingStatus::Planned,
        };
        let created = ChangedMeeting {
            by: "user".to_string(),
            at: 42,
        };

        let meeting = new_meeting
            .clone()
            .into_meeting("abcde".to_string(), created.clone());

        assert_eq!(meeting._id, "abcde");
        assert_eq!(meeting.changed, Some(vec![created]));
        assert_eq!(meeting.time, Some(new_meeting.time));
        assert_eq!(meeting.attendance, None);
        assert_eq!(meeting.rating, None);
        assert_eq!(meeting.cancelled, Some(false));
        assert_eq!(meeting.deleted_at, None);
        assert_eq!(meeting.title, new_meeting.title);
        assert_eq!(meeting.location, new_meeting.location);
        assert_eq!(meeting.tags, new_meeting.tags);
        assert_eq!(meeting.status, MeetingStatus::Planned);
    }

    #[test]
    fn new_meeting_rejects_server_owned_fields() {
        let json = r#"{"title":"A","authority":"","age_restriction":[0],"time":1793124000000,
            "location":{"name":"X","lat":48.0,"lon":10.0},"description":"","price":[0],
            "trigger_warning":null,"accessibility":null,
            "tags":{"freeform":[],"common":[],"queer":[]},"status":"Active","rating":5}"#;
        let err = serde_json::from_str::<NewMeeting>(json).unwrap_err();
        assert!(err.to_string().contains("unknown field `rating`"), "{err}");
    }
}
