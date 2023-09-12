use serde::{Deserialize, Serialize};
use ts_rs::TS;

#[derive(TS)]
#[ts(export, export_to = "../web/src/apiTypes/")]
#[derive(Deserialize, Debug, Serialize, PartialEq, Clone)]
pub struct Meeting {
    pub _id: String,
    pub title: String,
    pub authority: String,
    pub age_restriction: Vec<u8>,
    pub time: i64,
    pub location: MeetingLocation,
    pub description: String,
    pub price: Vec<u32>,
    pub trigger_warning: Option<String>,
    pub attendance: Option<u16>,
    pub rating: Option<f32>,
    pub tags: MeetingTags,
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
#[derive(Deserialize, Debug, Serialize, PartialEq, Clone)]
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
#[derive(Deserialize, Debug, Serialize, PartialEq, Clone)]
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
pub struct Member {
    pub id: String,
    #[serde(rename = "type")]
    pub _type: MemberType,
    pub legal_person: bool,
    pub first_name: Option<String>,
    pub last_name: Option<String>,
    pub institution: Option<String>,
    pub pronouns: Option<String>,
    pub address: Address,
    pub email: String,
    pub phone: Option<String>,
    pub start_data: i64,
    pub end_date: Option<i64>,
    pub approved: bool,
}
#[derive(TS)]
#[ts(export, export_to = "../web/src/apiTypes/")]
#[derive(Deserialize, Debug, Serialize, Eq, PartialEq, Clone)]
pub enum MemberType {
    Active,
    Supporting,
}
#[derive(TS)]
#[ts(export, export_to = "../web/src/apiTypes/")]
#[derive(Deserialize, Debug, Serialize, Eq, PartialEq, Clone)]
pub struct Address {
    pub street: String,
    pub number: String,
    pub addition: Option<String>,
    pub zip: String,
    pub city: String,
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
    pub all_meetings_count: u32,
}
