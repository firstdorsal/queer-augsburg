pub mod capped_allocator;
pub mod config;
pub mod db;
pub mod document_rooms;
pub mod document_rules;
pub mod document_search;
pub mod extractors;
pub mod interossea;
pub mod macros;
pub mod meeting_validation;
pub mod place_rules;
pub mod state;
pub mod types;
pub mod utils;

pub mod methods {
    pub mod admin_create_member;
    pub mod confirm_send_email;
    pub mod create_meetings;
    pub mod create_own_user;
    pub mod document_groups;
    pub mod document_sync;
    pub mod documents;
    pub mod get_meeting_link;
    pub mod get_meetings;
    pub mod get_own_user;
    pub mod get_users;
    pub mod ical;
    pub mod meetings_overview;
    pub mod places;
    pub mod send_email_preview;
    pub mod update_meeting;
    pub mod update_member_status;
    pub mod update_own_member_data;
}
