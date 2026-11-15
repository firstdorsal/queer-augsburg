//! Live editing: one room per open document. An actor task owns the yrs `Doc`, so nothing
//! shares a lock and a panic ends one room only. The text changes only here; `documents.state`
//! is the source of truth and `content` and `title` are derived from it on every save.

use crate::document_rules::derive_title;
use anyhow::Context;
use axum::body::Bytes;
use futures_util::future::BoxFuture;
use serde_json::{json, Value};
use std::collections::{BTreeSet, HashMap};
use std::sync::atomic::{AtomicBool, AtomicU64, AtomicUsize, Ordering};
use std::sync::{Arc, Mutex, MutexGuard, PoisonError};
use std::time::{Duration, Instant};
use tokio::sync::{mpsc, watch};
use tokio_util::sync::CancellationToken;
use tokio_util::task::TaskTracker;
use yrs::sync::awareness::AwarenessUpdateEntry;
use yrs::sync::{Awareness, AwarenessUpdate, Message, SyncMessage};
use yrs::updates::decoder::Decode;
use yrs::updates::encoder::Encode;
use yrs::{
    ClientID, Doc, GetString, OffsetKind, Options, ReadTxn, StateVector, Text, TextRef, Transact,
    Update,
};

/// Name of the shared text; `ydoc.getText` in the editor must use the same. Stored in every
/// state: renaming it would turn all documents empty.
pub const TEXT_ROOT: &str = "content";

// Measured with 10 million realistic keystrokes: a document of 100 000 characters reaches
// 5.6 MB of state, and memory in a room is up to 35 times the state. 2 x (state + update) stays
// below MongoDB's 16 MB per document, as `state` also holds the text saved in `content`.
pub const MAX_STATE_BYTES: usize = 6_000_000;
/// A whole text replaced plus its delete set is about 250 KB.
pub const MAX_UPDATE_BYTES: usize = 2_000_000;
/// Above the state cap, so that honest clients get a close code instead of a broken socket.
pub const MAX_SOCKET_MESSAGE_BYTES: usize = 8_000_000;
pub const MAX_SOCKET_WRITE_BUFFER_BYTES: usize = 9_000_000;
/// Open documents at once, and their summed state: with the factor above about 1.1 GB.
pub const MAX_ROOMS: usize = 16;
pub const MAX_OPEN_STATE_BYTES: usize = 32_000_000;
pub const MAX_CONNECTIONS: usize = 64;
pub const MAX_CONNECTIONS_PER_USER: usize = 8;
/// What may wait for one client. Two whole states: a client asking for the full state again and
/// again without reading must not fill the memory.
const MAX_QUEUED_BYTES: usize = 2 * MAX_STATE_BYTES + 4_000_000;
const MAX_AWARENESS_ENTRY_BYTES: usize = 2_048;

const COMMAND_QUEUE: usize = 256;
const OUTBOUND_QUEUE: usize = 256;

const SAVE_AFTER_PAUSE: Duration = Duration::from_secs(2);
/// A pause never comes while people type on and on.
const SAVE_AT_LATEST: Duration = Duration::from_secs(10);
const SAVE_RETRIES: [Duration; 5] = [
    Duration::from_secs(1),
    Duration::from_secs(2),
    Duration::from_secs(5),
    Duration::from_secs(10),
    Duration::from_secs(30),
];
const VERSION_INTERVAL: Duration = Duration::from_secs(600);
/// y-websocket reconnects after 30 s without an application message; WebSocket pings do not count.
const KEEP_ALIVE: Duration = Duration::from_secs(20);
/// Clients drop awareness entries they have not seen for 30 s.
const BANNER_REFRESH: Duration = Duration::from_secs(10);
/// A keystroke overtaking offline edits leaves an update pending for one round trip.
/// Longer means it never resolves, and such an update can make encoding panic.
const PENDING_GRACE: Duration = Duration::from_secs(5);
const TICK: Duration = Duration::from_millis(500);

// The editor's reaction is in web/src/documentEditor/connection.ts: 4xxx stop it, except
// 4401, which renews the session; the others reconnect.
pub const CLOSE_ROOM_FAILED: u16 = 1011;
pub const CLOSE_RESTART: u16 = 1012;
pub const CLOSE_BUSY: u16 = 1013;
pub const CLOSE_BAD_MESSAGE: u16 = 4400;
pub const CLOSE_SESSION: u16 = 4401;
pub const CLOSE_NO_PERMISSION: u16 = 4403;
pub const CLOSE_DELETED: u16 = 4404;
pub const CLOSE_TOO_LARGE: u16 = 4413;
pub const CLOSE_DAMAGED: u16 = 4422;

/// Above every Yjs client id (random 32 bits), so it cannot collide with a client.
const SERVER_CLIENT_ID: u64 = 1 << 32;
const USER_COLORS: u64 = 8;

/// UTF-16 offsets, so that lengths and positions match the JavaScript clients.
fn new_doc() -> Doc {
    Doc::with_options(Options {
        offset_kind: OffsetKind::Utf16,
        ..Options::default()
    })
}

