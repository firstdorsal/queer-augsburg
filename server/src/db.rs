use crate::types::{InternalMember, Meeting, MeetingTypeQuery, User};
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
        let collections = vec!["users", "meetings"];

        for collection in collections {
            let _ = self.db.create_collection(collection, None).await;
        }
        Ok(())
    }

    pub async fn get_meetings(
        &self,
        limit: Option<i64>,
        from_index: u64,
        meeting_type: MeetingTypeQuery,
    ) -> anyhow::Result<(Vec<Meeting>, u32)> {
        let collection = self.db.collection::<Meeting>("meetings");
        let find_options = FindOptions::builder()
            .limit(limit)
            .skip(from_index)
            .sort(doc! {"time": -1})
            .build();

        let current_time = chrono::Utc::now().timestamp() * 1000;

        let filter = match meeting_type {
            MeetingTypeQuery::Future => {
                doc! {
                    "time": {
                        "$gt": current_time
                    }
                }
            }
            MeetingTypeQuery::Past => {
                doc! {
                    "time": {
                        "$lt": current_time
                    }
                }
            }
            MeetingTypeQuery::Planned => {
                doc! {
                    "status": "Planned"
                }
            }
            MeetingTypeQuery::All => {
                doc! {}
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
            .delete_one(doc! { "id": meeting_id }, None)
            .await?;
        Ok(())
    }

    pub async fn update_meeting(&self, meeting: &Meeting) -> anyhow::Result<()> {
        let collection = self.db.collection::<Meeting>("meetings");

        // check if meeting exists
        match collection
            .find_one(doc! { "id": &meeting._id }, None)
            .await?
        {
            Some(_) => {
                collection
                    .replace_one(doc! { "id": &meeting._id }, meeting, None)
                    .await?;
            }
            None => {
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
        member: InternalMember,
    ) -> anyhow::Result<()> {
        let users = self.db.collection::<User>("users");
        let original_users = self.db.collection::<User>("originalUsers");
        let user = users.find_one(doc! { "_id": user_id }, None).await?;

        match user {
            Some(mut user) => {
                match user.member {
                    Some(_) => {
                        user.member = Some(member);
                    }
                    None => {
                        user.member = Some(member);
                        original_users.insert_one(user.clone(), None).await?;
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

        Ok(())
    }

    pub async fn get_users(
        &self,
        limit: Option<i64>,
        from_index: u64,
    ) -> anyhow::Result<(Vec<User>, u32)> {
        let collection = self.db.collection::<User>("users");
        let find_options = FindOptions::builder().limit(limit).skip(from_index).build();

        let (users, count) = (
            collection
                .find(doc! {}, find_options)
                .await?
                .try_collect::<Vec<_>>()
                .await?,
            collection.count_documents(doc! {}, None).await?,
        );

        Ok((users, count as u32))
    }

    pub async fn accept_member_application(&self, user_id: &str) -> anyhow::Result<()> {
        let users = self.db.collection::<User>("users");
        let user = users.find_one(doc! { "_id": user_id }, None).await?;

        match user {
            Some(user) => {
                //set the approved field to true
                match user.member {
                    Some(_) => {
                        users
                            .update_one(
                                doc! { "_id": user_id },
                                doc! { "$set": { "member.approved": true } },
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
