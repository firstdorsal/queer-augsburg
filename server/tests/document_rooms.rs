//! Live editing against rooms and the yrs protocol, with a store that can fail. The browser client
//! and the socket itself are covered by the checks before a deploy (see web/README.md).

#![forbid(unsafe_code)]

use axum::body::Bytes;
use backend::capped_allocator::CappedAllocator;
use backend::document_rooms::{
    initial_state, text_of_state, Connection, DocumentStore, JoinError, LoadedState, NewVersion,
    Outbound, Rooms, SaveOutcome, SavedState, CLOSE_BAD_MESSAGE, CLOSE_DAMAGED, CLOSE_DELETED,
    CLOSE_RESTART, CLOSE_ROOM_FAILED, CLOSE_TOO_LARGE, MAX_CONNECTIONS, MAX_CONNECTIONS_PER_USER,
    MAX_ROOMS, MAX_UPDATE_BYTES, TEXT_ROOT,
};
use futures_util::future::BoxFuture;
use serde_json::Value;
use std::collections::HashMap;
use std::sync::atomic::{AtomicBool, AtomicUsize, Ordering};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};
use yrs::sync::{awareness::AwarenessUpdateEntry, AwarenessUpdate, Message, SyncMessage};
use yrs::updates::decoder::Decode;
use yrs::updates::encoder::Encode;
use yrs::{
    ClientID, Doc, GetString, OffsetKind, Options, ReadTxn, StateVector, Text, Transact, Update,
};

#[global_allocator]
static ALLOCATOR: CappedAllocator = CappedAllocator;

/// Long enough for a slow runner; conditions are polled, so normally nothing waits this long.
const DEADLINE: Duration = Duration::from_secs(20);
const SETTLE: Duration = Duration::from_millis(100);

#[derive(Default)]
struct FakeStore {
    documents: Mutex<HashMap<String, LoadedState>>,
    saved: Mutex<Vec<SavedState>>,
    versions: Mutex<Vec<NewVersion>>,
    failing: AtomicBool,
    /// The next save is written but reports an error, like a connection lost after the write.
    fail_after_write: AtomicBool,
    /// Saves wait until this is released.
    hold_saves: AtomicBool,
    released: tokio::sync::Notify,
    saves_started: AtomicUsize,
}

impl FakeStore {
    fn with_document(id: &str, text: &str) -> Arc<Self> {
        let store = Arc::new(Self::default());
        store.add_document(id, text);
        store
    }

    fn add_document(&self, id: &str, text: &str) {
        let state = LoadedState {
            state: initial_state(text),
            state_version: 1,
        };
        self.documents.lock().unwrap().insert(id.to_string(), state);
    }

    fn stored_text(&self, id: &str) -> String {
        let documents = self.documents.lock().unwrap();
        text_of_state(&documents[id].state).unwrap()
    }

    fn saves_started(&self) -> usize {
        self.saves_started.load(Ordering::SeqCst)
    }
}

/// `DocumentStore` hands out futures that outlive `&self`, so they hold their own reference.
struct Shared(Arc<FakeStore>);