/// The state of a new document. Only this function creates one: two independent states of
/// the same text would merge into the text appearing twice.
pub fn initial_state(text: &str) -> Vec<u8> {
    let doc = new_doc();
    let root = doc.get_or_insert_text(TEXT_ROOT);
    let mut transaction = doc.transact_mut();
    root.insert(&mut transaction, 0, text);
    transaction.encode_state_as_update_v1(&StateVector::default())
}

/// The text held by a stored state.
pub fn text_of_state(state: &[u8]) -> anyhow::Result<String> {
    let doc = load_doc(state)?;
    let root = doc.get_or_insert_text(TEXT_ROOT);
    let text = root.get_string(&doc.transact());
    Ok(text)
}

/// A panic elsewhere must not take all documents down with a poisoned lock.
fn locked<T>(mutex: &Mutex<T>) -> MutexGuard<'_, T> {
    mutex.lock().unwrap_or_else(PoisonError::into_inner)
}

fn load_doc(state: &[u8]) -> anyhow::Result<Doc> {
    let doc = new_doc();
    let update = Update::decode_v1(state).context("decoding the stored state")?;
    doc.transact_mut()
        .apply_update(update)
        .context("applying the stored state")?;
    Ok(doc)
}

#[derive(Debug, Clone)]
pub struct LoadedState {
    pub state: Vec<u8>,
    pub state_version: i64,
}

#[derive(Debug, Clone)]
pub struct SavedState {
    pub state: Vec<u8>,
    pub content: String,
    pub title: String,
    /// The version this save builds on.
    pub state_version: i64,
}

#[derive(Debug, Clone)]
pub struct NewVersion {
    pub content: String,
    pub editors: Vec<String>,
}

#[derive(Debug, PartialEq, Eq, Clone, Copy)]
pub enum SaveOutcome {
    Saved {
        state_version: i64,
    },
    /// Deleted, or saved by another server process.
    Gone,
}

pub trait DocumentStore: Send + Sync + 'static {
    /// `None` if there is no such live document.
    fn load_state(
        &self,
        document_id: String,
    ) -> BoxFuture<'static, anyhow::Result<Option<LoadedState>>>;
    fn save_state(
        &self,
        document_id: String,
        saved: SavedState,
    ) -> BoxFuture<'static, anyhow::Result<SaveOutcome>>;
    fn add_version(
        &self,
        document_id: String,
        version: NewVersion,
    ) -> BoxFuture<'static, anyhow::Result<()>>;
}

/// What a connection has to pass on to its client.
#[derive(Debug)]
pub enum Outbound {
    Frame(Bytes),
    Close(u16, String),
    /// The room failed.
    Gone,
}

type CloseReason = Option<(u16, String)>;

/// How a save ended, as far as the room has to care.
enum SaveEnd {
    Saved {
        state_version: i64,
    },
    /// A write reported as failed had gone through: the stored version is ahead.
    Behind {
        state_version: i64,
    },
    Deleted,
}

#[derive(Debug, PartialEq, Eq, Clone, Copy, thiserror::Error)]
pub enum JoinError {
    #[error("Es sind gerade zu viele Dokumente geöffnet.")]
    TooManyRooms,
    #[error("Es sind gerade zu viele Verbindungen offen.")]
    TooManyConnections,
    #[error("Der Server startet gerade neu.")]
    ShuttingDown,
}

enum Command {
    Join {
        connection: u64,
        user_id: String,
        name: String,
        channel: ConnectionChannel,
    },
    Frame {
        connection: u64,
        data: Bytes,
    },
    Leave {
        connection: u64,
    },
    Deleted,
    SaveDone(anyhow::Result<SaveEnd>, String),
}

/// The room's end of a connection. The close reason has its own way, as a client that is
/// behind has no room left in its queue.
struct ConnectionChannel {
    frames: mpsc::Sender<Bytes>,
    closing: watch::Sender<CloseReason>,
    queued_bytes: Arc<AtomicUsize>,
}

impl ConnectionChannel {
    fn close(&self, code: u16, reason: &str) {
        self.closing.send_replace(Some((code, reason.to_string())));
    }

    /// `false` if the client is too far behind.
    fn enqueue(&self, frame: &Bytes) -> bool {
        if self.queued_bytes.load(Ordering::SeqCst) + frame.len() > MAX_QUEUED_BYTES {
            return false;
        }
        self.queued_bytes.fetch_add(frame.len(), Ordering::SeqCst);
        self.frames.try_send(frame.clone()).is_ok()
    }
}

#[derive(Default)]
struct Registry {
    rooms: HashMap<String, mpsc::Sender<Command>>,
    connections_per_user: HashMap<String, usize>,
}

pub struct Rooms {
    store: Arc<dyn DocumentStore>,
    registry: Mutex<Registry>,
    next_connection: AtomicU64,
    open_state_bytes: AtomicUsize,
    shutting_down: AtomicBool,
    cancel: CancellationToken,
    tasks: TaskTracker,
}

