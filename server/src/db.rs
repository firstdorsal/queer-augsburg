use crate::interossea::Auth;
use crate::types::{
    ChangedMeeting, EmailDraft, InternalMember, Meeting, MeetingTypeQuery, MembershipStatus,
    SentEmailLog, SubmittedMember, User,
};
use crate::utils::generate_id;
use anyhow::bail;
use futures::stream::TryStreamExt;
use mongodb::options::{FindOneAndUpdateOptions, FindOptions, ReturnDocument};
use mongodb::{bson::doc, options::ClientOptions, Client, Database};

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
        ];

        for collection in collections {
            let _ = self.db.create_collection(collection, None).await;
        }
        Ok(())
    }

    /// Get meetings by type.
    /// - `since`: If provided, returns only meetings updated/deleted since this timestamp (for delta sync)
    /// - `include_deleted`: If true, includes soft-deleted meetings in results
    pub async fn get_meetings(
        &self,
        meeting_type: MeetingTypeQuery,
        since: Option<i64>,
        include_deleted: bool,
    ) -> anyhow::Result<(Vec<Meeting>, u32)> {
        let collection = self.db.collection::<Meeting>("meetings");
        let find_options = FindOptions::builder().sort(doc! {"time": -1}).build();

        let status_str = match meeting_type {
            MeetingTypeQuery::Planned => "Planned",
            MeetingTypeQuery::Active => "Active",
        };

        // Build the filter
        // Note: In MongoDB, { "field": null } matches documents where field is null OR doesn't exist
        let filter = if let Some(since_ts) = since {
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
        let count_filter = doc! {
            "status": status_str,
            "deleted_at": null
        };

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
