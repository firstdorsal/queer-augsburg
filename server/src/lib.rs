// The server's only unsafe code is the allocator, plus one `ioctl` statement in
// tests/document_search_load.rs. The `unsafe_code` lint is denied in this crate outside
// `capped_allocator` and forbidden in main.rs, the binaries and the other test crates, but
// rustc does not report it inside the expansion of a macro from another crate: an `unsafe`
// block in a `#[macro_export]` macro of this crate, expanded only in main.rs or a test, passes
// the deny and every forbid. tests/no_unsafe.rs reads the source of the package and fails on an
// `unsafe` token outside those two places (the allocator only as reviewed, token for token),
// and on the ways it knows to bring in code it does not read. Its header lists those, and what
// it cannot see: code that dependencies generate, safe code that writes the process's memory
// through /proc/self/mem, and what the build environment adds.
#![deny(unsafe_code)]

#[allow(unsafe_code)]
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
// The MongoDB → Postgres migrator and the dump anonymizer (research-postgres §4); only in
// the `migrate-from-mongo` and `anonymize-dump` binaries.
#[cfg(feature = "mongo-source")]
pub mod migrate;
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