impl Rooms {
    pub fn new(store: Arc<dyn DocumentStore>) -> Arc<Self> {
        Arc::new(Self {
            store,
            registry: Mutex::default(),
            next_connection: AtomicU64::new(1),
            open_state_bytes: AtomicUsize::new(0),
            shutting_down: AtomicBool::new(false),
            cancel: CancellationToken::new(),
            tasks: TaskTracker::new(),
        })
    }

    pub fn is_shutting_down(&self) -> bool {
        self.shutting_down.load(Ordering::SeqCst)
    }

    pub fn tasks(&self) -> &TaskTracker {
        &self.tasks
    }

    pub fn shutdown_token(&self) -> CancellationToken {
        self.cancel.clone()
    }

    /// Stops taking connections; rooms save and close their sockets. `axum::serve` does not
    /// wait for upgraded sockets, so its shutdown future must await this.
    pub async fn shut_down(&self, timeout: Duration) {
        self.shutting_down.store(true, Ordering::SeqCst);
        self.cancel.cancel();
        self.tasks.close();
        if tokio::time::timeout(timeout, self.tasks.wait())
            .await
            .is_err()
        {
            eprintln!("document rooms: not finished after {timeout:?}, stopping anyway");
        }
    }

    pub fn is_open(&self, document_id: &str) -> bool {
        let registry = locked(&self.registry);
        registry
            .rooms
            .get(document_id)
            .is_some_and(|room| !room.is_closed())
    }

    /// Tells an open room that its document is deleted.
    pub async fn document_deleted(&self, document_id: &str) {
        let room = locked(&self.registry).rooms.get(document_id).cloned();
        if let Some(room) = room {
            // Only fails if the room is gone anyway.
            let _ = room.send(Command::Deleted).await;
        }
    }

    pub fn join(
        self: &Arc<Self>,
        document_id: &str,
        user_id: &str,
        name: &str,
    ) -> Result<Connection, JoinError> {
        if self.is_shutting_down() {
            return Err(JoinError::ShuttingDown);
        }
        let mut registry = locked(&self.registry);
        let total: usize = registry.connections_per_user.values().sum();
        let of_user = registry
            .connections_per_user
            .get(user_id)
            .copied()
            .unwrap_or(0);
        if total >= MAX_CONNECTIONS || of_user >= MAX_CONNECTIONS_PER_USER {
            return Err(JoinError::TooManyConnections);
        }

        let open_room = registry
            .rooms
            .get(document_id)
            .filter(|room| !room.is_closed())
            .cloned();
        let room = match open_room {
            Some(room) => room,
            None => {
                let live = registry.rooms.values().filter(|room| !room.is_closed());
                if live.count() >= MAX_ROOMS
                    || self.open_state_bytes.load(Ordering::SeqCst) >= MAX_OPEN_STATE_BYTES
                {
                    return Err(JoinError::TooManyRooms);
                }
                let room = self.spawn_room(document_id);
                registry.rooms.insert(document_id.to_string(), room.clone());
                room
            }
        };

        let connection = self.next_connection.fetch_add(1, Ordering::SeqCst);
        let (frames, receiver) = mpsc::channel(OUTBOUND_QUEUE);
        let (closing, closing_receiver) = watch::channel(None);
        let queued_bytes = Arc::new(AtomicUsize::new(0));
        // Under the registry lock: a room removes itself under the same lock and only with an
        // empty queue, so no join can get lost between the two.
        let joined = room.try_send(Command::Join {
            connection,
            user_id: user_id.to_string(),
            name: name.to_string(),
            channel: ConnectionChannel {
                frames,
                closing,
                queued_bytes: queued_bytes.clone(),
            },
        });
        if joined.is_err() {
            return Err(JoinError::TooManyConnections);
        }
        *registry
            .connections_per_user
            .entry(user_id.to_string())
            .or_default() += 1;
        Ok(Connection {
            id: connection,
            user_id: user_id.to_string(),
            frames: receiver,
            closing: closing_receiver,
            queued_bytes,
            room,
            rooms: self.clone(),
        })
    }

    fn spawn_room(self: &Arc<Self>, document_id: &str) -> mpsc::Sender<Command> {
        let (sender, receiver) = mpsc::channel(COMMAND_QUEUE);
        let rooms = self.clone();
        let id = document_id.to_string();
        let own_sender = sender.clone();
        self.tasks.spawn(async move {
            RoomTask::run(id, rooms, own_sender, receiver).await;
        });
        sender
    }

    /// Removes a room that has nothing left to do. `false` if commands arrived meanwhile.
    fn remove_if_idle(
        &self,
        document_id: &str,
        room: &mpsc::Sender<Command>,
        commands: &mpsc::Receiver<Command>,
    ) -> bool {
        let mut registry = locked(&self.registry);
        if !commands.is_empty() {
            return false;
        }
        if registry
            .rooms
            .get(document_id)
            .is_some_and(|registered| registered.same_channel(room))
        {
            registry.rooms.remove(document_id);
        }
        true
    }

    fn release_connection(&self, user_id: &str) {
        let mut registry = locked(&self.registry);
        if let Some(count) = registry.connections_per_user.get_mut(user_id) {
            *count = count.saturating_sub(1);
            if *count == 0 {
                registry.connections_per_user.remove(user_id);
            }
        }
    }
}

