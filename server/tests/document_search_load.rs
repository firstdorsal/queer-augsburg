//! The document search with hundreds of documents, the measurement the documents plan made on
//! MongoDB (500 documents: 22–26 ms, `.plans/documents/plan/plan.md` "Data model"), now on
//! Postgres through the handler's own path (`run_search`): rows stream into the matcher one at
//! a time, `CONCURRENT_SEARCHES` searches share the server's pool, and the next one waits for a
//! slot or gives up after `SEARCH_QUEUE_TIMEOUT`.
//!
//! The times printed with `--nocapture` are the measurement (recorded in
//! `.plans/postgres-own-auth/issue.md`); the asserted bounds only catch a regression by an order
//! of magnitude, as a shared runner is noisy. `TEST_DATABASE_URL` names the server, and each
//! test has a schema of its own there (`db_support`), as in the other database tests; CI always
//! sets it.

// Unsafe only where it is allowed below: the one `ioctl` of the Linux-only row-hold proxy.
#![deny(unsafe_code)]

use backend::db::DB;
use backend::document_search::{best_hits, compile_terms, match_document, parse_query};
use backend::methods::documents::{run_search, CONCURRENT_SEARCHES, SEARCH_QUEUE_TIMEOUT};
use backend::state::AppState;
use backend::types::WikiDocumentHit;
use futures_util::TryStreamExt;
use rand::rngs::StdRng;
use rand::{Rng, SeedableRng};
use sqlx::postgres::PgConnection;
use sqlx::Connection;
use std::collections::HashMap;
use std::sync::Arc;
use std::time::{Duration, Instant};

mod db_support;
mod drop_guard;
use db_support::TestSchema;

/// What the documents plan measured with.
const DOCUMENTS: usize = 500;
/// Every 25th document mentions the charter by its full name, nothing else does.
const PLANTED_EVERY: usize = 25;
const PLANTED_TERM: &str = "Vereinssatzung";
/// Searches per query for the timing; the median is reported.
const REPEATS: usize = 5;
/// A search over 500 documents of this size took 22–26 ms on Mongo; ten times that is a
/// regression even on a slow runner, not noise.
const SEARCH_BOUND: Duration = Duration::from_millis(300);

/// A schema of its own with the server's own pool (`DB::connect`: size and acquire timeout
/// as in production) and the server's `AppState` (`AppState::new`, as `main`).
struct TestServer {
    state: AppState,
    schema: TestSchema,
}

impl TestServer {
    async fn new() -> Option<Self> {
        let schema = TestSchema::new().await?;
        let db = DB::connect(schema.url().as_str()).await.unwrap();
        db.migrate().await.unwrap();
        let state = AppState::new(Arc::new(db));
        Some(Self { state, schema })
    }

    async fn drop(self) {
        self.state.db.pool.close().await;
        drop(self.state);
        self.schema.drop().await;
    }
}

/// A document as generated and as stored: the expected answer is computed from this copy
/// with the same matcher the handler uses.
struct Generated {
    id: String,
    title: String,
    content: String,
}

/// Words of minutes and notes, with the letters the matcher has alternations for.
const WORDS: &[&str] = &[
    "Verein",
    "Vorstand",
    "Protokoll",
    "Sitzung",
    "Mitglieder",
    "Beschluss",
    "Kasse",
    "Straße",
    "Größe",
    "Änderung",
    "Übung",
    "queer",
    "Augsburg",
    "Treffen",
    "Gruppe",
    "Ort",
    "Datum",
    "Antrag",
    "Abstimmung",
    "einstimmig",
    "angenommen",
    "und",
    "die",
    "der",
    "das",
    "wird",
    "haben",
    "für",
    "mit",
    "nicht",
    "auch",
    "über",
    "zum",
    "beim",
    "Café",
    "Regenbogen",
    "Pride",
    "Workshop",
    "Jugend",
    "Beratung",
    "Veranstaltung",
    "Finanzen",
    "Spenden",
    "Förderung",
    "Satzung",
    "Mitgliedschaft",
    "Beitrag",
    "Rückblick",
    "Ausblick",
    "Termin",
    "Stadt",
    "Raum",
    "Miete",
    "Plakat",
    "Newsletter",
    "Anmeldung",
    "Fahrt",
    "Stand",
];

