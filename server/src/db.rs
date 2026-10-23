use crate::interossea::Auth;
use crate::place_rules::place_name_key;
use crate::types::{
    ChangedMeeting, EmailDraft, InternalMember, Meeting, MeetingTypeQuery, MembershipStatus, Place,
    SentEmailLog, SubmittedMember, User,
};
use crate::utils::{fresh_ids, generate_id};
use anyhow::{bail, Context};
use futures::stream::TryStreamExt;
use mongodb::options::{FindOneAndUpdateOptions, FindOptions, IndexOptions, ReturnDocument};
use mongodb::IndexModel;
use mongodb::{
    bson::{doc, Document},
    options::ClientOptions,
    Client, Database,
};
use serde::{Deserialize, Serialize};
use std::collections::HashSet;

/// Filter of `DB::get_published_meetings_between`: never planned or deleted meetings, as
/// the overview is public.
pub fn published_between_filter(from: i64, until: i64) -> Document {
    // `deleted_at: null` also matches documents without the field.
    doc! {
        "status": "Active",
        "deleted_at": null,
        "time": { "$gte": from, "$lt": until },
    }
}

/// Stored form of a place; `name_key` enforces unique names (unique index).
#[derive(Debug, Serialize, Deserialize, Clone)]
struct PlaceDocument {
    _id: String,
    name: String,
    name_key: String,
    lat: f64,
    lon: f64,
    created: Option<PlaceCreated>,
}

/// Who created a place and when (ms). The migration uses `MIGRATED_BY` from migrate.js.
#[derive(Debug, Serialize, Deserialize, Clone)]
struct PlaceCreated {
    by: String,
    at: i64,
}

impl From<PlaceDocument> for Place {
    fn from(document: PlaceDocument) -> Self {
        Place {
            _id: document._id,
            name: document.name,
            lat: document.lat,
            lon: document.lon,
        }
    }
}

fn is_duplicate_key(error: &mongodb::error::Error) -> bool {
    matches!(
        error.kind.as_ref(),
        mongodb::error::ErrorKind::Write(mongodb::error::WriteFailure::WriteError(write_error))
            if write_error.code == 11000
    )
}

