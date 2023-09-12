use crate::types::Meeting;
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
        let collections = vec!["members", "meetings"];

        for collection in collections {
            let _ = self.db.create_collection(collection, None).await;
        }
        Ok(())
    }

    pub async fn get_meetings(
        &self,
        limit: Option<i64>,
        from_index: u64,
    ) -> anyhow::Result<Vec<Meeting>> {
        let collection = self.db.collection::<Meeting>("meetings");
        let find_options = FindOptions::builder().limit(limit).skip(from_index).build();
        let meetings = collection
            .find(doc! {}, find_options)
            .await?
            .try_collect::<Vec<_>>()
            .await?;

        Ok(meetings)
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

    pub async fn get_all_meetings_count(&self) -> anyhow::Result<u32> {
        let collection = self.db.collection::<Meeting>("meetings");
        let count = collection.count_documents(doc! {}, None).await?;
        Ok(count as u32)
    }
}