/// Text of `chars` characters: paragraphs of sentences, a heading now and then, Markdown as
/// the editor writes it. `index` makes the title unique, so the ranking has no ties.
fn generate(rng: &mut StdRng, index: usize, chars: usize) -> (String, String) {
    let title = format!(
        "{} {} Nr. {index}",
        WORDS[rng.gen_range(0..WORDS.len())],
        WORDS[rng.gen_range(0..WORDS.len())]
    );
    let mut text = format!("# {title}\n\n");
    let mut words_in_sentence = 0;
    let mut sentences_in_paragraph = 0;
    while text.chars().count() < chars {
        if words_in_sentence == 0 && sentences_in_paragraph == 0 && rng.gen_ratio(1, 6) {
            text.push_str(&format!("## {}\n\n", WORDS[rng.gen_range(0..WORDS.len())]));
        }
        text.push_str(WORDS[rng.gen_range(0..WORDS.len())]);
        words_in_sentence += 1;
        if words_in_sentence >= rng.gen_range(6..16) {
            text.push('.');
            words_in_sentence = 0;
            sentences_in_paragraph += 1;
            if sentences_in_paragraph >= rng.gen_range(3..8) {
                text.push_str("\n\n");
                sentences_in_paragraph = 0;
            } else {
                text.push(' ');
            }
        } else {
            text.push(' ');
        }
    }
    (title, text)
}

/// 500 documents of 1 000 to 12 000 characters, the size of real minutes and notes, with the
/// planted term in every 25th. Returns them with their ids and the bytes stored.
async fn seed(db: &DB, chars: impl Fn(&mut StdRng) -> usize) -> (Vec<Generated>, usize) {
    let mut rng = StdRng::seed_from_u64(5);
    let mut documents = Vec::with_capacity(DOCUMENTS);
    let mut bytes = 0;
    let started = Instant::now();
    for index in 0..DOCUMENTS {
        let length = chars(&mut rng);
        let (title, mut content) = generate(&mut rng, index, length);
        if index % PLANTED_EVERY == 0 {
            let at = content.len() / 2;
            let at = (at..content.len())
                .find(|&at| content.is_char_boundary(at))
                .unwrap();
            content.insert_str(at, &format!(" {PLANTED_TERM} "));
        }
        bytes += content.len();
        let stored = db.create_document(&content, vec![], "load").await.unwrap();
        assert_eq!(stored.title, title);
        documents.push(Generated {
            id: stored._id,
            title,
            content,
        });
    }
    eprintln!(
        "seeded {DOCUMENTS} documents, {:.1} MB of text, in {:.1} s",
        bytes as f64 / 1e6,
        started.elapsed().as_secs_f64()
    );
    (documents, bytes)
}

/// The answer the handler must give, from the generated copy.
fn expected(documents: &[Generated], query: &str) -> Vec<WikiDocumentHit> {
    let patterns = compile_terms(&parse_query(query).unwrap()).unwrap();
    let hits: Vec<_> = documents
        .iter()
        .filter_map(|document| {
            match_document(&document.title, &document.content, &patterns)
                .map(|found| (found, document.title.clone(), document.id.clone()))
        })
        .collect();
    let titles: HashMap<&str, &str> = documents
        .iter()
        .map(|document| (document.id.as_str(), document.title.as_str()))
        .collect();
    best_hits(hits)
        .into_iter()
        .map(|(found, id)| WikiDocumentHit {
            title: titles[id.as_str()].to_string(),
            _id: id,
            snippet: found.snippet,
        })
        .collect()
}

