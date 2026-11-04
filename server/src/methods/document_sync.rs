//! The WebSocket of the live editor: the y-websocket protocol, see `web/README.md`.

use axum::{
    extract::{
        ws::{CloseFrame, Message, Utf8Bytes, WebSocket, WebSocketUpgrade},
        Path, State,
    },
    http::{header, HeaderMap, StatusCode},
    response::{IntoResponse, Response},
};
use std::collections::HashMap;
use std::time::Duration;
use tokio::time::{interval, timeout, Instant};

use crate::{
    config::SERVER_CONFIG,
    document_rooms::{
        Connection, JoinError, Outbound, CLOSE_BUSY, CLOSE_DELETED, CLOSE_NO_PERMISSION,
        CLOSE_RESTART, CLOSE_ROOM_FAILED, CLOSE_SESSION, MAX_SOCKET_MESSAGE_BYTES,
        MAX_SOCKET_WRITE_BUFFER_BYTES,
    },
    extractors::AuthExtractor,
    interossea::UserAssertion,
    state::AppState,
    types::{User, UserCapabilities},
};

const PING_INTERVAL: Duration = Duration::from_secs(25);
const PEER_TIMEOUT: Duration = Duration::from_secs(70);
/// Capabilities change by hand in the database, which cannot push: the one deliberate poll.
const PERMISSION_CHECK_INTERVAL: Duration = Duration::from_secs(30);
/// A stuck peer or database must not stop the rest of the loop.
const STEP_TIMEOUT: Duration = Duration::from_secs(10);

/// The cookie is SameSite=None and CORS does not cover WebSockets, so without this check any
/// website could open a socket with a member's session.
pub fn origin_is_allowed(origin: Option<&str>, ui_origin: &url::Url) -> bool {
    origin == Some(ui_origin.origin().ascii_serialization().as_str())
}

/// Renewing the session adds a new entry, so the socket does not depend on the one it began with.
pub fn has_live_session(
    sessions: &HashMap<String, UserAssertion>,
    user_id: &str,
    now_ms: i64,
    validity_seconds: i64,
) -> bool {
    sessions.values().any(|assertion| {
        assertion.user_id == user_id && assertion.iat + validity_seconds * 1000 >= now_ms
    })
}

/// How the others see this person in the editor. From the record, never from the client.
pub fn display_name(user: &User) -> String {
    let member = user.member.as_ref();
    member
        .and_then(|member| member.name.as_ref())
        .map(|name| name.first_name.clone())
        .or_else(|| member.and_then(|member| member.institution.clone()))
        .unwrap_or_else(|| "Mitglied".to_string())
}

/// Refusals a browser can only see as a failed connection stay HTTP; everything the editor
/// must explain is a close frame after the upgrade.
pub async fn document_sync(
    State(state): State<AppState>,
    Path(document_id): Path<String>,
    headers: HeaderMap,
    AuthExtractor(auth): AuthExtractor,
    upgrade: WebSocketUpgrade,
) -> Response {
    if state.document_rooms.is_shutting_down() {
        return StatusCode::SERVICE_UNAVAILABLE.into_response();
    }
    let origin = headers
        .get(header::ORIGIN)
        .and_then(|origin| origin.to_str().ok());
    if !origin_is_allowed(origin, &SERVER_CONFIG.ui_origin) {
        return StatusCode::FORBIDDEN.into_response();
    }
    let Some(user_id) = auth.authenticated_user else {
        return StatusCode::UNAUTHORIZED.into_response();
    };
    let tasks = state.document_rooms.tasks().clone();
    upgrade
        .max_message_size(MAX_SOCKET_MESSAGE_BYTES)
        .max_frame_size(MAX_SOCKET_MESSAGE_BYTES)
        .max_write_buffer_size(MAX_SOCKET_WRITE_BUFFER_BYTES)
        .on_upgrade(move |socket| tasks.track_future(serve(socket, state, document_id, user_id)))
}