/// A client's place in a room. Dropping it leaves the room.
pub struct Connection {
    id: u64,
    user_id: String,
    frames: mpsc::Receiver<Bytes>,
    closing: watch::Receiver<CloseReason>,
    queued_bytes: Arc<AtomicUsize>,
    room: mpsc::Sender<Command>,
    rooms: Arc<Rooms>,
}

impl Connection {
    /// The next thing to do. Safe to cancel, for use in `select!`.
    pub async fn next(&mut self) -> Outbound {
        tokio::select! {
            biased;
            frame = self.frames.recv() => match frame {
                Some(frame) => {
                    self.queued_bytes.fetch_sub(frame.len(), Ordering::SeqCst);
                    Outbound::Frame(frame)
                }
                None => self.end(),
            },
            _ = self.closing.changed() => self.end(),
        }
    }

    fn end(&self) -> Outbound {
        match self.closing.borrow().clone() {
            Some((code, reason)) => Outbound::Close(code, reason),
            None => Outbound::Gone,
        }
    }

    /// Passes a client's frame on. `false` if the room is gone.
    pub async fn send_frame(&self, data: Bytes) -> bool {
        let connection = self.id;
        self.room
            .send(Command::Frame { connection, data })
            .await
            .is_ok()
    }
}

impl Drop for Connection {
    fn drop(&mut self) {
        self.rooms.release_connection(&self.user_id);
        // A full queue is fine: the room also finds connections whose receiver is gone.
        let _ = self.room.try_send(Command::Leave {
            connection: self.id,
        });
    }
}

/// Others' editors decode this, so nothing else gets through to them.
fn is_cursor(cursor: &Value) -> bool {
    ["anchor", "head"]
        .iter()
        .all(|end| cursor.get(end).is_some_and(Value::is_object))
}

struct RoomConnection {
    channel: ConnectionChannel,
    user_id: String,
    name: String,
    color_index: u64,
    client_id: Option<ClientID>,
}

/// Keeps `Rooms::open_state_bytes` right, also when a room panics.
struct StateAccount {
    rooms: Arc<Rooms>,
    bytes: usize,
}

impl StateAccount {
    fn set(&mut self, bytes: usize) {
        self.rooms
            .open_state_bytes
            .fetch_add(bytes, Ordering::SeqCst);
        self.rooms
            .open_state_bytes
            .fetch_sub(self.bytes, Ordering::SeqCst);
        self.bytes = bytes;
    }
}

impl Drop for StateAccount {
    fn drop(&mut self) {
        self.rooms
            .open_state_bytes
            .fetch_sub(self.bytes, Ordering::SeqCst);
    }
}

/// Whether the room goes on after a command or tick.
enum Next {
    Continue,
    /// Ends the room without saving what is unsaved: clients push it back when they reconnect.
    Stop,
}

struct RoomTask {
    id: String,
    rooms: Arc<Rooms>,
    sender: mpsc::Sender<Command>,
    awareness: Awareness,
    text: TextRef,
    connections: HashMap<u64, RoomConnection>,
    client_owners: HashMap<ClientID, u64>,
    /// Filled by the update observer, emptied after each transaction.
    integrated: Arc<Mutex<Vec<Vec<u8>>>>,
    state_version: i64,
    account: StateAccount,
    /// State size at the last encoding plus what arrived since: an upper bound.
    estimated_state_bytes: usize,
    dirty: bool,
    saving: bool,
    first_unsaved_at: Option<Instant>,
    last_change_at: Option<Instant>,
    failed_saves: usize,
    retry_at: Option<Instant>,
    save_failing: bool,
    last_banner_at: Instant,
    last_keep_alive_at: Instant,
    pending_since: Option<Instant>,
    /// The connection whose update caused `pending_since`.
    pending_from: Option<u64>,
    /// The text of the newest version, at first the text as loaded.
    versioned_text: String,
    /// Whether the text as loaded has been kept, so that a text wiped now has a way back.
    loaded_text_kept: bool,
    last_version_at: Instant,
    editors: BTreeSet<String>,
    stopping: bool,
    /// Ending without saving, once a running save is done. A successor reading the document
    /// before that would save onto a version that is about to change.
    discarding: bool,
}

impl RoomTask {
    async fn run(
        id: String,
        rooms: Arc<Rooms>,
        sender: mpsc::Sender<Command>,
        mut commands: mpsc::Receiver<Command>,
    ) {
        let mut room = match Self::open(&id, &rooms, &sender).await {
            Ok(room) => room,
            Err((code, reason)) => {
                Self::refuse_waiting(&mut commands, code, &reason);
                rooms.remove_if_idle(&id, &sender, &commands);
                return;
            }
        };
        let token = rooms.shutdown_token();
        let mut tick = tokio::time::interval(TICK);
        loop {
            let next = tokio::select! {
                _ = token.cancelled(), if !room.stopping => {
                    room.stopping = true;
                    Next::Continue
                }
                command = commands.recv() => match command {
                    Some(command) => room.handle(command),
                    None => Next::Stop,
                },
                _ = tick.tick() => room.on_tick(),
            };
            if matches!(next, Next::Stop) {
                room.close_all(CLOSE_RESTART, "Der Raum wird neu geöffnet.");
                room.discarding = true;
            }
            if room.discarding {
                if !room.saving {
                    rooms.remove_if_idle(&id, &sender, &commands);
                    Self::refuse_waiting(&mut commands, CLOSE_RESTART, "Bitte neu verbinden.");
                    break;
                }
                continue;
            }
            if room.finished() {
                if room.stopping {
                    room.close_all(CLOSE_RESTART, "Der Server startet neu.");
                }
                if rooms.remove_if_idle(&id, &sender, &commands) {
                    break;
                }
            }
        }
    }