fn same_hits(actual: &[WikiDocumentHit], expected: &[WikiDocumentHit]) -> bool {
    actual.len() == expected.len()
        && actual
            .iter()
            .zip(expected)
            .all(|(a, e)| a._id == e._id && a.title == e.title && a.snippet == e.snippet)
}

async fn search(state: &AppState, query: &str) -> Vec<WikiDocumentHit> {
    run_search(state, &parse_query(query).unwrap())
        .await
        .unwrap()
}

/// `REPEATS` searches; the median time and the hits of the last one.
async fn timed(state: &AppState, query: &str) -> (Duration, Vec<WikiDocumentHit>) {
    let mut times = Vec::with_capacity(REPEATS);
    let mut hits = Vec::new();
    for _ in 0..REPEATS {
        let started = Instant::now();
        hits = search(state, query).await;
        times.push(started.elapsed());
    }
    times.sort();
    let median = times[REPEATS / 2];
    eprintln!(
        "search {query:?}: {} hits, median {:.1} ms (min {:.1}, max {:.1})",
        hits.len(),
        median.as_secs_f64() * 1e3,
        times[0].as_secs_f64() * 1e3,
        times[REPEATS - 1].as_secs_f64() * 1e3
    );
    (median, hits)
}

/// The database's share of a search: the stream drained without matching, `REPEATS` times.
async fn timed_read(db: &DB) -> Duration {
    let mut times = Vec::with_capacity(REPEATS);
    for _ in 0..REPEATS {
        let started = Instant::now();
        let mut stream = db.searchable_documents().await.unwrap();
        let mut count = 0;
        while stream.try_next().await.unwrap().is_some() {
            count += 1;
        }
        assert_eq!(count, DOCUMENTS);
        times.push(started.elapsed());
    }
    times.sort();
    eprintln!(
        "reading all {DOCUMENTS} documents without matching: median {:.1} ms (min {:.1}, max {:.1})",
        times[REPEATS / 2].as_secs_f64() * 1e3,
        times[0].as_secs_f64() * 1e3,
        times[REPEATS - 1].as_secs_f64() * 1e3
    );
    times[REPEATS / 2]
}

/// The measurement: a hit in every 25th document, a term that occurs nowhere (every byte is
/// read), and two common terms. Every answer equals the one computed from the generated copy.
#[tokio::test]
async fn five_hundred_documents_are_searched_in_milliseconds() {
    let Some(server) = TestServer::new().await else {
        return;
    };
    let (documents, _) = seed(&server.state.db, |rng| rng.gen_range(1_000..12_000)).await;

    assert!(timed_read(&server.state.db).await < SEARCH_BOUND);
    for query in ["vereinssatzung", "niemand", "vorstand beschluss", "strasse"] {
        let (median, hits) = timed(&server.state, query).await;
        let wanted = expected(&documents, query);
        assert!(
            same_hits(&hits, &wanted),
            "{query}: hits differ from the generated copy"
        );
        assert!(
            median < SEARCH_BOUND,
            "{query}: median {median:?} is above {SEARCH_BOUND:?}"
        );
    }
    let planted = search(&server.state, PLANTED_TERM).await;
    assert_eq!(planted.len(), DOCUMENTS / PLANTED_EVERY);
    assert_eq!(search(&server.state, "niemand").await.len(), 0);

    server.drop().await;
}

// Searches run side by side: one slot would make every search wait for the one before it.
const _: () = assert!(
    CONCURRENT_SEARCHES >= 2,
    "one slot makes every search wait for the one before it"
);

/// The statement `DB::searchable_documents` sends, as `pg_stat_activity` shows it.
const SEARCH_STATEMENT: &str = "SELECT _id, title, content FROM documents ";
/// How long the test waits for a state that must come; reached only when it never does.
const DEADLINE: Duration = Duration::from_secs(60);

