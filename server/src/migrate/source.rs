//! The rows of the v1 data as the migrator sees them: what a Mongo document holds, with the
//! fields the server never read kept next to the typed struct. The same structs are built
//! from the dump and read back from Postgres, and the canonical hash is taken of them on
//! both sides (`canon.rs`).

use crate::types::{Meeting, SentEmailLog, User};
use serde_json::Value;

/// A `users` document: the typed user plus the fields the server never read (`admin`,
/// `imported_from`), which go to `users.extra`.
#[derive(Debug, Clone, PartialEq)]
pub struct UserRow {
    pub user: User,
    pub extra: Option<Value>,
}

/// An `originalUsers` document as relaxed Extended JSON (`convert::original_user` says what
/// that keeps). The archive has no timestamp of its own: the server set `member.start_time_ms` (`start_time_secs` in old snapshots) in the
/// same request that archived the user, so that is the row's `created_at`.
#[derive(Debug, Clone, PartialEq)]
pub struct OriginalUserRow {
    pub user_id: String,
    pub snapshot: Value,
    pub created_at: i64,
}

#[derive(Debug, Clone, PartialEq)]
pub struct PlaceRow {
    pub _id: String,
    pub name: String,
    pub name_key: String,
    pub lat: f64,
    pub lon: f64,
    pub created_by: Option<String>,
    pub created_at: Option<i64>,
}

#[derive(Debug, Clone, PartialEq)]
pub struct DocumentRow {
    pub _id: String,
    pub title: String,
    pub content: String,
    pub state: Vec<u8>,
    pub state_version: i64,
    pub group_ids: Vec<String>,
    pub created_by: String,
    pub created_at: i64,
    pub updated_at: i64,
    pub deleted_by: Option<String>,
    pub deleted_at: Option<i64>,
}

#[derive(Debug, Clone, PartialEq)]
pub struct GroupRow {
    pub _id: String,
    pub name: String,
    pub name_key: String,
    pub document_order: Vec<String>,
}

#[derive(Debug, Clone, PartialEq)]
pub struct GroupOrderRow {
    pub _id: String,
    pub group_ids: Vec<String>,
}

#[derive(Debug, Clone, PartialEq)]
pub struct VersionRow {
    pub _id: String,
    pub document_id: String,
    pub content: String,
    pub editors: Vec<String>,
    pub saved_at: i64,
}

/// Everything the dump holds, converted. `email_drafts` is counted only.
#[derive(Debug, Default)]
pub struct Converted {
    pub users: Vec<UserRow>,
    pub original_users: Vec<OriginalUserRow>,
    pub places: Vec<PlaceRow>,
    pub meetings: Vec<Meeting>,
    pub sent_email_logs: Vec<SentEmailLog>,
    pub documents: Vec<DocumentRow>,
    pub groups: Vec<GroupRow>,
    pub group_order: Vec<GroupOrderRow>,
    pub versions: Vec<VersionRow>,
}

impl Converted {
    /// The number of `meeting_changes` rows the meetings carry.
    pub fn change_count(&self) -> i64 {
        self.meetings
            .iter()
            .map(|m| m.changed.as_ref().map_or(0, |c| c.len() as i64))
            .sum()
    }

    /// The number of `document_group_members` rows the documents carry.
    pub fn group_member_count(&self) -> i64 {
        self.documents
            .iter()
            .map(|d| d.group_ids.len() as i64)
            .sum()
    }

    pub fn member_count(&self) -> i64 {
        self.users
            .iter()
            .filter(|u| u.user.member.is_some())
            .count() as i64
    }

    pub fn approved_member_count(&self) -> i64 {
        self.users
            .iter()
            .filter(|u| {
                u.user
                    .member
                    .as_ref()
                    .is_some_and(|m| m.status == Some(crate::types::MembershipStatus::Approved))
            })
            .count() as i64
    }

    pub fn live_document_count(&self) -> i64 {
        self.documents
            .iter()
            .filter(|d| d.deleted_at.is_none())
            .count() as i64
    }
}