impl DocumentStore for Shared {
    fn load_state(
        &self,
        document_id: String,
    ) -> BoxFuture<'static, anyhow::Result<Option<LoadedState>>> {
        let store = self.0.clone();
        Box::pin(async move { Ok(store.documents.lock().unwrap().get(&document_id).cloned()) })
    }

    fn save_state(
        &self,
        document_id: String,
        saved: SavedState,
    ) -> BoxFuture<'static, anyhow::Result<SaveOutcome>> {
        let store = self.0.clone();
        Box::pin(async move {
            store.saves_started.fetch_add(1, Ordering::SeqCst);
            if store.hold_saves.load(Ordering::SeqCst) {
                store.released.notified().await;
            }
            if store.failing.load(Ordering::SeqCst) {
                anyhow::bail!("database is down");
            }
            let state_version = {
                let mut documents = store.documents.lock().unwrap();
                let Some(document) = documents.get_mut(&document_id) else {
                    return Ok(SaveOutcome::Gone);
                };
                if document.state_version != saved.state_version {
                    return Ok(SaveOutcome::Gone);
                }
                document.state = saved.state.clone();
                document.state_version += 1;
                document.state_version
            };
            store.saved.lock().unwrap().push(saved);
            if store.fail_after_write.swap(false, Ordering::SeqCst) {
                anyhow::bail!("connection lost after the write");
            }
            Ok(SaveOutcome::Saved { state_version })
        })
    }

    fn add_version(
        &self,
        _document_id: String,
        version: NewVersion,
    ) -> BoxFuture<'static, anyhow::Result<()>> {
        let store = self.0.clone();
        Box::pin(async move {
            store.versions.lock().unwrap().push(version);
            Ok(())
        })
    }
}

fn rooms_for(store: &Arc<FakeStore>) -> Arc<Rooms> {
    Rooms::new(Arc::new(Shared(store.clone())))
}

async fn wait_until(what: &str, condition: impl Fn() -> bool) {
    let started = Instant::now();
    while !condition() {
        assert!(started.elapsed() < DEADLINE, "still waiting for: {what}");
        tokio::time::sleep(Duration::from_millis(20)).await;
    }
}

struct Client {
    doc: Doc,
    connection: Connection,
    closed: Option<u16>,
    awareness: Vec<HashMap<ClientID, AwarenessUpdateEntry>>,
}

impl Client {
    fn join(rooms: &Arc<Rooms>, id: &str, user: &str) -> Self {
        Self {
            doc: Doc::with_options(Options {
                offset_kind: OffsetKind::Utf16,
                ..Options::default()
            }),
            connection: rooms.join(id, user, user).unwrap(),
            closed: None,
            awareness: Vec::new(),
        }
    }

    async fn send(&self, message: Message) {
        self.send_raw(message.encode_v1()).await;
    }

    async fn send_raw(&self, frame: Vec<u8>) {
        self.connection.send_frame(Bytes::from(frame)).await;
    }

    /// Handles what arrives for a moment, like the browser client.
    async fn listen(&mut self, duration: Duration) {
        let end = tokio::time::Instant::now() + duration;
        while let Ok(outbound) = tokio::time::timeout_at(end, self.connection.next()).await {
            match outbound {
                Outbound::Close(code, _) => {
                    self.closed = Some(code);
                    return;
                }
                Outbound::Gone => {
                    self.closed = Some(CLOSE_ROOM_FAILED);
                    return;
                }
                Outbound::Frame(frame) => self.frame(&frame).await,
            }
        }
    }

    async fn closed_with(&mut self) -> Option<u16> {
        self.listen(DEADLINE).await;
        self.closed
    }

    async fn frame(&mut self, frame: &[u8]) {
        match Message::decode_v1(frame).unwrap() {
            Message::Sync(SyncMessage::SyncStep1(state_vector)) => {
                let update = self.doc.transact().encode_state_as_update_v1(&state_vector);
                self.send(Message::Sync(SyncMessage::SyncStep2(update)))
                    .await;
            }
            Message::Sync(SyncMessage::SyncStep2(update) | SyncMessage::Update(update)) => {
                let update = Update::decode_v1(&update).unwrap();
                self.doc.transact_mut().apply_update(update).unwrap();
            }
            Message::Awareness(update) => self.awareness.push(update.clients),
            _ => {}
        }
    }

    async fn sync(&mut self) {
        let state_vector = self.doc.transact().state_vector();
        self.send(Message::Sync(SyncMessage::SyncStep1(state_vector)))
            .await;
        self.listen(SETTLE).await;
    }

    fn text(&self) -> String {
        let root = self.doc.get_or_insert_text(TEXT_ROOT);
        let text = root.get_string(&self.doc.transact());
        text
    }