/// Searches of the test whose statement waits for a lock, from `pg_stat_activity`.
async fn searches_waiting_for_the_lock(watcher: &mut PgConnection, schema: &TestSchema) -> usize {
    let waiting: i64 = sqlx::query_scalar(
        "SELECT count(*) FROM pg_stat_activity \
         WHERE application_name = $1 AND wait_event_type = 'Lock' AND starts_with(query, $2)",
    )
    .bind(&schema.name)
    .bind(SEARCH_STATEMENT)
    .fetch_one(watcher)
    .await
    .unwrap();
    waiting as usize
}

/// More searches than slots while another connection holds the documents table: exactly
/// `CONCURRENT_SEARCHES` of them reach the database and wait there, one pooled connection
/// each; the others queue on the semaphore without a connection, so every other connection of
/// the pool still serves the rest of the server. Once the lock is gone every search answers
/// correctly. The outcome rests on states, not on timing: the lock keeps the searches where
/// they are until the test lets them go, and a poll for a state gives up only after
/// `DEADLINE`. One time bound is left: the queued searches wait under `SEARCH_QUEUE_TIMEOUT`
/// from the moment they are spawned, so everything up to the end of the drain has to fit into
/// it (it takes well under a second). Exceeding it fails the test; it cannot make it pass.
#[tokio::test]
async fn searches_queue_on_the_semaphore_and_leave_connections_for_the_rest() {
    let Some(server) = TestServer::new().await else {
        return;
    };
    let state = server.state.clone();
    assert_eq!(
        state.document_searches().available_permits(),
        CONCURRENT_SEARCHES,
        "the server's state has another number of search slots"
    );
    let pool_size = state.db.pool.options().get_max_connections() as usize;
    assert!(
        CONCURRENT_SEARCHES < pool_size,
        "{CONCURRENT_SEARCHES} searches would take the whole pool of {pool_size}"
    );
    let (documents, _) = seed(&state.db, |rng| rng.gen_range(1_000..12_000)).await;
    let wanted = expected(&documents, "satzung");
    // Every connection of the pool opened now, so nothing below waits for a login while the
    // queued searches' `SEARCH_QUEUE_TIMEOUT` runs.
    let mut warm = Vec::with_capacity(pool_size);
    for _ in 0..pool_size {
        warm.push(state.db.pool.acquire().await.unwrap());
    }
    drop(warm);

    let mut locker = server.schema.connection().await;
    let mut watcher = server.schema.connection().await;
    sqlx::query("BEGIN").execute(&mut locker).await.unwrap();
    sqlx::query("LOCK TABLE documents IN ACCESS EXCLUSIVE MODE")
        .execute(&mut locker)
        .await
        .unwrap();

    let spawn_search = || {
        let state = state.clone();
        tokio::spawn(async move { search(&state, "satzung").await })
    };
    // As many searches as there are slots: every one gets a slot and a connection, and its
    // statement waits for the lock. Fewer arriving means the slots are not used side by side.
    let running: Vec<_> = (0..CONCURRENT_SEARCHES).map(|_| spawn_search()).collect();
    let started = Instant::now();
    loop {
        let waiting = searches_waiting_for_the_lock(&mut watcher, &server.schema).await;
        assert!(
            waiting <= CONCURRENT_SEARCHES,
            "{waiting} searches in the database"
        );
        if waiting == CONCURRENT_SEARCHES {
            break;
        }
        assert!(
            started.elapsed() < DEADLINE,
            "only {waiting} of {CONCURRENT_SEARCHES} searches reached the database"
        );
        tokio::time::sleep(Duration::from_millis(20)).await;
    }
    assert_eq!(
        state.document_searches().available_permits(),
        0,
        "searches in the database without holding a slot"
    );

    // More searches than the pool has connections. They find no free slot and must wait for
    // one without taking a connection; one that took a connection would leave too few below.
    // This test runs on a current-thread runtime, so the yield lets each of them run up to the
    // point where it waits.
    let queued: Vec<_> = (0..pool_size).map(|_| spawn_search()).collect();
    tokio::task::yield_now().await;

    // The rest of the server: every connection the searches leave, all held at once, and on
    // the last one a request of the server's own.
    let free = pool_size - CONCURRENT_SEARCHES;
    let mut held = Vec::with_capacity(free - 1);
    for _ in 0..free - 1 {
        let mut connection = state.db.pool.acquire().await.unwrap();
        sqlx::query("SELECT 1")
            .execute(&mut *connection)
            .await
            .unwrap();
        held.push(connection);
    }
    assert!(state.db.get_places().await.unwrap().is_empty());
    drop(held);
    assert_eq!(
        searches_waiting_for_the_lock(&mut watcher, &server.schema).await,
        CONCURRENT_SEARCHES,
        "a queued search reached the database"
    );
    assert!(
        running
            .iter()
            .chain(&queued)
            .all(|handle| !handle.is_finished()),
        "a search returned while the documents were locked"
    );

    sqlx::query("COMMIT").execute(&mut locker).await.unwrap();
    for handle in running.into_iter().chain(queued) {
        assert!(same_hits(&handle.await.unwrap(), &wanted));
    }
    assert_eq!(
        state.document_searches().available_permits(),
        CONCURRENT_SEARCHES
    );
    locker.close().await.unwrap();
    watcher.close().await.unwrap();
    drop(state);

    server.drop().await;
}

