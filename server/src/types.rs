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
    pub price: Vec<u32>,
    pub trigger_warning: Option<String>,
    pub attendance: Option<u16>,
    pub rating: Option<f32>,
    pub tags: MeetingTags,
    pub status: MeetingStatus,
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
}

#[derive(TS)]
#[ts(export, export_to = "../web/src/apiTypes/")]
#[derive(Deserialize, Debug, Serialize, Eq, PartialEq, Clone)]
pub struct User {
    #[serde(rename = "_id")]
    pub id: String,
    pub member: Option<InternalMember>,
    pub admin: bool,
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
    #[validate(phone)]
    pub phone: Option<String>,
    #[validate(length(min = 1, max = 500))]
    pub user_notes: Option<String>,
    #[validate(length(min = 1, max = 20))]
    pub reference: Option<String>,
    pub approved_charter: bool,
    pub approved_privacy: bool,
    pub above_18: bool,
    pub linked_accounts: LinkedAccounts,
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
    pub start_time_secs: i64,
    pub end_time_secs: Option<i64>,
    pub approved: bool,
    pub user_notes: Option<String>,
    pub admin_notes: Option<String>,
    pub reference: Option<String>,
    pub approved_charter: bool,
    pub approved_privacy: bool,
    pub above_18: bool,
    pub linked_accounts: LinkedAccounts,
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

#[derive(TS)]
#[ts(export, export_to = "../web/src/apiTypes/")]
#[derive(Validate, Deserialize, Debug, Serialize, Eq, PartialEq, Clone)]
pub struct LinkedAccounts {
    #[validate(url, length(min = 1, max = 100))]
    pub website: Option<String>,
    #[validate(length(min = 1, max = 100))]
    pub instagram: Option<String>,
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
    #[validate(length(min = 1, max = 5))]
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
    pub meeting: Option<Meeting>,
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
#[derive(Deserialize, Debug, Serialize, Eq, PartialEq, Clone, Copy)]
pub enum MeetingTypeQuery {
    Past,
    Future,
    Planned,
    All,
}

#[derive(TS)]
#[ts(export, export_to = "../web/src/apiTypes/")]
#[derive(Deserialize, Debug, Serialize, PartialEq, Clone)]
pub struct SetOwnMemberDataRequestBody {
    pub member: SubmittedMember,
}