    /// Changes the local text without telling the room.
    fn insert_locally(&self, index: u32, text: &str) -> Vec<u8> {
        let root = self.doc.get_or_insert_text(TEXT_ROOT);
        let mut transaction = self.doc.transact_mut();
        root.insert(&mut transaction, index, text);
        transaction.encode_update_v1()
    }

    async fn insert(&self, index: u32, text: &str) {
        let update = self.insert_locally(index, text);
        self.send(Message::Sync(SyncMessage::Update(update))).await;
    }
}

/// Written by this server: a change of the root name or the encoding must not go unnoticed,
/// as a state read as empty would be saved as empty.
#[test]
fn a_state_saved_earlier_stays_readable() {
    let state = [
        1, 1, 179, 231, 198, 176, 136, 237, 143, 14, 0, 4, 1, 7, 99, 111, 110, 116, 101, 110, 116,
        15, 35, 32, 71, 114, 195, 182, 195, 159, 101, 32, 240, 159, 140, 136, 10, 0,
    ];
    assert_eq!(text_of_state(&state).unwrap(), "# Größe 🌈\n");
}

#[tokio::test]
async fn two_clients_write_together_and_the_room_saves() {
    let store = FakeStore::with_document("d", "# Titel\n\n");
    let rooms = rooms_for(&store);
    let mut alex = Client::join(&rooms, "d", "alex");
    let mut sam = Client::join(&rooms, "d", "sam");
    alex.sync().await;
    sam.sync().await;
    assert_eq!(alex.text(), "# Titel\n\n");

    alex.insert(9, "Größe").await;
    sam.insert(9, "🏳️‍🌈 ").await;
    alex.listen(SETTLE).await;
    sam.listen(SETTLE).await;
    assert_eq!(alex.text(), sam.text());
    assert!(alex.text().contains("Größe") && alex.text().contains("🏳️‍🌈"));

    let expected = alex.text();
    wait_until("the save", || store.stored_text("d") == expected).await;
    let saved = store.saved.lock().unwrap().last().unwrap().clone();
    assert_eq!(saved.title, "Titel");
    assert_eq!(saved.content, alex.text());
}

#[tokio::test]
async fn joining_at_the_same_moment_shares_one_room_and_never_doubles_the_text() {
    let store = FakeStore::with_document("d", "Hallo");
    let rooms = rooms_for(&store);
    let mut clients: Vec<Client> = (0..6)
        .map(|n| Client::join(&rooms, "d", &format!("user-{n}")))
        .collect();
    for client in &mut clients {
        client.sync().await;
        assert_eq!(client.text(), "Hallo");
    }
}

#[tokio::test]
async fn a_client_with_offline_edits_comes_back_without_duplicates() {
    let store = FakeStore::with_document("d", "online ");
    let rooms = rooms_for(&store);
    let mut alex = Client::join(&rooms, "d", "alex");
    alex.sync().await;
    alex.insert_locally(7, "offline");

    let mut sam = Client::join(&rooms, "d", "sam");
    sam.sync().await;
    sam.insert(0, "sam ").await;
    sam.listen(SETTLE).await;

    alex.connection = rooms.join("d", "alex", "alex").unwrap();
    alex.listen(SETTLE).await;
    alex.sync().await;
    sam.listen(SETTLE).await;
    assert_eq!(alex.text(), "sam online offline");
    assert_eq!(sam.text(), alex.text());
}

#[tokio::test]
async fn the_last_client_leaving_saves_and_closes_the_room() {
    let store = FakeStore::with_document("d", "alt");
    let rooms = rooms_for(&store);
    let mut alex = Client::join(&rooms, "d", "alex");
    alex.sync().await;
    alex.insert(3, " neu").await;
    tokio::time::sleep(SETTLE).await;
    assert!(rooms.is_open("d"));
    drop(alex);

    wait_until("the room to close", || !rooms.is_open("d")).await;
    assert_eq!(store.stored_text("d"), "alt neu");

    wait_until("both versions", || {
        store.versions.lock().unwrap().len() == 2
    })
    .await;
    let versions = store.versions.lock().unwrap();
    let texts: Vec<&str> = versions
        .iter()
        .map(|version| version.content.as_str())
        .collect();
    assert_eq!(texts, ["alt", "alt neu"]);
    assert_eq!(versions[1].editors, ["alex"]);
}