/// The proxy test reads how much of a Unix socket its peer has read (`SIOCOUTQ`), which only
/// Linux answers for a Unix socket; elsewhere it is not built. CI runs on Linux.
#[cfg(target_os = "linux")]
mod row_hold {
    use super::*;
    use std::os::fd::{AsRawFd, RawFd};
    use std::sync::Mutex;
    use tokio::io::{AsyncReadExt, AsyncWriteExt};
    use tokio::net::{TcpStream, UnixListener, UnixStream};
    use tokio::sync::oneshot;
    use url::Url;

    /// Where `RowHold` stopped a result: every row of it handed to the client, its end not yet.
    struct Held {
        rows: usize,
        /// The proxy's end of the client's connection, open until `release` is sent.
        client: RawFd,
        release: oneshot::Sender<()>,
    }

    /// A proxy on a Unix socket in front of the test's database that stops the first result with
    /// rows right before its end: it hands over every `DataRow` and holds back the message after
    /// them (`CommandComplete`), and everything behind it, until the test releases it.
    struct RowHold {
        /// The database through the proxy, for `DB::connect`.
        url: String,
        held: oneshot::Receiver<Held>,
        proxy: tokio::task::JoinHandle<()>,
        _socket_dir: tempfile::TempDir,
    }

    impl RowHold {
        fn new(database_url: &Url) -> Self {
            let upstream = database_url.socket_addrs(|| Some(5432)).unwrap();
            // A socket path has at most 107 bytes (`sun_path`), and `TMPDIR` may be longer than
            // that alone, so the directory is a short one in `/tmp`, removed with `RowHold`.
            let socket_dir = tempfile::Builder::new()
                .prefix("qa-row-hold-")
                .tempdir_in("/tmp")
                .unwrap();
            let port = database_url.port().unwrap_or(5432);
            let listener =
                UnixListener::bind(socket_dir.path().join(format!(".s.PGSQL.{port}"))).unwrap();
            let mut url = database_url.clone();
            url.query_pairs_mut()
                .append_pair("host", socket_dir.path().to_str().unwrap())
                // The proxy reads the server's messages, so no SSLRequest and no TLS.
                .append_pair("sslmode", "disable");
            let (report, held) = oneshot::channel();
            let report = Arc::new(Mutex::new(Some(report)));
            let proxy = tokio::spawn(async move {
                while let Ok((client, _)) = listener.accept().await {
                    let server = TcpStream::connect(&upstream[..]).await.unwrap();
                    tokio::spawn(Self::relay(client, server, report.clone()));
                }
            });
            Self {
                url: url.to_string(),
                held,
                proxy,
                _socket_dir: socket_dir,
            }
        }