async fn close(socket: &mut WebSocket, code: u16, reason: &str) {
    let frame = CloseFrame {
        code,
        reason: Utf8Bytes::from(reason),
    };
    let _ = timeout(STEP_TIMEOUT, socket.send(Message::Close(Some(frame)))).await;
}

async fn send(socket: &mut WebSocket, message: Message) -> bool {
    matches!(
        timeout(STEP_TIMEOUT, socket.send(message)).await,
        Ok(Ok(()))
    )
}

async fn may_stay(state: &AppState, user_id: &str) -> Result<(), (u16, &'static str)> {
    let assertion_validity = SERVER_CONFIG.interossea.assertion_validity_seconds as i64;
    if !SERVER_CONFIG.dev.insecure_skip_interossea {
        let now = chrono::offset::Utc::now().timestamp_millis();
        let sessions = state.session_map.read().await;
        if !has_live_session(&sessions, user_id, now, assertion_validity) {
            return Err((CLOSE_SESSION, "Die Sitzung ist abgelaufen."));
        }
    }
    match timeout(STEP_TIMEOUT, state.db.get_user(user_id)).await {
        Ok(Ok(Some(user))) if user.has_capability(&UserCapabilities::UpdateDocuments) => Ok(()),
        Ok(Ok(_)) => Err((CLOSE_NO_PERMISSION, "Keine Berechtigung zum Bearbeiten.")),
        // Not a reason to throw an editor out: the next check decides.
        Ok(Err(e)) => {
            eprintln!("document_sync: user {user_id} lookup failed: {e:#}");
            Ok(())
        }
        Err(_) => Ok(()),
    }
}

async fn serve(mut socket: WebSocket, state: AppState, document_id: String, user_id: String) {
    let user = match state.db.get_user(&user_id).await {
        Ok(Some(user)) if user.has_capability(&UserCapabilities::UpdateDocuments) => user,
        Ok(_) => {
            let reason = "Keine Berechtigung zum Bearbeiten.";
            return close(&mut socket, CLOSE_NO_PERMISSION, reason).await;
        }
        Err(e) => {
            eprintln!("document_sync: user {user_id} lookup failed: {e:#}");
            return close(&mut socket, CLOSE_ROOM_FAILED, "Datenbankfehler").await;
        }
    };
    // Before a room is opened for it: unknown ids must not use up the rooms.
    match state.db.get_document(&document_id).await {
        Ok(Some(_)) => {}
        Ok(None) => {
            let reason = "Dieses Dokument gibt es nicht mehr.";
            return close(&mut socket, CLOSE_DELETED, reason).await;
        }
        Err(e) => {
            eprintln!("document_sync: document {document_id} lookup failed: {e:#}");
            return close(&mut socket, CLOSE_ROOM_FAILED, "Datenbankfehler").await;
        }
    }
    let joined = state
        .document_rooms
        .join(&document_id, &user_id, &display_name(&user));
    let connection = match joined {
        Ok(connection) => connection,
        Err(JoinError::ShuttingDown) => return close(&mut socket, CLOSE_RESTART, "Neustart").await,
        Err(e) => return close(&mut socket, CLOSE_BUSY, &e.to_string()).await,
    };
    relay(socket, connection, &state, &user_id).await;
}