#[tokio::test]
async fn a_new_client_gets_the_saved_text_after_the_room_closed() {
    let store = FakeStore::with_document("d", "eins");
    let rooms = rooms_for(&store);
    for round in 0..5 {
        let mut client = Client::join(&rooms, "d", "alex");
        client.sync().await;
        assert_eq!(client.text().chars().count(), 4 + round);
        client.insert(0, "x").await;
        tokio::time::sleep(SETTLE).await;
        drop(client);
        wait_until("the room to close", || !rooms.is_open("d")).await;
    }
    assert_eq!(store.stored_text("d"), "xxxxxeins");
}

#[tokio::test]
async fn a_failed_save_keeps_the_room_and_shows_the_banner_until_it_works() {
    let store = FakeStore::with_document("d", "text");
    store.failing.store(true, Ordering::SeqCst);
    let rooms = rooms_for(&store);
    let mut alex = Client::join(&rooms, "d", "alex");
    alex.sync().await;
    alex.insert(4, " neu").await;
    wait_until("a save to start", || store.saves_started() > 0).await;
    alex.listen(Duration::from_millis(300)).await;

    let banner_shown =
        alex.awareness.iter().flatten().any(|(id, entry)| {
            id.get() == 1 << 32 && entry.json.as_ref() == r#"{"saveFailed":true}"#
        });
    assert!(banner_shown);
    drop(alex);
    wait_until("another attempt", || store.saves_started() > 1).await;
    assert!(rooms.is_open("d"), "unsaved text must stay in the room");

    store.failing.store(false, Ordering::SeqCst);
    wait_until("the room to close", || !rooms.is_open("d")).await;
    assert_eq!(store.stored_text("d"), "text neu");
}

#[tokio::test]
async fn a_save_that_went_through_after_all_is_no_deletion() {
    let store = FakeStore::with_document("d", "text");
    store.fail_after_write.store(true, Ordering::SeqCst);
    let rooms = rooms_for(&store);
    let mut alex = Client::join(&rooms, "d", "alex");
    alex.sync().await;
    alex.insert(4, " neu").await;
    wait_until("the second attempt", || store.saves_started() >= 2).await;
    alex.listen(Duration::from_millis(1_500)).await;
    assert_eq!(alex.closed, None);
    assert_eq!(store.stored_text("d"), "text neu");
}

#[tokio::test]
async fn deleting_closes_the_room_and_nothing_is_saved_afterwards() {
    let store = FakeStore::with_document("d", "text");
    let rooms = rooms_for(&store);
    let mut alex = Client::join(&rooms, "d", "alex");
    alex.sync().await;
    alex.insert(4, " neu").await;
    tokio::time::sleep(SETTLE).await;

    rooms.document_deleted("d").await;
    assert_eq!(alex.closed_with().await, Some(CLOSE_DELETED));
    wait_until("the room to close", || !rooms.is_open("d")).await;
    // Longer than a save would have needed.
    tokio::time::sleep(Duration::from_secs(3)).await;
    assert_eq!(store.saves_started(), 0);
    assert_eq!(store.stored_text("d"), "text");
}

