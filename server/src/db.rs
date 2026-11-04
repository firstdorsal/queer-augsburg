use crate::document_rooms::{
    initial_state, DocumentStore, LoadedState, NewVersion, SaveOutcome, SavedState,
};
use crate::document_rules::{derive_title, sort_key, ListedDocument, StoredGroup};
use crate::interossea::Auth;
use crate::place_rules::place_name_key;
use crate::types::{
    ChangedMeeting, EmailDraft, InternalMember, Meeting, MeetingTypeQuery, MembershipStatus, Place,
    SentEmailLog, SubmittedMember, User, WikiDocument, WikiDocumentVersion,
};
use crate::utils::{fresh_ids, generate_id};
use anyhow::{bail, Context};
use futures::future::BoxFuture;
use futures::stream::TryStreamExt;
use mongodb::action::Action;
use mongodb::options::{IndexOptions, ReturnDocument};
use mongodb::IndexModel;
use mongodb::{
    bson::{doc, spec::BinarySubtype, Binary, Document},
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

/// Stored form of a `WikiDocument`. `state` is the source of truth for the text; `content` and
/// `title` are derived from it on every save. Lists and searches leave `state` out. `content` is
/// also the portable copy: should the state format ever change, `initial_state(content)` rebuilds
/// a state.
#[derive(Debug, Serialize, Deserialize, Clone)]
struct StoredDocument {
    _id: String,
    title: String,
    content: String,
    state: Binary,
    /// Counts the saves of `state`.
    state_version: i64,
    group_ids: Vec<String>,
    created_by: String,
    created_at: i64,
    updated_at: i64,
    deleted_by: Option<String>,
    deleted_at: Option<i64>,
}

/// The fields of a document a list needs.
#[derive(Debug, Deserialize)]
struct DocumentListEntry {
    _id: String,
    title: String,
    group_ids: Vec<String>,
}

/// The fields a search reads.
#[derive(Debug, Deserialize)]
pub struct SearchableDocument {
    pub _id: String,
    pub title: String,
    pub content: String,
}

/// Stored form of a group. `name_key` enforces unique names (unique index).
#[derive(Debug, Serialize, Deserialize, Clone)]
struct GroupDocument {
    _id: String,
    name: String,
    name_key: String,
    document_order: Vec<String>,
}

/// Versions kept per document.
const MAX_DOCUMENT_VERSIONS: u64 = 50;
/// Opening and closing a room in a loop must not push the good versions out.
const MIN_MS_BETWEEN_VERSIONS: i64 = 60_000;

/// The fields a room loads.
#[derive(Debug, Deserialize)]
struct DocumentState {
    state: Binary,
    state_version: i64,
}

/// `_id` of the one record in `document_group_order`.
const GROUP_ORDER_ID: &str = "main";

#[derive(Debug, Serialize, Deserialize, Clone)]
struct GroupOrderDocument {
    _id: String,
    group_ids: Vec<String>,
}

/// What can go wrong naming a group.
#[derive(Debug, thiserror::Error)]
pub enum GroupNameError {
    #[error("Eine Gruppe mit diesem Namen gibt es schon.")]
    Taken,
    #[error(transparent)]
    Database(#[from] anyhow::Error),
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
            "documents",
            "document_groups",
            "document_group_order",
            "document_versions",
        ];

        for collection in collections {
            let _ = self.db.create_collection(collection).await;
        }

        self.db
            .collection::<PlaceDocument>("places")
            .create_index(
                IndexModel::builder()
                    .keys(doc! { "name_key": 1 })
                    .options(IndexOptions::builder().unique(true).build())
                    .build(),
            )
            .await
            .context("creating the unique index places.name_key (duplicate place names?)")?;
        // For the date ranges of the public meetings overview.
        self.db
            .collection::<Meeting>("meetings")
            .create_index(IndexModel::builder().keys(doc! { "time": 1 }).build())
            .await
            .context("creating the index meetings.time")?;
        self.db
            .collection::<GroupDocument>("document_groups")
            .create_index(
                IndexModel::builder()
                    .keys(doc! { "name_key": 1 })
                    .options(IndexOptions::builder().unique(true).build())
                    .build(),
            )
            .await
            .context("creating the unique index document_groups.name_key")?;
        self.db
            .collection::<WikiDocumentVersion>("document_versions")
            .create_index(
                IndexModel::builder()
                    .keys(doc! { "document_id": 1, "saved_at": -1 })
                    .build(),
            )
            .await
            .context("creating the index document_versions.document_id")?;
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
        Ok(self
            .db
            .collection::<Meeting>("meetings")
            .find(published_between_filter(from, until))
            .sort(doc! { "time": 1, "_id": 1 })
            .limit(limit)
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
                .find(filter)
                .sort(doc! { "time": -1 })
                .await?
                .try_collect::<Vec<_>>()
                .await?,
            collection.count_documents(count_filter).await?,
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
        match collection.find_one(doc! { "_id": &meeting._id }).await? {
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
                    .replace_one(doc! { "_id": &meeting._id }, meeting)
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

                collection.insert_one(meeting).await?;
            }
        };

        Ok(())
    }

    pub async fn get_meeting(&self, meeting_id: &str) -> anyhow::Result<Option<Meeting>> {
        let collection = self.db.collection::<Meeting>("meetings");
        Ok(collection.find_one(doc! { "_id": meeting_id }).await?)
    }

    /// All live documents and groups, for `document_rules::arrange_documents`.
    pub async fn get_document_list(
        &self,
    ) -> anyhow::Result<(Vec<StoredGroup>, Vec<String>, Vec<ListedDocument>)> {
        let groups: Vec<GroupDocument> = self
            .db
            .collection("document_groups")
            .find(doc! {})
            .await?
            .try_collect()
            .await?;
        let group_order = self
            .db
            .collection::<GroupOrderDocument>("document_group_order")
            .find_one(doc! { "_id": GROUP_ORDER_ID })
            .await?
            .map_or(Vec::new(), |order| order.group_ids);
        // `deleted_at: null` also matches documents without the field.
        let documents: Vec<DocumentListEntry> = self
            .db
            .collection("documents")
            .find(doc! { "deleted_at": null })
            .projection(doc! { "title": 1, "group_ids": 1 })
            .await?
            .try_collect()
            .await?;
        Ok((
            groups
                .into_iter()
                .map(|group| StoredGroup {
                    _id: group._id,
                    name: group.name,
                    document_order: group.document_order,
                })
                .collect(),
            group_order,
            documents
                .into_iter()
                .map(|document| ListedDocument {
                    _id: document._id,
                    title: document.title,
                    group_ids: document.group_ids,
                })
                .collect(),
        ))
    }

    pub async fn get_document(&self, document_id: &str) -> anyhow::Result<Option<WikiDocument>> {
        Ok(self
            .db
            .collection::<WikiDocument>("documents")
            .find_one(doc! { "_id": document_id, "deleted_at": null })
            .projection(doc! { "title": 1, "content": 1, "group_ids": 1 })
            .await?)
    }

    /// Every live document, without its state, one at a time.
    pub async fn searchable_documents(
        &self,
    ) -> anyhow::Result<mongodb::Cursor<SearchableDocument>> {
        Ok(self
            .db
            .collection::<SearchableDocument>("documents")
            .find(doc! { "deleted_at": null })
            .projection(doc! { "title": 1, "content": 1 })
            .await?)
    }

    /// Whether all these groups exist.
    pub async fn document_groups_exist(&self, group_ids: &[String]) -> anyhow::Result<bool> {
        let unique: HashSet<&String> = group_ids.iter().collect();
        let found = self
            .db
            .collection::<GroupDocument>("document_groups")
            .count_documents(doc! { "_id": { "$in": group_ids } })
            .await?;
        Ok(found as usize == unique.len())
    }

    pub async fn create_document(
        &self,
        text: &str,
        group_ids: Vec<String>,
        created_by: &str,
    ) -> anyhow::Result<WikiDocument> {
        let now = chrono::offset::Utc::now().timestamp_millis();
        let document = StoredDocument {
            _id: generate_id(10),
            title: derive_title(text),
            content: text.to_string(),
            state: Binary {
                subtype: BinarySubtype::Generic,
                bytes: initial_state(text),
            },
            state_version: 1,
            group_ids,
            created_by: created_by.to_string(),
            created_at: now,
            updated_at: now,
            deleted_by: None,
            deleted_at: None,
        };
        self.db
            .collection::<StoredDocument>("documents")
            .insert_one(&document)
            .await?;
        Ok(WikiDocument {
            _id: document._id,
            title: document.title,
            content: document.content,
            group_ids: document.group_ids,
            editing: false,
        })
    }

    /// Newest first.
    pub async fn get_document_versions(
        &self,
        document_id: &str,
    ) -> anyhow::Result<Vec<WikiDocumentVersion>> {
        Ok(self
            .db
            .collection::<WikiDocumentVersion>("document_versions")
            .find(doc! { "document_id": document_id })
            .sort(doc! { "saved_at": -1, "_id": -1 })
            .limit(MAX_DOCUMENT_VERSIONS as i64)
            .await?
            .try_collect()
            .await?)
    }

    /// Returns whether there was such a document.
    pub async fn set_document_groups(
        &self,
        document_id: &str,
        group_ids: &[String],
    ) -> anyhow::Result<bool> {
        let result = self
            .db
            .collection::<StoredDocument>("documents")
            .update_one(
                doc! { "_id": document_id, "deleted_at": null },
                doc! { "$set": { "group_ids": group_ids } },
            )
            .await?;
        Ok(result.matched_count == 1)
    }

    /// Returns whether there was such a document. It stays in the database, like meetings.
    pub async fn delete_document(&self, document_id: &str, user_id: &str) -> anyhow::Result<bool> {
        let now = chrono::offset::Utc::now().timestamp_millis();
        let result = self
            .db
            .collection::<StoredDocument>("documents")
            .update_one(
                doc! { "_id": document_id, "deleted_at": null },
                doc! { "$set": { "deleted_by": user_id, "deleted_at": now } },
            )
            .await?;
        Ok(result.matched_count == 1)
    }

    pub async fn create_document_group(&self, name: &str) -> Result<(), GroupNameError> {
        let group = GroupDocument {
            _id: generate_id(10),
            name: name.to_string(),
            name_key: sort_key(name),
            document_order: Vec::new(),
        };
        let collection = self.db.collection::<GroupDocument>("document_groups");
        match collection.insert_one(&group).await {
            Ok(_) => Ok(()),
            Err(e) if is_duplicate_key(&e) => Err(GroupNameError::Taken),
            Err(e) => Err(anyhow::Error::from(e).into()),
        }
    }

    /// Returns whether there was such a group.
    pub async fn rename_document_group(
        &self,
        group_id: &str,
        name: &str,
    ) -> Result<bool, GroupNameError> {
        let collection = self.db.collection::<GroupDocument>("document_groups");
        let update = doc! { "$set": { "name": name, "name_key": sort_key(name) } };
        match collection.update_one(doc! { "_id": group_id }, update).await {
            Ok(result) => Ok(result.matched_count == 1),
            Err(e) if is_duplicate_key(&e) => Err(GroupNameError::Taken),
            Err(e) => Err(anyhow::Error::from(e).into()),
        }
    }

    /// Removes a group; its documents stay. Returns whether there was such a group.
    pub async fn delete_document_group(&self, group_id: &str) -> anyhow::Result<bool> {
        self.db
            .collection::<StoredDocument>("documents")
            .update_many(
                doc! { "group_ids": group_id },
                doc! { "$pull": { "group_ids": group_id } },
            )
            .await?;
        let result = self
            .db
            .collection::<GroupDocument>("document_groups")
            .delete_one(doc! { "_id": group_id })
            .await?;
        Ok(result.deleted_count == 1)
    }

    pub async fn set_document_group_order(&self, group_ids: &[String]) -> anyhow::Result<()> {
        self.db
            .collection::<GroupOrderDocument>("document_group_order")
            .update_one(
                doc! { "_id": GROUP_ORDER_ID },
                doc! { "$set": { "group_ids": group_ids } },
            )
            .upsert(true)
            .await?;
        Ok(())
    }

    /// Returns whether there was such a group.
    pub async fn set_group_document_order(
        &self,
        group_id: &str,
        document_ids: &[String],
    ) -> anyhow::Result<bool> {
        let result = self
            .db
            .collection::<GroupDocument>("document_groups")
            .update_one(
                doc! { "_id": group_id },
                doc! { "$set": { "document_order": document_ids } },
            )
            .await?;
        Ok(result.matched_count == 1)
    }

    pub async fn get_places(&self) -> anyhow::Result<Vec<Place>> {
        let collection = self.db.collection::<PlaceDocument>("places");
        let documents: Vec<PlaceDocument> = collection
            .find(doc! {})
            .sort(doc! { "name_key": 1 })
            .await?
            .try_collect()
            .await?;
        Ok(documents.into_iter().map(Place::from).collect())
    }

    pub async fn get_place(&self, place_id: &str) -> anyhow::Result<Option<Place>> {
        let collection = self.db.collection::<PlaceDocument>("places");
        Ok(collection
            .find_one(doc! { "_id": place_id })
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
        match collection.insert_one(&document).await {
            Ok(_) => Ok((document.into(), true)),
            // The unique index on name_key: the place exists (or was created concurrently).
            Err(e) if is_duplicate_key(&e) => {
                let existing = collection
                    .find_one(doc! { "name_key": &document.name_key })
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

        if let Err(insert) = collection.insert_many(&meetings).await {
            return match collection
                .delete_many(doc! { "_id": { "$in": &ids } })
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
                .distinct("_id", doc! { "_id": { "$in": &ids } })
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
        collection.insert_many(meetings).await?;

        Ok(())
    }

    pub async fn create_user(&self, user_id: &str) -> anyhow::Result<()> {
        let collection = self.db.collection::<User>("users");
        let user = collection.find_one(doc! { "_id": user_id }).await?;

        if user.is_none() {
            let new_user = User {
                id: user_id.to_string(),
                member: None,
                capabilities: Some(vec![]),
            };

            collection.insert_one(&new_user).await?;
        }
        Ok(())
    }

    pub async fn get_user(&self, user_id: &str) -> anyhow::Result<Option<User>> {
        let collection = self.db.collection::<User>("users");
        Ok(collection.find_one(doc! { "_id": user_id }).await?)
    }

    pub async fn update_member_data(
        &self,
        user_id: &str,
        submitted_member: SubmittedMember,
    ) -> anyhow::Result<bool> {
        let users = self.db.collection::<User>("users");
        let original_users = self.db.collection::<User>("originalUsers");
        let user = users.find_one(doc! { "_id": user_id }).await?;
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
                        original_users.insert_one(user.clone()).await?;
                        first_time = true;
                    }
                }

                users.replace_one(doc! { "_id": user_id }, &user).await?;
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
                .find(selector.clone())
                .optional(limit, |find, limit| find.limit(limit))
                .skip(from_index)
                .sort(doc! { sort_field: sort_direction })
                .await?
                .try_collect::<Vec<_>>()
                .await?,
            collection.count_documents(selector).await?,
        );

        Ok((users, count as u32))
    }

    pub async fn update_member_status(
        &self,
        user_id: &str,
        new_status: &MembershipStatus,
    ) -> anyhow::Result<()> {
        let users = self.db.collection::<User>("users");
        let user = users.find_one(doc! { "_id": user_id }).await?;

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
        collection.insert_one(draft).await?;
        Ok(())
    }

    pub async fn get_email_draft(&self, draft_id: &str) -> anyhow::Result<Option<EmailDraft>> {
        let collection = self.db.collection::<EmailDraft>("email_drafts");
        Ok(collection.find_one(doc! { "_id": draft_id }).await?)
    }

    /// Atomically claims a draft by changing status from Pending to Processing.
    /// Returns None if draft doesn't exist or is already being processed.
    pub async fn claim_email_draft(&self, draft_id: &str) -> anyhow::Result<Option<EmailDraft>> {
        let collection = self.db.collection::<EmailDraft>("email_drafts");
        let result = collection
            .find_one_and_update(
                doc! {
                    "_id": draft_id,
                    "status": "Pending"
                },
                doc! {
                    "$set": { "status": "Processing" }
                },
            )
            .return_document(ReturnDocument::After)
            .await?;

        Ok(result)
    }

    pub async fn delete_email_draft(&self, draft_id: &str) -> anyhow::Result<()> {
        let collection = self.db.collection::<EmailDraft>("email_drafts");
        collection.delete_one(doc! { "_id": draft_id }).await?;
        Ok(())
    }

    pub async fn get_approved_member_emails(&self) -> anyhow::Result<Vec<String>> {
        let collection = self.db.collection::<User>("users");
        let filter = doc! {
            "member": { "$exists": true, "$ne": null },
            "member.status": "Approved"
        };

        let users: Vec<User> = collection.find(filter).await?.try_collect().await?;

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
        let count = collection.count_documents(filter).await?;
        Ok(count as u32)
    }

    pub async fn insert_sent_email_log(&self, log: &SentEmailLog) -> anyhow::Result<()> {
        let collection = self.db.collection::<SentEmailLog>("sent_email_logs");
        collection.insert_one(log).await?;
        Ok(())
    }
}

/// The database as seen by the document rooms.
pub struct MongoDocumentStore(pub std::sync::Arc<DB>);

impl DocumentStore for MongoDocumentStore {
    fn load_state(
        &self,
        document_id: String,
    ) -> BoxFuture<'static, anyhow::Result<Option<LoadedState>>> {
        let db = self.0.clone();
        Box::pin(async move {
            let stored = db
                .db
                .collection::<DocumentState>("documents")
                .find_one(doc! { "_id": document_id, "deleted_at": null })
                .projection(doc! { "state": 1, "state_version": 1 })
                .await?;
            Ok(stored.map(|stored| LoadedState {
                state: stored.state.bytes,
                state_version: stored.state_version,
            }))
        })
    }

    fn save_state(
        &self,
        document_id: String,
        saved: SavedState,
    ) -> BoxFuture<'static, anyhow::Result<SaveOutcome>> {
        let db = self.0.clone();
        Box::pin(async move {
            let now = chrono::offset::Utc::now().timestamp_millis();
            let state = Binary {
                subtype: BinarySubtype::Generic,
                bytes: saved.state,
            };
            let result = db
                .db
                .collection::<StoredDocument>("documents")
                .update_one(
                    doc! {
                        "_id": document_id,
                        "deleted_at": null,
                        "state_version": saved.state_version,
                    },
                    doc! {
                        "$set": {
                            "state": state,
                            "content": saved.content,
                            "title": saved.title,
                            "updated_at": now,
                        },
                        "$inc": { "state_version": 1_i64 },
                    },
                )
                .await?;
            Ok(if result.matched_count == 1 {
                SaveOutcome::Saved {
                    state_version: saved.state_version + 1,
                }
            } else {
                SaveOutcome::Gone
            })
        })
    }

    fn add_version(
        &self,
        document_id: String,
        version: NewVersion,
    ) -> BoxFuture<'static, anyhow::Result<()>> {
        let db = self.0.clone();
        Box::pin(async move {
            let collection = db.db.collection::<Document>("document_versions");
            let newest = collection
                .find_one(doc! { "document_id": &document_id })
                .sort(doc! { "saved_at": -1, "_id": -1 })
                .await?;
            let now = chrono::offset::Utc::now().timestamp_millis();
            if newest.is_some_and(|newest| {
                newest.get_str("content") == Ok(&version.content)
                    || newest
                        .get_i64("saved_at")
                        .is_ok_and(|saved_at| now - saved_at < MIN_MS_BETWEEN_VERSIONS)
            }) {
                return Ok(());
            }
            collection
                .insert_one(doc! {
                    "_id": generate_id(12),
                    "document_id": &document_id,
                    "content": version.content,
                    "editors": version.editors,
                    "saved_at": now,
                })
                .await?;

            let oldest_kept = collection
                .find_one(doc! { "document_id": &document_id })
                .sort(doc! { "saved_at": -1, "_id": -1 })
                .skip(MAX_DOCUMENT_VERSIONS - 1)
                .await?;
            if let Some(oldest_kept) = oldest_kept {
                let saved_at = oldest_kept.get_i64("saved_at")?;
                collection
                    .delete_many(doc! {
                        "document_id": &document_id,
                        "saved_at": { "$lt": saved_at },
                    })
                    .await?;
            }
            Ok(())
        })
    }
}