/// Passes frames between the socket and the room until one of them ends.
async fn relay(mut socket: WebSocket, mut connection: Connection, state: &AppState, user_id: &str) {
    let token = state.document_rooms.shutdown_token();
    let mut ping = interval(PING_INTERVAL);
    let mut permission_check = interval(PERMISSION_CHECK_INTERVAL);
    permission_check.reset();
    let mut last_seen = Instant::now();
    loop {
        tokio::select! {
            outbound = connection.next() => match outbound {
                Outbound::Frame(frame) => {
                    if !send(&mut socket, Message::Binary(frame)).await {
                        return;
                    }
                }
                Outbound::Close(code, reason) => return close(&mut socket, code, &reason).await,
                // Clients reconnect and refill a fresh room.
                Outbound::Gone if token.is_cancelled() => {
                    return close(&mut socket, CLOSE_RESTART, "Neustart").await
                }
                Outbound::Gone => {
                    return close(&mut socket, CLOSE_ROOM_FAILED, "Der Raum ist ausgefallen.").await
                }
            },
            incoming = socket.recv() => match incoming {
                Some(Ok(Message::Binary(data))) => {
                    last_seen = Instant::now();
                    if !connection.send_frame(data).await {
                        return close(&mut socket, CLOSE_ROOM_FAILED, "Der Raum ist ausgefallen.").await;
                    }
                }
                Some(Ok(Message::Close(_))) => {
                    // Reading on completes the closing handshake, else browsers report 1006.
                    while let Some(Ok(_)) = socket.recv().await {}
                    return;
                }
                Some(Ok(_)) => last_seen = Instant::now(),
                Some(Err(_)) | None => return,
            },
            _ = ping.tick() => {
                if last_seen.elapsed() > PEER_TIMEOUT
                    || !send(&mut socket, Message::Ping(Default::default())).await
                {
                    return;
                }
            }
            _ = permission_check.tick() => {
                if let Err((code, reason)) = may_stay(state, user_id).await {
                    return close(&mut socket, code, reason).await;
                }
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn assertion(user_id: &str, iat: i64) -> UserAssertion {
        UserAssertion {
            iat,
            exp: 0,
            user_id: user_id.to_string(),
            service_id: "qa".to_string(),
            client_ip: String::new(),
            service_origin: String::new(),
            ir_admin: false,
        }
    }

    #[test]
    fn only_the_exact_origin_of_the_website_passes() {
        let ui_origin = url::Url::parse("https://queer-augsburg.de").unwrap();
        assert!(origin_is_allowed(
            Some("https://queer-augsburg.de"),
            &ui_origin
        ));
        for other in [
            "https://evil.example",
            "http://queer-augsburg.de",
            "https://queer-augsburg.de:443",
            "https://queer-augsburg.de.evil.example",
            "null",
            "",
        ] {
            assert!(!origin_is_allowed(Some(other), &ui_origin), "{other}");
        }
        assert!(!origin_is_allowed(None, &ui_origin));
    }

    #[test]
    fn a_renewed_session_keeps_the_socket() {
        let sessions = HashMap::from([
            ("old".to_string(), assertion("a", 0)),
            ("new".to_string(), assertion("a", 500_000)),
            ("other".to_string(), assertion("b", 900_000)),
        ]);
        assert!(has_live_session(&sessions, "a", 1_000_000, 600));
        assert!(!has_live_session(&sessions, "a", 1_100_001, 600));
        assert!(!has_live_session(&sessions, "c", 1_000_000, 600));
    }

    #[test]
    fn the_name_comes_from_the_record() {
        let mut user: User = serde_json::from_value(serde_json::json!({
            "_id": "u", "capabilities": [],
            "member": {
                "type": "Active", "natural_person": true,
                "name": {"passport": "Alex Beispiel", "first_name": "Alex", "last_name": "Beispiel"},
                "institution": null, "pronouns": null,
                "address": {"street": "S", "number": "1", "addition": null, "zip": "86150",
                            "city": "Augsburg", "country": "DE"},
                "email": "a@b.de", "phone": null, "start_time_ms": 1, "end_time_ms": null,
                "status": "Approved", "user_notes": null, "admin_notes": null, "reference": null,
                "approved_charter": true, "approved_privacy": true, "above_18": true,
                "honorary": false
            }
        }))
        .unwrap();
        assert_eq!(display_name(&user), "Alex");
        user.member = None;
        assert_eq!(display_name(&user), "Mitglied");
    }
}
