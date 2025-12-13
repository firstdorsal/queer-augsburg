pub mod config;
pub mod db;
pub mod extractors;
pub mod interossea;
pub mod macros;
pub mod state;
pub mod types;
pub mod utils;

pub mod methods {
    pub mod admin_create_member;
    pub mod confirm_send_email;
    pub mod create_own_user;
    pub mod get_meetings;
    pub mod get_own_user;
    pub mod get_users;
    pub mod ical;
    pub mod send_email_preview;
    pub mod update_meeting;
    pub mod update_member_status;
    pub mod update_own_member_data;
}
