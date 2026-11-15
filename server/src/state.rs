use crate::db::{PgDocumentStore, DB};
use crate::document_rooms::Rooms;
use crate::interossea::UserAssertion;
use crate::methods::documents::CONCURRENT_SEARCHES;
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::{AcquireError, RwLock, Semaphore, SemaphorePermit};

/// The state the server runs with, built by [`AppState::new`] only. The search slots are a
/// private field, so code outside this module cannot write an `AppState { … }`, not even a
/// struct update that replaces one public field of `AppState::new`'s result:
///
/// ```compile_fail
/// # use std::sync::Arc;
/// # use backend::state::AppState;
/// # fn build(db: Arc<backend::db::DB>) -> AppState {
/// AppState {
///     db: db.clone(),
///     ..AppState::new(db)
/// }
/// # }
/// ```
///
/// The same function without the struct update compiles, so it is the update that is refused:
///
/// ```no_run
/// # use std::sync::Arc;
/// # use backend::state::AppState;
/// # fn build(db: Arc<backend::db::DB>) -> AppState {
/// AppState::new(db)
/// # }
/// ```
#[derive(Clone)]
pub struct AppState {
    pub db: Arc<DB>,
    pub session_map: Arc<RwLock<HashMap<String, UserAssertion>>>,
    document_searches: Arc<SearchSlots>,
    pub document_rooms: Arc<Rooms>,
}

impl AppState {
    /// The state the server runs with. `main` and the tests build it here only, so a test
    /// runs with the search slots and rooms the server has. The one place that sets the
    /// number of search slots. The cap is per value: every call makes `CONCURRENT_SEARCHES`
    /// slots of its own, so it holds because `main` calls this once and serves every request
    /// with clones of that one state (which share its slots).
    pub fn new(db: Arc<DB>) -> Self {
        Self {
            document_rooms: Rooms::new(Arc::new(PgDocumentStore(db.clone()))),
            db,
            session_map: Arc::default(),
            document_searches: Arc::new(SearchSlots(Semaphore::new(CONCURRENT_SEARCHES))),
        }
    }

    pub fn document_searches(&self) -> &SearchSlots {
        &self.document_searches
    }
}

/// A search reads all documents, so only `CONCURRENT_SEARCHES` run at a time. Outside
/// [`AppState::new`] slots can only be taken (dropping a [`SearchSlot`] gives it back) and
/// counted; none can be added or closed, and none forgotten through the permit, as the
/// semaphore itself would allow. `std::mem::forget` on a `SearchSlot`, which safe code may
/// call, keeps its slot taken for good: that lowers the cap, it never raises it.
pub struct SearchSlots(Semaphore);

/// Taken search slots, free again when this is dropped.
pub struct SearchSlot<'a> {
    _permit: SemaphorePermit<'a>,
}

impl SearchSlots {
    pub async fn acquire(&self) -> Result<SearchSlot<'_>, AcquireError> {
        let permit = self.0.acquire().await?;
        Ok(SearchSlot { _permit: permit })
    }

    /// `count` slots at once, for a test that takes all of them.
    pub async fn acquire_many(&self, count: u32) -> Result<SearchSlot<'_>, AcquireError> {
        let permit = self.0.acquire_many(count).await?;
        Ok(SearchSlot { _permit: permit })
    }

    pub fn available_permits(&self) -> usize {
        self.0.available_permits()
    }
}
