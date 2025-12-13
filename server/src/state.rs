use crate::db::DB;
use crate::interossea::UserAssertion;
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;

#[derive(Clone)]
pub struct AppState {
    pub db: Arc<DB>,
    pub session_map: Arc<RwLock<HashMap<String, UserAssertion>>>,
}