    async fn open(
        id: &str,
        rooms: &Arc<Rooms>,
        sender: &mpsc::Sender<Command>,
    ) -> Result<Self, (u16, String)> {
        let stored = rooms.store.load_state(id.to_string()).await;
        let loaded = match stored {
            Ok(Some(loaded)) => loaded,
            Ok(None) => return Err((CLOSE_DELETED, "Dieses Dokument gibt es nicht mehr.".into())),
            Err(e) => {
                eprintln!("document room {id}: loading failed: {e:#}");
                return Err((CLOSE_ROOM_FAILED, "Datenbankfehler".into()));
            }
        };
        let state_bytes = loaded.state.len();
        let state_version = loaded.state_version;
        // A state at its cap takes half a second to load.
        let doc = tokio::task::spawn_blocking(move || load_doc(&loaded.state))
            .await
            .map_err(anyhow::Error::from)
            .and_then(|doc| doc);
        let doc = match doc {
            Ok(doc) => doc,
            Err(e) => {
                // Never overwrite what could still be repaired by hand.
                eprintln!("document room {id}: stored state is damaged: {e:#}");
                let reason = "Der gespeicherte Stand ist beschädigt.".to_string();
                return Err((CLOSE_DAMAGED, reason));
            }
        };

        let text = doc.get_or_insert_text(TEXT_ROOT);
        let versioned_text = text.get_string(&doc.transact());
        let integrated = Arc::new(Mutex::new(Vec::new()));
        let observed = integrated.clone();
        let subscription = doc.observe_update_v1("broadcast", move |_, event| {
            locked(&observed).push(event.update.clone());
        });
        if let Err(e) = subscription {
            eprintln!("document room {id}: observing failed: {e:#}");
            return Err((CLOSE_ROOM_FAILED, "Interner Fehler".into()));
        }

        let mut account = StateAccount {
            rooms: rooms.clone(),
            bytes: 0,
        };
        account.set(state_bytes);
        let now = Instant::now();
        Ok(Self {
            id: id.to_string(),
            rooms: rooms.clone(),
            sender: sender.clone(),
            awareness: Awareness::new(doc),
            text,
            connections: HashMap::new(),
            client_owners: HashMap::new(),
            integrated,
            state_version,
            account,
            estimated_state_bytes: state_bytes,
            dirty: false,
            saving: false,
            first_unsaved_at: None,
            last_change_at: None,
            failed_saves: 0,
            retry_at: None,
            save_failing: false,
            last_banner_at: now,
            last_keep_alive_at: now,
            pending_since: None,
            pending_from: None,
            versioned_text,
            loaded_text_kept: false,
            last_version_at: now,
            editors: BTreeSet::new(),
            stopping: false,
            discarding: false,
        })
    }

    /// Answers those who waited for a room that could not open.
    fn refuse_waiting(commands: &mut mpsc::Receiver<Command>, code: u16, reason: &str) {
        while let Ok(command) = commands.try_recv() {
            if let Command::Join { channel, .. } = command {
                channel.close(code, reason);
            }
        }
    }

    fn finished(&self) -> bool {
        let all_gone = self.connections.is_empty() || self.stopping;
        all_gone && !self.dirty && !self.saving
    }

    fn handle(&mut self, command: Command) -> Next {
        match command {
            Command::Join { channel, .. } if self.discarding => {
                channel.close(CLOSE_RESTART, "Bitte neu verbinden.");
            }
            Command::Join {
                connection,
                user_id,
                name,
                channel,
            } => self.join(connection, user_id, name, channel),
            Command::Frame { connection, data } => self.frame(connection, data),
            Command::Leave { connection } => self.leave(connection),
            Command::Deleted => {
                self.close_all(CLOSE_DELETED, "Dieses Dokument wurde gelöscht.");
                return Next::Stop;
            }
            Command::SaveDone(result, text) => return self.save_done(result, text),
        }
        Next::Continue
    }

    fn join(&mut self, connection: u64, user_id: String, name: String, channel: ConnectionChannel) {
        self.connections.insert(
            connection,
            RoomConnection {
                channel,
                user_id,
                name,
                color_index: connection % USER_COLORS,
                client_id: None,
            },
        );
        // Without this a client's local text never reaches the server.
        let state_vector = self.awareness.doc().transact().state_vector();
        self.send(
            connection,
            &Message::Sync(SyncMessage::SyncStep1(state_vector)),
        );
        match self.awareness.update() {
            Ok(update) if !update.clients.is_empty() => {
                self.send(connection, &Message::Awareness(update))
            }
            Ok(_) => {}
            Err(e) => eprintln!("document room {}: awareness: {e}", self.id),
        }
    }

