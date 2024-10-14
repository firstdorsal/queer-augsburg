use crate::types::{
    InternalMember, Meeting, MeetingTypeQuery, MembershipStatus, SubmittedMember, User,
};
use crate::utils::generate_id;
use anyhow::bail;
use futures::stream::TryStreamExt;
use mongodb::options::FindOptions;
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
        let collections = vec!["users", "meetings", "originalUsers"];

        for collection in collections {
            let _ = self.db.create_collection(collection, None).await;
        }
        Ok(())
    }

    pub async fn get_meetings(
        &self,

        meeting_type: MeetingTypeQuery,
    ) -> anyhow::Result<(Vec<Meeting>, u32)> {
        let collection = self.db.collection::<Meeting>("meetings");
        let find_options = FindOptions::builder().sort(doc! {"time": -1}).build();

        let filter = match meeting_type {
            MeetingTypeQuery::Planned => {
                doc! {
                    "status": "Planned"
                }
            }
            MeetingTypeQuery::Active => {
                doc! {
                    "status": "Active"
                }
            }
        };

        let (meetings, count) = (
            collection
                .find(filter.clone(), find_options)
                .await?
                .try_collect::<Vec<_>>()
                .await?,
            collection.count_documents(filter, None).await?,
        );

        Ok((meetings, count as u32))
    }

    pub async fn delete_meeting(&self, meeting_id: &str) -> anyhow::Result<()> {
        let collection = self.db.collection::<Meeting>("meetings");
        collection
            .delete_one(doc! { "_id": meeting_id }, None)
            .await?;
        Ok(())
    }

    pub async fn update_meeting(&self, meeting: &Meeting) -> anyhow::Result<()> {
        let collection = self.db.collection::<Meeting>("meetings");

        // check if meeting exists
        match collection
            .find_one(doc! { "_id": &meeting._id }, None)
            .await?
        {
            Some(_) => {
                collection
                    .replace_one(doc! { "_id": &meeting._id }, meeting, None)
                    .await?;
            }
            None => {
                //change the _id to a random one
                let mut meeting = meeting.clone();
                meeting._id = generate_id(5);

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

    pub async fn create_user(&self, user_id: &str, is_admin: bool) -> anyhow::Result<()> {
        let collection = self.db.collection::<User>("users");
        let user = collection.find_one(doc! { "_id": user_id }, None).await?;

        if user.is_none() {
            let new_user = User {
                id: user_id.to_string(),
                member: None,
                admin: is_admin,
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
    ) -> anyhow::Result<(Vec<User>, u32)> {
        let collection = self.db.collection::<User>("users");
        let find_options = FindOptions::builder()
            .limit(limit)
            .skip(from_index)
            .sort(doc! {"start_time_secs": -1})
            .build();

        // member exists and is not null
        let selector = doc! {
            "member": {
                "$exists": true,
                "$ne": null
            }
        };

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
}