        /// Client to server as it comes; server to client message by message (a type byte, then
        /// a length that counts itself), holding the first result's end on the first connection
        /// that sends one.
        async fn relay(
            client: UnixStream,
            server: TcpStream,
            report: Arc<Mutex<Option<oneshot::Sender<Held>>>>,
        ) {
            let (mut client_read, mut client_write) = client.into_split();
            let (mut server_read, mut server_write) = server.into_split();
            tokio::spawn(async move {
                let _ = tokio::io::copy(&mut client_read, &mut server_write).await;
            });
            let mut buffer = Vec::new();
            let mut chunk = vec![0; 64 * 1024];
            let mut rows = 0;
            loop {
                while buffer.len() >= 5 {
                    let length = u32::from_be_bytes(buffer[1..5].try_into().unwrap()) as usize;
                    if buffer.len() < 1 + length {
                        break;
                    }
                    let message: Vec<u8> = buffer.drain(..1 + length).collect();
                    if message[0] == b'D' {
                        rows += 1;
                    } else if rows > 0 {
                        let report = report.lock().unwrap().take();
                        if let Some(report) = report {
                            let (release, released) = oneshot::channel();
                            let client = client_write.as_ref().as_raw_fd();
                            let held = Held {
                                rows,
                                client,
                                release,
                            };
                            if report.send(held).is_err() {
                                return;
                            }
                            // A test that gave up drops `release`; the result then goes on.
                            let _ = released.await;
                        }
                        rows = 0;
                    }
                    if client_write.write_all(&message).await.is_err() {
                        return;
                    }
                }
                match server_read.read(&mut chunk).await {
                    Ok(0) | Err(_) => return,
                    Ok(read) => buffer.extend_from_slice(&chunk[..read]),
                }
            }
        }
    }

    /// Bytes written into a Unix socket that its peer has not read yet: `SIOCOUTQ` (the same
    /// number as `TIOCOUTQ`), which Linux answers for a Unix stream socket with the memory of
    /// the messages still queued for the peer (`unix_outq_len`, net/unix/af_unix.c).
    fn unread(socket: RawFd) -> usize {
        let mut unread: libc::c_int = 0;
        // SAFETY: `socket` is open while the proxy holds the result, and the call writes one int.
        #[allow(unsafe_code)]
        let result = unsafe { libc::ioctl(socket, libc::TIOCOUTQ, &mut unread) };
        assert_eq!(result, 0, "SIOCOUTQ: {}", std::io::Error::last_os_error());
        unread as usize
    }

    /// A search keeps its slot until it has read every row, not only until its first one: the
    /// proxy hands the search all its rows but holds back the end of the result, and once the
    /// search has read every byte of them (`unread`), its slot is still taken. The test runs on
    /// a current-thread runtime, so it looks only between two polls of the search; sqlx reads the
    /// socket inside the search's own poll and yields each row it decoded in that poll, so a row
    /// read is a row `run_search` has had. Each wait is for a state, and `DEADLINE` is reached
    /// only when the state never comes. The server's own time bounds do not come into it: the
    /// search finds its slot and the pool's connection free.
    #[tokio::test]
    async fn a_search_keeps_its_slot_until_it_has_read_every_row() {
        let Some(server) = TestServer::new().await else {
            return;
        };
        let (documents, _) = seed(&server.state.db, |rng| rng.gen_range(1_000..2_000)).await;
        let wanted = expected(&documents, "satzung");
        let hold = RowHold::new(&server.schema.url());
        let state = AppState::new(Arc::new(DB::connect(&hold.url).await.unwrap()));

        let searching = {
            let state = state.clone();
            tokio::spawn(async move { search(&state, "satzung").await })
        };
        let held = tokio::time::timeout(DEADLINE, hold.held)
            .await
            .expect("the search sent no rows")
            .unwrap();
        assert_eq!(held.rows, DOCUMENTS, "the held result is not the search");
        let started = Instant::now();
        while unread(held.client) > 0 {
            assert!(
                started.elapsed() < DEADLINE,
                "the search stopped reading its rows"
            );
            tokio::time::sleep(Duration::from_millis(20)).await;
        }
        assert!(
            !searching.is_finished(),
            "the search ended before its result"
        );
        assert_eq!(
            state.document_searches().available_permits(),
            CONCURRENT_SEARCHES - 1,
            "the search gave its slot back before the end of its rows"
        );

        held.release.send(()).unwrap();
        assert!(same_hits(&searching.await.unwrap(), &wanted));
        assert_eq!(
            state.document_searches().available_permits(),
            CONCURRENT_SEARCHES
        );
        state.db.pool.close().await;
        drop(state);
        hold.proxy.abort();

        server.drop().await;
    }
}