    fn leave(&mut self, connection: u64) {
        let Some(left) = self.connections.remove(&connection) else {
            return;
        };
        if let Some(client_id) = left.client_id {
            if self.client_owners.get(&client_id) == Some(&connection) {
                self.client_owners.remove(&client_id);
                self.awareness.remove_state(client_id);
                if let Ok(update) = self.awareness.update_with_clients([client_id]) {
                    self.broadcast(None, Message::Awareness(update).encode_v1().into());
                }
            }
        }
        if self.save_is_due(Instant::now()) {
            self.start_save();
        }
    }

    fn send(&mut self, connection: u64, message: &Message) {
        let frame: Bytes = message.encode_v1().into();
        let delivered = self
            .connections
            .get(&connection)
            .is_none_or(|target| target.channel.enqueue(&frame));
        if !delivered {
            self.close(
                connection,
                CLOSE_RESTART,
                "Die Verbindung kommt nicht nach.",
            );
        }
    }

    fn broadcast(&mut self, except: Option<u64>, frame: Bytes) {
        let lagging: Vec<u64> = self
            .connections
            .iter()
            .filter(|(id, _)| Some(**id) != except)
            .filter(|(_, target)| !target.channel.enqueue(&frame))
            .map(|(id, _)| *id)
            .collect();
        for connection in lagging {
            // A skipped update would leave this client out of step: it resyncs on reconnect.
            self.close(
                connection,
                CLOSE_RESTART,
                "Die Verbindung kommt nicht nach.",
            );
        }
    }

    fn close(&mut self, connection: u64, code: u16, reason: &str) {
        if let Some(target) = self.connections.get(&connection) {
            target.channel.close(code, reason);
        }
        self.leave(connection);
    }

    fn close_all(&mut self, code: u16, reason: &str) {
        for target in self.connections.values() {
            target.channel.close(code, reason);
        }
        self.connections.clear();
    }

    fn frame(&mut self, connection: u64, data: Bytes) {
        if !self.connections.contains_key(&connection) {
            return;
        }
        // Not `DefaultProtocol` or `MessageReader`: they swallow truncated frames.
        let message = match Message::decode_v1(&data) {
            Ok(message) => message,
            Err(e) => {
                eprintln!("document room {}: undecodable frame: {e}", self.id);
                self.close(connection, CLOSE_BAD_MESSAGE, "Ungültige Nachricht.");
                return;
            }
        };
        match message {
            Message::Sync(SyncMessage::SyncStep1(state_vector)) => {
                let update = self
                    .awareness
                    .doc()
                    .transact()
                    .encode_state_as_update_v1(&state_vector);
                self.send(connection, &Message::Sync(SyncMessage::SyncStep2(update)));
            }
            Message::Sync(SyncMessage::SyncStep2(update) | SyncMessage::Update(update)) => {
                self.apply_update(connection, &update);
            }
            Message::Awareness(update) => self.awareness_update(connection, update),
            Message::AwarenessQuery => match self.awareness.update() {
                Ok(update) => self.send(connection, &Message::Awareness(update)),
                Err(e) => eprintln!("document room {}: awareness: {e}", self.id),
            },
            Message::Auth(_) | Message::Custom(..) => {}
        }
    }

    fn apply_update(&mut self, connection: u64, bytes: &[u8]) {
        if bytes.len() > MAX_UPDATE_BYTES {
            self.close(connection, CLOSE_TOO_LARGE, "Die Änderung ist zu groß.");
            return;
        }
        if self.would_exceed_state_cap(bytes.len()) {
            eprintln!("document room {}: state cap reached", self.id);
            self.close(connection, CLOSE_TOO_LARGE, "Das Dokument ist zu groß.");
            return;
        }
        let update = match Update::decode_v1(bytes) {
            Ok(update) => update,
            Err(e) => {
                eprintln!("document room {}: undecodable update: {e}", self.id);
                self.close(connection, CLOSE_BAD_MESSAGE, "Ungültige Änderung.");
                return;
            }
        };
        let applied = self.awareness.doc().transact_mut().apply_update(update);
        if let Err(e) = applied {
            eprintln!("document room {}: update not applied: {e}", self.id);
            self.close(connection, CLOSE_BAD_MESSAGE, "Ungültige Änderung.");
            return;
        }
        self.estimated_state_bytes += bytes.len();

        let integrated = std::mem::take(&mut *locked(&self.integrated));
        if !integrated.is_empty() {
            self.note_change(connection);
        }
        for update in integrated {
            let frame = Message::Sync(SyncMessage::Update(update)).encode_v1();
            self.broadcast(Some(connection), frame.into());
        }

        let pending = self.awareness.doc().transact().has_missing_updates();
        match (pending, self.pending_since) {
            (true, None) => {
                self.pending_since = Some(Instant::now());
                self.pending_from = Some(connection);
            }
            (false, Some(_)) => self.pending_since = None,
            _ => {}
        }
    }