#[tokio::test]
async fn a_room_ending_during_a_save_waits_for_it() {
    let store = FakeStore::with_document("d", "text");
    store.hold_saves.store(true, Ordering::SeqCst);
    let rooms = rooms_for(&store);
    let mut alex = Client::join(&rooms, "d", "alex");
    alex.sync().await;
    alex.insert(4, " neu").await;
    wait_until("the save to start", || store.saves_started() == 1).await;

    rooms.document_deleted("d").await;
    assert_eq!(alex.closed_with().await, Some(CLOSE_DELETED));
    tokio::time::sleep(Duration::from_millis(700)).await;
    assert!(
        rooms.is_open("d"),
        "a successor must not read before the save is done"
    );

    store.released.notify_waiters();
    wait_until("the room to close", || !rooms.is_open("d")).await;
}

#[tokio::test]
async fn an_update_that_never_resolves_ends_with_its_sender_and_reopens_the_room() {
    let store = FakeStore::with_document("d", "text");
    let rooms = rooms_for(&store);
    let mut attacker = Client::join(&rooms, "d", "attacker");
    let mut alex = Client::join(&rooms, "d", "alex");
    attacker.sync().await;
    alex.sync().await;

    // The first of two updates never arrives, so the second can never be applied.
    attacker.insert_locally(0, "a");
    let dependent = attacker.insert_locally(1, "b");
    attacker
        .send(Message::Sync(SyncMessage::Update(dependent)))
        .await;

    assert_eq!(attacker.closed_with().await, Some(CLOSE_BAD_MESSAGE));
    assert_eq!(alex.closed_with().await, Some(CLOSE_RESTART));
    wait_until("the room to close", || !rooms.is_open("d")).await;
    assert_eq!(store.saves_started(), 0);

    let mut sam = Client::join(&rooms, "d", "sam");
    sam.sync().await;
    assert_eq!(sam.text(), "text");
}

#[tokio::test]
async fn a_keystroke_overtaking_offline_edits_resolves_without_harm() {
    let store = FakeStore::with_document("d", "text");
    let rooms = rooms_for(&store);
    let mut alex = Client::join(&rooms, "d", "alex");
    alex.sync().await;

    let earlier = alex.insert_locally(4, " offline");
    let later = alex.insert_locally(12, " getippt");
    alex.send(Message::Sync(SyncMessage::Update(later))).await;
    tokio::time::sleep(Duration::from_millis(600)).await;
    alex.send(Message::Sync(SyncMessage::Update(earlier))).await;

    wait_until("the save", || {
        store.stored_text("d") == "text offline getippt"
    })
    .await;
    alex.listen(SETTLE).await;
    assert_eq!(alex.closed, None);
}

#[tokio::test]
async fn a_client_that_asks_for_everything_and_does_not_read_is_cut_off() {
    let store = FakeStore::with_document("d", &"x".repeat(1_000_000));
    let rooms = rooms_for(&store);
    let mut greedy = Client::join(&rooms, "d", "greedy");
    let mut alex = Client::join(&rooms, "d", "alex");
    alex.sync().await;
    for _ in 0..40 {
        let everything = StateVector::default();
        greedy
            .send(Message::Sync(SyncMessage::SyncStep1(everything)))
            .await;
    }
    assert_eq!(greedy.closed_with().await, Some(CLOSE_RESTART));
    alex.insert(0, "y").await;
    alex.listen(SETTLE).await;
    assert_eq!(alex.closed, None);
}

#[tokio::test]
async fn a_missing_document_refuses_the_join_with_its_close_code() {
    let store = Arc::new(FakeStore::default());
    let rooms = rooms_for(&store);
    let mut alex = Client::join(&rooms, "weg", "alex");
    assert_eq!(alex.closed_with().await, Some(CLOSE_DELETED));
}

#[tokio::test]
async fn a_damaged_state_is_refused_and_never_overwritten() {
    let store = FakeStore::with_document("d", "text");
    store.documents.lock().unwrap().get_mut("d").unwrap().state = vec![255, 255, 255];
    let rooms = rooms_for(&store);
    let mut alex = Client::join(&rooms, "d", "alex");
    assert_eq!(alex.closed_with().await, Some(CLOSE_DAMAGED));
    assert_eq!(
        store.documents.lock().unwrap()["d"].state,
        vec![255, 255, 255]
    );
}

