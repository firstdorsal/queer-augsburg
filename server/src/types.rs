use core::fmt;

use serde::{Deserialize, Serialize};
use ts_rs::TS;
use validator::Validate;

#[derive(TS)]
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

#[derive(TS)]
#[ts(export, export_to = "../web/src/apiTypes/")]
#[derive(Deserialize, Debug, Serialize, PartialEq, Clone)]
pub struct ChangedMeeting {
    pub by: String,
    pub at: i64,
}

#[derive(TS)]
#[ts(export, export_to = "../web/src/apiTypes/")]
#[derive(Deserialize, Debug, Serialize, PartialEq, Clone, Copy)]
pub enum MeetingStatus {
    Planned,
    Active,
}

#[derive(TS)]
#[ts(export, export_to = "../web/src/apiTypes/")]
#[derive(Deserialize, Debug, Serialize, PartialEq, Clone)]
pub struct MeetingLocation {
    pub name: String,
    pub lat: f64,
    pub lon: f64,
}

#[derive(TS)]
#[ts(export, export_to = "../web/src/apiTypes/")]
#[derive(Deserialize, Debug, Serialize, PartialEq, Clone)]
pub struct MeetingTags {
    pub freeform: Vec<String>,
    pub common: Vec<CommonMeetingTag>,
    pub queer: Vec<QueerMeetingTag>,
}
#[derive(TS)]
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

#[derive(TS)]
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

#[derive(TS)]
#[ts(export, export_to = "../web/src/apiTypes/")]
#[derive(Deserialize, Debug, Serialize, Eq, PartialEq, Clone)]
pub struct User {
    #[serde(rename = "_id")]
    pub id: String,
    pub member: Option<InternalMember>,
    pub capabilities: Option<Vec<UserCapabilities>>,
}

#[derive(TS)]
#[ts(export, export_to = "../web/src/apiTypes/")]
#[derive(Deserialize, Debug, Serialize, Eq, PartialEq, Clone)]
pub enum UserCapabilities {
    UpdateMeetings,
    GetUsers,
    UpdateMemberStatus,
    CreateMember,
}

#[derive(TS)]
#[ts(export, export_to = "../web/src/apiTypes/")]
#[derive(Validate, Deserialize, Debug, Serialize, Eq, PartialEq, Clone)]
pub struct SubmittedMember {
    #[serde(rename = "type")]
    pub _type: MemberType,
    pub natural_person: bool,
    pub name: Option<Name>,
    #[validate(length(min = 1, max = 100))]
    pub institution: Option<String>,
    #[validate(length(min = 1, max = 20))]
    pub pronouns: Option<String>,
    pub address: Address,
    #[validate(email)]
    pub email: String,
    pub phone: Option<String>,
    #[validate(length(min = 1, max = 500))]
    pub user_notes: Option<String>,
    #[validate(length(min = 1, max = 100))]
    pub reference: Option<String>,
    pub approved_charter: bool,
    pub approved_privacy: bool,
    pub above_18: bool,
}

#[derive(TS)]
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

#[derive(TS)]
#[ts(export, export_to = "../web/src/apiTypes/")]
#[derive(Deserialize, Debug, Serialize, Eq, PartialEq, Clone)]
pub enum MembershipStatus {
    Approved,
    Rejected,
    Pending,
    Left,
    Expelled,
}

#[derive(TS)]
#[ts(export, export_to = "../web/src/apiTypes/")]
#[derive(Validate, Deserialize, Debug, Serialize, Eq, PartialEq, Clone)]
pub struct Name {
    /**
     * Voller Name wie er im Pass oder Personaldokument steht
     */
    #[validate(length(min = 1, max = 100))]
    pub passport: String,
    #[validate(length(min = 1, max = 100))]
    pub first_name: String,
    #[validate(length(min = 1, max = 100))]
    pub last_name: String,
}

// Notifcations
/*
- Mitgliederversammlung
- Laufende Updates zur Organisation o.ä.
- Treffen
*/

#[derive(TS)]
#[ts(export, export_to = "../web/src/apiTypes/")]
#[derive(Deserialize, Debug, Serialize, Eq, PartialEq, Clone, Copy)]
pub enum MemberType {
    Active,
    Supporting,
}

#[derive(TS)]
#[ts(export, export_to = "../web/src/apiTypes/")]
#[derive(Validate, Deserialize, Debug, Serialize, Eq, PartialEq, Clone)]
pub struct Address {
    #[validate(length(min = 1, max = 50))]
    pub street: String,
    #[validate(length(min = 1, max = 10))]
    pub number: String,
    #[validate(length(min = 1, max = 50))]
    pub addition: Option<String>,
    #[validate(length(min = 5, max = 5))]
    pub zip: String,
    #[validate(length(min = 1, max = 50))]
    pub city: String,
    #[validate(length(min = 1, max = 50))]
    pub country: String,
}
#[derive(TS)]
#[ts(export, export_to = "../web/src/apiTypes/")]
#[derive(Deserialize, Debug, Serialize, PartialEq, Clone)]
pub struct UpdateMeetingRequestBody {
    pub meeting: Meeting,
    pub delete: Option<bool>,
}

#[derive(TS)]
#[ts(export, export_to = "../web/src/apiTypes/")]
#[derive(Deserialize, Debug, Serialize, PartialEq, Clone)]
pub struct GetMeetingsResponseBody {
    pub meetings: Vec<Meeting>,
    pub selected_total_count: u32,
}

#[derive(TS)]
#[ts(export, export_to = "../web/src/apiTypes/")]
#[derive(Deserialize, Debug, Serialize, PartialEq, Clone)]
pub struct GetUsersResponseBody {
    pub users: Vec<User>,
    pub total_count: u32,
}

#[derive(TS)]
#[ts(export, export_to = "../web/src/apiTypes/")]
#[derive(Deserialize, Debug, Serialize, Eq, PartialEq, Clone, Copy)]
pub enum MeetingTypeQuery {
    Active,
    Planned,
}

#[derive(TS)]
#[ts(export, export_to = "../web/src/apiTypes/")]
#[derive(Deserialize, Debug, Serialize, PartialEq, Clone)]
pub struct SetOwnMemberDataRequestBody {
    pub member: SubmittedMember,
}

#[derive(TS)]
#[ts(export, export_to = "../web/src/apiTypes/")]
#[derive(Deserialize, Debug, Serialize, PartialEq, Clone)]
pub struct UpdateMemberStatusRequestBody {
    pub user_id: String,
    pub new_status: MembershipStatus,
    pub send_mail: bool,
    pub update_reason: Option<String>,
}