    fn would_exceed_state_cap(&mut self, incoming: usize) -> bool {
        if self.estimated_state_bytes + incoming <= MAX_STATE_BYTES {
            return false;
        }
        let exact = self
            .awareness
            .doc()
            .transact()
            .encode_state_as_update_v1(&StateVector::default())
            .len();
        self.estimated_state_bytes = exact;
        exact + incoming > MAX_STATE_BYTES
    }

    fn note_change(&mut self, connection: u64) {
        if !self.loaded_text_kept {
            self.loaded_text_kept = true;
            self.last_version_at = Instant::now();
            self.add_version(self.versioned_text.clone());
        }
        let now = Instant::now();
        self.dirty = true;
        self.last_change_at = Some(now);
        self.first_unsaved_at.get_or_insert(now);
        if let Some(editor) = self.connections.get(&connection) {
            self.editors.insert(editor.user_id.clone());
        }
    }

    fn awareness_update(&mut self, connection: u64, update: AwarenessUpdate) {
        let mut kept = HashMap::new();
        for (client_id, entry) in update.clients {
            if let Some(entry) = self.checked_awareness(connection, client_id, entry) {
                kept.insert(client_id, entry);
            }
        }
        if kept.is_empty() {
            return;
        }
        let summary = self
            .awareness
            .apply_update_summary(AwarenessUpdate { clients: kept });
        match summary {
            Ok(Some(summary)) => match self.awareness.update_with_clients(summary.all_changes()) {
                // Also to the sender: its name and colour come from here.
                Ok(update) => self.broadcast(None, Message::Awareness(update).encode_v1().into()),
                Err(e) => eprintln!("document room {}: awareness: {e}", self.id),
            },
            Ok(None) => {}
            Err(e) => eprintln!("document room {}: awareness: {e}", self.id),
        }
    }

    /// What a client may say about itself. Foreign entries are dropped silently: clients
    /// rebroadcast what they hear.
    fn checked_awareness(
        &mut self,
        connection: u64,
        client_id: ClientID,
        mut entry: AwarenessUpdateEntry,
    ) -> Option<AwarenessUpdateEntry> {
        if client_id.get() == SERVER_CLIENT_ID || entry.json.len() > MAX_AWARENESS_ENTRY_BYTES {
            return None;
        }
        let is_null = entry.json.as_ref() == "null";
        let sender = self.connections.get(&connection)?;
        match sender.client_id {
            Some(own) if own == client_id => {}
            Some(_) => return None,
            None if is_null => return None,
            None => {
                if let Some(previous) = self.client_owners.get(&client_id).copied() {
                    let holder = self.connections.get(&previous).map(|c| c.user_id.as_str());
                    if holder != Some(sender.user_id.as_str()) {
                        return None;
                    }
                    if let Some(holder) = self.connections.get_mut(&previous) {
                        holder.client_id = None;
                    }
                }
                self.client_owners.insert(client_id, connection);
                self.connections.get_mut(&connection)?.client_id = Some(client_id);
            }
        }
        if is_null {
            return Some(entry);
        }
        let claimed: Value = serde_json::from_str(&entry.json).ok()?;
        let sender = self.connections.get(&connection)?;
        let cursor = claimed.get("cursor").filter(|cursor| is_cursor(cursor));
        let checked = json!({
            "user": { "name": sender.name, "colorIndex": sender.color_index },
            "cursor": cursor.cloned().unwrap_or(Value::Null),
        });
        entry.json = checked.to_string().into();
        // A returning client resends an old clock: without this it stays invisible for 30 s.
        if let Some((clock, _)) = self.awareness.meta(client_id) {
            if self.awareness.state::<Value>(client_id).is_none() && entry.clock <= clock {
                entry.clock = clock + 1;
            }
        }
        Some(entry)
    }

    fn on_tick(&mut self) -> Next {
        let now = Instant::now();
        let gone: Vec<u64> = self
            .connections
            .iter()
            .filter(|(_, target)| target.channel.frames.is_closed())
            .map(|(id, _)| *id)
            .collect();
        for connection in gone {
            self.leave(connection);
        }

        if now.duration_since(self.last_keep_alive_at) >= KEEP_ALIVE {
            self.last_keep_alive_at = now;
            let empty = AwarenessUpdate {
                clients: HashMap::new(),
            };
            self.broadcast(None, Message::Awareness(empty).encode_v1().into());
        }
        if self.save_failing && now.duration_since(self.last_banner_at) >= BANNER_REFRESH {
            self.set_banner(true);
        }

        if let Some(since) = self.pending_since {
            if now.duration_since(since) >= PENDING_GRACE {
                eprintln!("document room {}: update stays pending, reopening", self.id);
                if let Some(connection) = self.pending_from {
                    // Honest clients resolve this in one round trip, so it stops here.
                    self.close(connection, CLOSE_BAD_MESSAGE, "Ungültige Änderung.");
                }
                return Next::Stop;
            }
        }
        if self.save_is_due(now) {
            self.start_save();
        }
        Next::Continue
    }