#[tokio::test]
async fn broken_frames_close_only_their_connection() {
    let store = FakeStore::with_document("d", "text");
    let rooms = rooms_for(&store);
    let mut broken = Client::join(&rooms, "d", "broken");
    let mut alex = Client::join(&rooms, "d", "alex");
    alex.sync().await;

    broken.send_raw(vec![0, 2, 200, 1, 2]).await;
    assert_eq!(broken.closed_with().await, Some(CLOSE_BAD_MESSAGE));

    alex.insert(4, "!").await;
    alex.sync().await;
    assert_eq!(alex.text(), "text!");
    assert_eq!(alex.closed, None);
}

/// Frames of a few bytes declaring billions of entries, which killed the process before
/// `CappedAllocator`.
#[tokio::test]
async fn frames_that_declare_gigabytes_cost_nothing() {
    let store = FakeStore::with_document("d", "text");
    let rooms = rooms_for(&store);
    for frame in [
        vec![0, 2, 5, 187, 184, 237, 226, 87],
        vec![0, 0, 5, 255, 255, 255, 255, 15],
        vec![1, 5, 128, 128, 128, 128, 4],
    ] {
        let mut attacker = Client::join(&rooms, "d", "attacker");
        attacker.send_raw(frame).await;
        assert_eq!(attacker.closed_with().await, Some(CLOSE_BAD_MESSAGE));
    }
    let mut alex = Client::join(&rooms, "d", "alex");
    alex.sync().await;
    assert_eq!(alex.text(), "text");
}

#[tokio::test]
async fn an_update_above_the_limit_is_refused_unapplied() {
    let store = FakeStore::with_document("d", "text");
    let rooms = rooms_for(&store);
    let mut alex = Client::join(&rooms, "d", "alex");
    alex.sync().await;
    alex.insert(0, &"x".repeat(MAX_UPDATE_BYTES + 1)).await;
    assert_eq!(alex.closed_with().await, Some(CLOSE_TOO_LARGE));

    let mut sam = Client::join(&rooms, "d", "sam");
    sam.sync().await;
    assert_eq!(sam.text(), "text");
}

