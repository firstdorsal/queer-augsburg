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
#[derive(Deserialize, Debug, Serialize, PartialEq, Clone, Copy)]
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
#[derive(Deserialize, Debug, Serialize, PartialEq, Clone, Copy)]
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

#[derive(TS, ToSchema)]
#[ts(export, export_to = "../web/src/apiTypes/")]
#[derive(Deserialize, Debug, Serialize, PartialEq, Clone)]
pub struct GetMeetingsResponseBody {
    pub meetings: Vec<Meeting>,
    pub selected_total_count: u32,
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