    fn save_is_due(&self, now: Instant) -> bool {
        if !self.dirty || self.saving || self.pending_since.is_some() {
            return false;
        }
        if self.stopping {
            return true;
        }
        if let Some(retry_at) = self.retry_at {
            return now >= retry_at;
        }
        if self.connections.is_empty() {
            return true;
        }
        let paused = self
            .last_change_at
            .is_some_and(|at| now.duration_since(at) >= SAVE_AFTER_PAUSE);
        let overdue = self
            .first_unsaved_at
            .is_some_and(|at| now.duration_since(at) >= SAVE_AT_LATEST);
        paused || overdue
    }

    fn start_save(&mut self) {
        // yrs panics encoding some crafted pending updates; `save_is_due` keeps those away,
        // and a panic would end this room only.
        let (state, content) = {
            let transaction = self.awareness.doc().transact();
            (
                transaction.encode_state_as_update_v1(&StateVector::default()),
                self.text.get_string(&transaction),
            )
        };

        self.estimated_state_bytes = state.len();
        self.account.set(state.len());
        self.dirty = false;
        self.first_unsaved_at = None;
        self.retry_at = None;
        self.saving = true;

        let saved = SavedState {
            state,
            title: derive_title(&content),
            content: content.clone(),
            state_version: self.state_version,
        };
        let store = self.rooms.store.clone();
        let id = self.id.clone();
        let sender = self.sender.clone();
        self.rooms.tasks.spawn(async move {
            let result = Self::save(store.as_ref(), id, saved).await;
            let _ = sender.send(Command::SaveDone(result, content)).await;
        });
    }

    async fn save(
        store: &dyn DocumentStore,
        id: String,
        saved: SavedState,
    ) -> anyhow::Result<SaveEnd> {
        match store.save_state(id.clone(), saved).await? {
            SaveOutcome::Saved { state_version } => Ok(SaveEnd::Saved { state_version }),
            SaveOutcome::Gone => Ok(match store.load_state(id).await? {
                Some(stored) => SaveEnd::Behind {
                    state_version: stored.state_version,
                },
                None => SaveEnd::Deleted,
            }),
        }
    }

    fn add_version(&mut self, content: String) {
        let version = NewVersion {
            content,
            editors: std::mem::take(&mut self.editors).into_iter().collect(),
        };
        let store = self.rooms.store.clone();
        let id = self.id.clone();
        self.rooms.tasks.spawn(async move {
            if let Err(e) = store.add_version(id.clone(), version).await {
                eprintln!("document room {id}: saving a version failed: {e:#}");
            }
        });
    }

    fn save_done(&mut self, result: anyhow::Result<SaveEnd>, text: String) -> Next {
        self.saving = false;
        if self.discarding {
            return Next::Continue;
        }
        match result {
            Ok(SaveEnd::Saved { state_version }) => {
                self.state_version = state_version;
                self.failed_saves = 0;
                if self.save_failing {
                    self.save_failing = false;
                    self.set_banner(false);
                }
                let closing = self.connections.is_empty() || self.stopping;
                let version_due = self.last_version_at.elapsed() >= VERSION_INTERVAL || closing;
                if version_due && self.versioned_text != text {
                    self.versioned_text = text.clone();
                    self.last_version_at = Instant::now();
                    self.add_version(text);
                }
                Next::Continue
            }
            Ok(SaveEnd::Behind { state_version }) => {
                eprintln!(
                    "document room {}: stored version {state_version} is ahead, saving again",
                    self.id
                );
                self.state_version = state_version;
                self.dirty = true;
                Next::Continue
            }
            Ok(SaveEnd::Deleted) => {
                self.close_all(CLOSE_DELETED, "Dieses Dokument gibt es nicht mehr.");
                Next::Stop
            }
            Err(e) => {
                let size = text.len();
                eprintln!(
                    "document room {}: save of {size} bytes failed: {e:#}",
                    self.id
                );
                self.dirty = true;
                let wait = SAVE_RETRIES[self.failed_saves.min(SAVE_RETRIES.len() - 1)];
                self.failed_saves += 1;
                self.retry_at = Some(Instant::now() + wait);
                self.save_failing = true;
                self.set_banner(true);
                Next::Continue
            }
        }
    }

    /// Shown in every editor through a server-owned awareness entry.
    fn set_banner(&mut self, failing: bool) {
        self.last_banner_at = Instant::now();
        let client_id = ClientID::new(SERVER_CLIENT_ID);
        let clock = self.awareness.meta(client_id).map_or(0, |meta| meta.0) + 1;
        let json = if failing {
            r#"{"saveFailed":true}"#
        } else {
            "null"
        };
        let mut clients = HashMap::new();
        clients.insert(
            client_id,
            AwarenessUpdateEntry {
                clock,
                json: json.into(),
            },
        );
        let update = AwarenessUpdate { clients };
        let frame = Message::Awareness(update.clone()).encode_v1();
        if let Err(e) = self.awareness.apply_update(update) {
            eprintln!("document room {}: awareness: {e}", self.id);
        }
        self.broadcast(None, frame.into());
    }
}