#[derive(Debug, thiserror::Error)]
pub enum CreateMeetingsError {
    #[error("looking up existing meeting ids failed: {0}")]
    IdLookup(#[source] Box<mongodb::error::Error>),
    #[error("inserting meetings failed and was rolled back: {0}")]
    RolledBack(#[source] Box<mongodb::error::Error>),
    #[error("inserting meetings failed ({insert}) and the rollback failed too ({rollback})")]
    RollbackFailed {
        insert: Box<mongodb::error::Error>,
        rollback: Box<mongodb::error::Error>,
    },
}

pub struct DB {
    pub client: Client,
    pub db: Database,
}

impl DB {
    pub async fn new(client_options: ClientOptions) -> anyhow::Result<Self> {
        let client = Client::with_options(client_options)?;
        let db = client.database("queer-augsburg");
        Ok(Self { client, db })
    }
    pub async fn create_collections(&self) -> anyhow::Result<()> {
        let collections = vec![
            "users",
            "meetings",
            "originalUsers",
            "email_drafts",
            "sent_email_logs",
            "places",
        ];

        for collection in collections {
            let _ = self.db.create_collection(collection, None).await;
        }

        self.db
            .collection::<PlaceDocument>("places")
            .create_index(
                IndexModel::builder()
                    .keys(doc! { "name_key": 1 })
                    .options(IndexOptions::builder().unique(true).build())
                    .build(),
                None,
            )
            .await
            .context("creating the unique index places.name_key (duplicate place names?)")?;
        // For the date ranges of the public meetings overview.
        self.db
            .collection::<Meeting>("meetings")
            .create_index(IndexModel::builder().keys(doc! { "time": 1 }).build(), None)
            .await
            .context("creating the index meetings.time")?;
        Ok(())
    }

    /// Published meetings starting in `[from, until)` (ms), earliest first (ties by id),
    /// at most `limit`.
    pub async fn get_published_meetings_between(
        &self,
        from: i64,
        until: i64,
        limit: i64,
    ) -> anyhow::Result<Vec<Meeting>> {
        let find_options = FindOptions::builder()
            .sort(doc! { "time": 1, "_id": 1 })
            .limit(limit)
            .build();
        Ok(self
            .db
            .collection::<Meeting>("meetings")
            .find(published_between_filter(from, until), find_options)
            .await?
            .try_collect()
            .await?)
    }

    /// Get meetings by type.
    /// - `since`: If provided, returns only meetings updated/deleted since this timestamp (for delta sync)
    /// - `include_deleted`: If true, includes soft-deleted meetings in results
    /// - `starting_from`: If provided (and `since` is not), only meetings starting at or after
    ///   this timestamp; the count then counts only those
    pub async fn get_meetings(
        &self,
        meeting_type: MeetingTypeQuery,
        since: Option<i64>,
        include_deleted: bool,
        starting_from: Option<i64>,
    ) -> anyhow::Result<(Vec<Meeting>, u32)> {
        let collection = self.db.collection::<Meeting>("meetings");
        let find_options = FindOptions::builder().sort(doc! {"time": -1}).build();

        let status_str = match meeting_type {
            MeetingTypeQuery::Planned => "Planned",
            MeetingTypeQuery::Active => "Active",
        };

        // Build the filter
        // Note: In MongoDB, { "field": null } matches documents where field is null OR doesn't exist
        let mut filter = if let Some(since_ts) = since {
            // Delta sync: return meetings changed or deleted since timestamp
            // This includes soft-deleted meetings so clients can remove them from cache
            doc! {
                "status": status_str,
                "$or": [
                    { "changed": { "$elemMatch": { "at": { "$gt": since_ts } } } },
                    { "deleted_at": { "$gt": since_ts } }
                ]
            }
        } else if include_deleted {
            // Include all meetings (including deleted)
            doc! {
                "status": status_str
            }
        } else {
            // Normal query: exclude deleted meetings
            // { "deleted_at": null } matches both null values AND missing fields
            doc! {
                "status": status_str,
                "deleted_at": null
            }
        };

        // For count, we always count non-deleted meetings only
        let mut count_filter = doc! {
            "status": status_str,
            "deleted_at": null
        };
        if let (Some(from), None) = (starting_from, since) {
            filter.insert("time", doc! { "$gte": from });
            count_filter.insert("time", doc! { "$gte": from });
        }

        let (meetings, count) = (
            collection
                .find(filter, find_options)
                .await?
                .try_collect::<Vec<_>>()
                .await?,
            collection.count_documents(count_filter, None).await?,
        );

        Ok((meetings, count as u32))
    }

    /// Soft-delete a meeting by setting deleted_at timestamp and recording who deleted it
    pub async fn delete_meeting(&self, meeting_id: &str, auth: &Auth) -> anyhow::Result<()> {
        let collection = self.db.collection::<Meeting>("meetings");
        let now = chrono::Utc::now().timestamp_millis();
        let deleted_by = auth
            .authenticated_user
            .clone()
            .unwrap_or_else(|| "unknown".to_string());

        // Add change record and set deleted_at in one operation
        let result = collection
            .update_one(
                doc! { "_id": meeting_id },
                doc! {
                    "$set": { "deleted_at": now },
                    "$push": {
                        "changed": {
                            "at": now,
                            "by": deleted_by
                        }
                    }
                },
                None,
            )
            .await?;

        if result.matched_count == 0 {
            bail!("Meeting not found");
        }
        Ok(())
    }

    pub async fn update_meeting(&self, meeting: &mut Meeting, auth: &Auth) -> anyhow::Result<()> {
        let collection = self.db.collection::<Meeting>("meetings");

        // check if meeting exists
        match collection
            .find_one(doc! { "_id": &meeting._id }, None)
            .await?
        {
            Some(mut db_meeting) => {
                match db_meeting.changed {
                    Some(ref mut changes) => {
                        changes.push(ChangedMeeting {
                            at: chrono::Utc::now().timestamp_millis(),
                            by: auth.authenticated_user.clone().unwrap(),
                        });
                        meeting.changed = Some(changes.clone());
                    }
                    None => {
                        meeting.changed = Some(vec![ChangedMeeting {
                            at: chrono::Utc::now().timestamp_millis(),
                            by: auth.authenticated_user.clone().unwrap(),
                        }]);
                    }
                }
                collection
                    .replace_one(doc! { "_id": &meeting._id }, meeting, None)
                    .await?;
            }
            None => {
                //change the _id to a random one
                let mut meeting = meeting.clone();
                meeting._id = generate_id(5);
                meeting.changed = Some(vec![ChangedMeeting {
                    at: chrono::Utc::now().timestamp_millis(),
                    by: auth.authenticated_user.clone().unwrap(),
                }]);

                collection.insert_one(meeting, None).await?;
            }
        };

        Ok(())
    }

    pub async fn get_meeting(&self, meeting_id: &str) -> anyhow::Result<Option<Meeting>> {
        let collection = self.db.collection::<Meeting>("meetings");
        Ok(collection
            .find_one(doc! { "_id": meeting_id }, None)
            .await?)
    }

    pub async fn get_places(&self) -> anyhow::Result<Vec<Place>> {
        let collection = self.db.collection::<PlaceDocument>("places");
        let options = FindOptions::builder().sort(doc! { "name_key": 1 }).build();
        let documents: Vec<PlaceDocument> =
            collection.find(None, options).await?.try_collect().await?;
        Ok(documents.into_iter().map(Place::from).collect())
    }

    pub async fn get_place(&self, place_id: &str) -> anyhow::Result<Option<Place>> {
        let collection = self.db.collection::<PlaceDocument>("places");
        Ok(collection
            .find_one(doc! { "_id": place_id }, None)
            .await?
            .map(Place::from))
    }

    /// Creates a place unless one with the same normalized name exists; that one is
    /// returned instead (`created == false`). `name` must already be validated.
    pub async fn create_place(
        &self,
        name: String,
        lat: f64,
        lon: f64,
        created_by: &str,
    ) -> anyhow::Result<(Place, bool)> {
        let collection = self.db.collection::<PlaceDocument>("places");
        let document = PlaceDocument {
            _id: generate_id(5),
            name_key: place_name_key(&name),
            name,
            lat,
            lon,
            created: Some(PlaceCreated {
                by: created_by.to_string(),
                at: chrono::Utc::now().timestamp_millis(),
            }),
        };
        match collection.insert_one(&document, None).await {
            Ok(_) => Ok((document.into(), true)),
            // The unique index on name_key: the place exists (or was created concurrently).
            Err(e) if is_duplicate_key(&e) => {
                let existing = collection
                    .find_one(doc! { "name_key": &document.name_key }, None)
                    .await?
                    .ok_or_else(|| anyhow::anyhow!("duplicate place key vanished: {e}"))?;
                Ok((existing.into(), false))
            }
            Err(e) => Err(e.into()),
        }
    }

    /// Inserts new meetings with server-assigned ids and change history. Callers must
    /// validate the meetings and resolve their place first (see `meeting_validation`
    /// and `place_rules::finish_venue`).
    ///
    /// The insert is compensated by deleting the ids of this batch again if it fails.
    pub async fn create_meetings(
        &self,
        mut meetings: Vec<Meeting>,
        created_by: &str,
    ) -> Result<Vec<Meeting>, CreateMeetingsError> {
        let collection = self.db.collection::<Meeting>("meetings");
        let ids = self.unused_meeting_ids(meetings.len()).await?;
        let created = ChangedMeeting {
            by: created_by.to_string(),
            at: chrono::Utc::now().timestamp_millis(),
        };
        for (meeting, id) in meetings.iter_mut().zip(ids.iter()) {
            meeting._id = id.clone();
            meeting.changed = Some(vec![created.clone()]);
        }

        if let Err(insert) = collection.insert_many(&meetings, None).await {
            return match collection
                .delete_many(doc! { "_id": { "$in": &ids } }, None)
                .await
            {
                Ok(_) => Err(CreateMeetingsError::RolledBack(Box::new(insert))),
                Err(rollback) => Err(CreateMeetingsError::RollbackFailed {
                    insert: Box::new(insert),
                    rollback: Box::new(rollback),
                }),
            };
        }

        Ok(meetings)
    }

    /// `count` distinct meeting ids that no stored meeting uses yet.
    async fn unused_meeting_ids(&self, count: usize) -> Result<Vec<String>, CreateMeetingsError> {
        let collection = self.db.collection::<Meeting>("meetings");
        let mut taken = HashSet::new();
        // Collisions in a 64^5 id space are rare, so this almost always runs once.
        loop {
            let ids = fresh_ids(count, &taken, || generate_id(5));
            let existing = collection
                .distinct("_id", doc! { "_id": { "$in": &ids } }, None)
                .await
                .map_err(|e| CreateMeetingsError::IdLookup(Box::new(e)))?;
            if existing.is_empty() {
                return Ok(ids);
            }
            taken.extend(
                existing
                    .into_iter()
                    .filter_map(|id| id.as_str().map(str::to_string)),
            );
        }
    }

    pub async fn insert_old_meetings(&self, meetings: Vec<Meeting>) -> anyhow::Result<()> {
        let collection = self.db.collection::<Meeting>("meetings");
        collection.insert_many(meetings, None).await?;

        Ok(())
    }

    pub async fn create_user(&self, user_id: &str) -> anyhow::Result<()> {
        let collection = self.db.collection::<User>("users");
        let user = collection.find_one(doc! { "_id": user_id }, None).await?;

        if user.is_none() {
            let new_user = User {
                id: user_id.to_string(),
                member: None,
                capabilities: Some(vec![]),
            };

            collection.insert_one(&new_user, None).await?;
        }
        Ok(())
    }

    pub async fn get_user(&self, user_id: &str) -> anyhow::Result<Option<User>> {
        let collection = self.db.collection::<User>("users");
        Ok(collection.find_one(doc! { "_id": user_id }, None).await?)
    }

    pub async fn update_member_data(
        &self,
        user_id: &str,
        submitted_member: SubmittedMember,
    ) -> anyhow::Result<bool> {
        let users = self.db.collection::<User>("users");
        let original_users = self.db.collection::<User>("originalUsers");
        let user = users.find_one(doc! { "_id": user_id }, None).await?;
        let mut first_time = false;

        match user {
            Some(mut user) => {
                let present_member = user.member.clone();

                let updated_member = InternalMember {
                    _type: submitted_member._type,
                    name: submitted_member.name,
                    institution: submitted_member.institution,
                    email: submitted_member.email,
                    phone: submitted_member.phone,
                    address: submitted_member.address,
                    above_18: submitted_member.above_18,
                    approved_charter: submitted_member.approved_charter,
                    approved_privacy: submitted_member.approved_privacy,
                    natural_person: submitted_member.natural_person,
                    admin_notes: present_member.as_ref().and_then(|m| m.admin_notes.clone()),
                    reference: submitted_member.reference,
                    end_time_ms: present_member.as_ref().and_then(|m| m.end_time_ms),

                    honorary: present_member.as_ref().map_or(false, |m| m.honorary),
                    pronouns: submitted_member.pronouns,
                    start_time_ms: present_member.as_ref().map_or_else(
                        || chrono::Utc::now().timestamp() * 1000,
                        |m| m.start_time_ms,
                    ),
                    status: present_member
                        .as_ref()
                        .map_or(Some(MembershipStatus::Pending), |m| m.status.clone()),
                    user_notes: submitted_member.user_notes,
                };

                match user.member {
                    Some(_) => {
                        user.member = Some(updated_member);
                    }
                    None => {
                        user.member = Some(updated_member);
                        original_users.insert_one(user.clone(), None).await?;
                        first_time = true;
                    }
                }

                users
                    .replace_one(doc! { "_id": user_id }, &user, None)
                    .await?;
            }
            None => {
                bail!("User not found")
            }
        }

        Ok(first_time)
    }

    pub async fn get_users(
        &self,
        limit: Option<i64>,
        from_index: u64,
        search: Option<String>,
        sort_by: Option<String>,
        sort_order: Option<String>,
    ) -> anyhow::Result<(Vec<User>, u32)> {
        let collection = self.db.collection::<User>("users");

        // Build sort document
        let sort_field = sort_by.as_deref().unwrap_or("start_time_ms");
        let sort_field = format!("member.{}", sort_field);
        let sort_direction = match sort_order.as_deref() {
            Some("asc") => 1,
            _ => -1, // default to descending
        };

        let find_options = FindOptions::builder()
            .limit(limit)
            .skip(from_index)
            .sort(doc! { sort_field: sort_direction })
            .build();

        // Build base selector - member exists and is not null
        let mut selector = doc! {
            "member": {
                "$exists": true,
                "$ne": null
            }
        };

        // Add search functionality if search term is provided
        if let Some(search_term) = search {
            if !search_term.trim().is_empty() {
                let search_regex = doc! {
                    "$regex": search_term,
                    "$options": "i" // case insensitive
                };

                selector.insert(
                    "$or",
                    vec![
                        doc! { "member.name.first_name": search_regex.clone() },
                        doc! { "member.name.last_name": search_regex.clone() },
                        doc! { "member.email": search_regex.clone() },
                        doc! { "member.institution": search_regex },
                    ],
                );
            }
        }

        let (users, count) = (
            collection
                .find(selector.clone(), find_options)
                .await?
                .try_collect::<Vec<_>>()
                .await?,
            collection.count_documents(selector, None).await?,
        );

        Ok((users, count as u32))
    }

    pub async fn update_member_status(
        &self,
        user_id: &str,
        new_status: &MembershipStatus,
    ) -> anyhow::Result<()> {
        let users = self.db.collection::<User>("users");
        let user = users.find_one(doc! { "_id": user_id }, None).await?;

        let new_status_string = match new_status {
            MembershipStatus::Approved => "Approved",
            MembershipStatus::Rejected => "Rejected",
            MembershipStatus::Pending => "Pending",
            MembershipStatus::Left => "Left",
            MembershipStatus::Expelled => "Expelled",
        };

        match user {
            Some(user) => {
                //set the approved field to true
                match user.member {
                    Some(_) => {
                        users
                            .update_one(
                                doc! { "_id": user_id },
                                doc! { "$set": { "member.status": new_status_string } },
                                None,
                            )
                            .await?;
                    }
                    None => {
                        bail!("User has no member data")
                    }
                }
            }
            None => {
                bail!("User not found")
            }
        }

        Ok(())
    }

    // Email draft methods
    pub async fn insert_email_draft(&self, draft: &EmailDraft) -> anyhow::Result<()> {
        let collection = self.db.collection::<EmailDraft>("email_drafts");
        collection.insert_one(draft, None).await?;
        Ok(())
    }

    pub async fn get_email_draft(&self, draft_id: &str) -> anyhow::Result<Option<EmailDraft>> {
        let collection = self.db.collection::<EmailDraft>("email_drafts");
        Ok(collection.find_one(doc! { "_id": draft_id }, None).await?)
    }

    /// Atomically claims a draft by changing status from Pending to Processing.
    /// Returns None if draft doesn't exist or is already being processed.
    pub async fn claim_email_draft(&self, draft_id: &str) -> anyhow::Result<Option<EmailDraft>> {
        let collection = self.db.collection::<EmailDraft>("email_drafts");
        let options = FindOneAndUpdateOptions::builder()
            .return_document(ReturnDocument::After)
            .build();

        let result = collection
            .find_one_and_update(
                doc! {
                    "_id": draft_id,
                    "status": "Pending"
                },
                doc! {
                    "$set": { "status": "Processing" }
                },
                options,
            )
            .await?;

        Ok(result)
    }

    pub async fn delete_email_draft(&self, draft_id: &str) -> anyhow::Result<()> {
        let collection = self.db.collection::<EmailDraft>("email_drafts");
        collection.delete_one(doc! { "_id": draft_id }, None).await?;
        Ok(())
    }

    pub async fn get_approved_member_emails(&self) -> anyhow::Result<Vec<String>> {
        let collection = self.db.collection::<User>("users");
        let filter = doc! {
            "member": { "$exists": true, "$ne": null },
            "member.status": "Approved"
        };

        let users: Vec<User> = collection
            .find(filter, None)
            .await?
            .try_collect()
            .await?;

        let emails: Vec<String> = users
            .into_iter()
            .filter_map(|u| u.member.map(|m| m.email))
            .collect();

        Ok(emails)
    }

    pub async fn count_approved_members(&self) -> anyhow::Result<u32> {
        let collection = self.db.collection::<User>("users");
        let filter = doc! {
            "member": { "$exists": true, "$ne": null },
            "member.status": "Approved"
        };
        let count = collection.count_documents(filter, None).await?;
        Ok(count as u32)
    }

    pub async fn insert_sent_email_log(&self, log: &SentEmailLog) -> anyhow::Result<()> {
        let collection = self.db.collection::<SentEmailLog>("sent_email_logs");
        collection.insert_one(log, None).await?;
        Ok(())
    }
}
