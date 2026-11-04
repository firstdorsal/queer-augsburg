use crate::db::DB;
use crate::document_rooms::Rooms;
use crate::interossea::UserAssertion;
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::{RwLock, Semaphore};

#[derive(Clone)]
pub struct AppState {
    pub db: Arc<DB>,
    pub session_map: Arc<RwLock<HashMap<String, UserAssertion>>>,
    /// A search reads all documents, so only a few run at a time.
    pub document_searches: Arc<Semaphore>,
    pub document_rooms: Arc<Rooms>,
}