/// With every slot taken, a search gives up after `SEARCH_QUEUE_TIMEOUT` instead of hanging,
/// and runs once a slot is free again.
#[tokio::test]
async fn a_search_waits_for_a_slot_and_gives_up_in_time() {
    let Some(server) = TestServer::new().await else {
        return;
    };
    let state = &server.state;
    state
        .db
        .create_document("# Satzung\n\nText", vec![], "load")
        .await
        .unwrap();
    let terms = parse_query("satzung").unwrap();

    // Bounded: with fewer slots than `CONCURRENT_SEARCHES` this would wait forever.
    let held = tokio::time::timeout(
        DEADLINE,
        state
            .document_searches()
            .acquire_many(CONCURRENT_SEARCHES as u32),
    )
    .await
    .expect("the server's state has fewer search slots")
    .unwrap();
    let started = Instant::now();
    // Bounded from outside too, so a search without its own timeout fails here instead of
    // hanging the test.
    let refused = tokio::time::timeout(DEADLINE, run_search(state, &terms))
        .await
        .expect("a search waited for a slot without giving up");
    let waited = started.elapsed();
    assert!(refused.is_err(), "a search ran without a slot");
    assert!(
        waited >= SEARCH_QUEUE_TIMEOUT && waited < SEARCH_QUEUE_TIMEOUT + Duration::from_secs(2),
        "gave up after {waited:?}"
    );
    drop(held);
    assert_eq!(run_search(state, &terms).await.unwrap().len(), 1);

    server.drop().await;
}

/// The stream hands the first document over before the rest are read: with every document at
/// the text limit the first row arrives long before the last, so a search never holds all
/// texts at once. By hand (`--ignored --nocapture`): 500 documents of 100 000 characters.
#[tokio::test]
#[ignore]
async fn the_text_limit_times_five_hundred_streams() {
    let Some(server) = TestServer::new().await else {
        return;
    };
    let (documents, bytes) = seed(&server.state.db, |_| {
        backend::document_rules::MAX_DOCUMENT_TEXT_CHARS
    })
    .await;

    let started = Instant::now();
    let mut stream = server.state.db.searchable_documents().await.unwrap();
    let first = stream.try_next().await.unwrap().unwrap();
    let first_after = started.elapsed();
    let mut count = 1;
    while stream.try_next().await.unwrap().is_some() {
        count += 1;
    }
    let all_after = started.elapsed();
    drop(stream);
    assert_eq!(count, DOCUMENTS);
    assert!(documents.iter().any(|document| document.id == first._id));
    eprintln!(
        "{DOCUMENTS} documents, {:.1} MB: first row after {:.1} ms, all after {:.1} ms",
        bytes as f64 / 1e6,
        first_after.as_secs_f64() * 1e3,
        all_after.as_secs_f64() * 1e3
    );
    assert!(
        first_after * 4 < all_after,
        "the first row waited for the rest"
    );

    for query in ["vereinssatzung", "niemand"] {
        let (_, hits) = timed(&server.state, query).await;
        assert!(same_hits(&hits, &expected(&documents, query)));
    }

    server.drop().await;
}