#[tokio::test]
async fn names_come_from_the_server_and_foreign_clients_are_ignored() {
    let store = FakeStore::with_document("d", "text");
    let rooms = rooms_for(&store);
    let mut alex = Client::join(&rooms, "d", "alex");
    let mut sam = Client::join(&rooms, "d", "sam");
    alex.sync().await;
    sam.sync().await;

    let entry = |clock: u32, json: &str| AwarenessUpdateEntry {
        clock,
        json: json.into(),
    };
    let client_7 = |entry| AwarenessUpdate {
        clients: HashMap::from([(ClientID::new(7), entry)]),
    };
    let seen_by = |client: &Client| -> Value {
        let seen = client.awareness.iter().flatten();
        let seen = seen.filter(|(id, _)| id.get() == 7).last().unwrap();
        serde_json::from_str(&seen.1.json).unwrap()
    };

    let forged =
        r#"{"user":{"name":"Vorstand","colorIndex":99},"cursor":{"anchor":{},"head":{}},"x":1}"#;
    alex.send(Message::Awareness(client_7(entry(1, forged))))
        .await;
    sam.listen(SETTLE).await;
    let seen = seen_by(&sam);
    assert_eq!(seen["user"]["name"], "alex");
    assert_ne!(seen["user"]["colorIndex"], 99);
    assert!(seen["cursor"]["anchor"].is_object());
    assert!(seen.get("x").is_none());

    // A malformed cursor would throw in the others' editors.
    let malformed = r#"{"cursor":{"anchor":1,"head":{}}}"#;
    alex.send(Message::Awareness(client_7(entry(2, malformed))))
        .await;
    sam.listen(SETTLE).await;
    assert!(seen_by(&sam)["cursor"].is_null());
    // Byte for byte as the MongoDB build wrote it (serde_json `preserve_order`): the keys in
    // the order the server writes them, not sorted.
    let raw = sam
        .awareness
        .iter()
        .flatten()
        .filter(|(id, _)| id.get() == 7)
        .last()
        .unwrap()
        .1
        .json
        .to_string();
    let color = seen_by(&sam)["user"]["colorIndex"].clone();
    assert_eq!(
        raw,
        format!(r#"{{"user":{{"name":"alex","colorIndex":{color}}},"cursor":null}}"#)
    );

    // Sam speaks for Alex's client.
    alex.listen(SETTLE).await;
    sam.listen(SETTLE).await;
    alex.awareness.clear();
    let foreign = r#"{"user":{"name":"Sam"}}"#;
    sam.send(Message::Awareness(client_7(entry(3, foreign))))
        .await;
    alex.listen(SETTLE).await;
    assert!(alex.awareness.iter().flatten().all(|(id, _)| id.get() != 7));
}

#[tokio::test]
async fn the_number_of_rooms_is_limited_and_closing_one_makes_place() {
    let store = Arc::new(FakeStore::default());
    for n in 0..=MAX_ROOMS {
        store.add_document(&format!("d{n}"), "text");
    }
    let rooms = rooms_for(&store);
    let mut clients: Vec<Client> = (0..MAX_ROOMS)
        .map(|n| Client::join(&rooms, &format!("d{n}"), &format!("user-{n}")))
        .collect();
    let last = format!("d{MAX_ROOMS}");
    assert_eq!(
        rooms.join(&last, "late", "late").err(),
        Some(JoinError::TooManyRooms)
    );
    clients.pop();
    let closed = format!("d{}", MAX_ROOMS - 1);
    wait_until("the room to close", || !rooms.is_open(&closed)).await;
    assert!(rooms.join(&last, "late", "late").is_ok());
}

#[tokio::test]
async fn the_number_of_connections_is_limited() {
    let store = FakeStore::with_document("d", "text");
    let rooms = rooms_for(&store);
    let connections: Vec<Connection> = (0..MAX_CONNECTIONS)
        .map(|n| rooms.join("d", &format!("user-{n}"), "name").unwrap())
        .collect();
    assert_eq!(
        rooms.join("d", "late", "late").err(),
        Some(JoinError::TooManyConnections)
    );
    drop(connections);
    assert!(rooms.join("d", "late", "late").is_ok());
}

#[tokio::test]
async fn too_many_connections_of_one_person_are_refused() {
    let store = FakeStore::with_document("d", "text");
    let rooms = rooms_for(&store);
    let connections: Vec<Connection> = (0..MAX_CONNECTIONS_PER_USER)
        .map(|_| rooms.join("d", "alex", "alex").unwrap())
        .collect();
    assert_eq!(
        rooms.join("d", "alex", "alex").err(),
        Some(JoinError::TooManyConnections)
    );
    drop(connections);
    assert!(rooms.join("d", "alex", "alex").is_ok());
}

#[tokio::test]
async fn shutting_down_saves_and_tells_the_clients_to_come_back() {
    let store = FakeStore::with_document("d", "text");
    let rooms = rooms_for(&store);
    let mut alex = Client::join(&rooms, "d", "alex");
    alex.sync().await;
    alex.insert(4, " neu").await;
    tokio::time::sleep(SETTLE).await;

    let closing = rooms.clone();
    let done = tokio::spawn(async move { closing.shut_down(Duration::from_secs(10)).await });
    assert_eq!(alex.closed_with().await, Some(CLOSE_RESTART));
    assert_eq!(store.stored_text("d"), "text neu");
    assert_eq!(
        rooms.join("d", "sam", "sam").err(),
        Some(JoinError::ShuttingDown)
    );
    drop(alex);
    done.await.unwrap();
}
