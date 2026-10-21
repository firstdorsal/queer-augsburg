use axum::{
    extract::{Query, State},
    http::{header, StatusCode},
    response::{IntoResponse, Response},
    Json,
};
use serde::Deserialize;
use utoipa::IntoParams;

use crate::{
    extractors::AuthExtractor,
    place_rules::{link_access, LinkAccess},
    state::AppState,
    types::MeetingLinkResponseBody,
};

#[derive(Deserialize, IntoParams)]
pub struct MeetingLinkQuery {
    /// Meeting id
    pub m: String,
}

/// The join link of an online meeting. Members-only links are only returned to verified
/// members (membership approved) and editors; links of unpublished (`Planned`) meetings
/// only to editors. Responses are never cacheable.
#[utoipa::path(
    get,
    path = "/api/meeting_link/",
    params(MeetingLinkQuery),
    responses(
        (status = 200, description = "The link; `url` is null while none is set", body = MeetingLinkResponseBody),
        (status = 401, description = "Members-only link and not logged in", content_type = "text/plain"),
        (status = 403, description = "Members-only link and not a verified member", content_type = "text/plain"),
        (status = 404, description = "No such (published, online, not deleted) meeting", content_type = "text/plain"),
        (status = 500, description = "Database error (German text)", content_type = "text/plain")
    ),
    tag = "meetings"
)]
pub async fn get_meeting_link(
    State(state): State<AppState>,
    AuthExtractor(auth): AuthExtractor,
    Query(query): Query<MeetingLinkQuery>,
) -> Response {
    // The response may carry a members-only link: no proxy or browser cache may keep it.
    let no_store = || [(header::CACHE_CONTROL, "private, no-store")];
    let database_error = || {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            no_store(),
            "Datenbankfehler",
        )
            .into_response()
    };

    let meeting = match state.db.get_meeting(&query.m).await {
        Ok(meeting) => meeting,
        Err(e) => {
            eprintln!("get_meeting_link {}: meeting lookup failed: {e:#}", query.m);
            return database_error();
        }
    };
    let user = match auth.authenticated_user.as_deref() {
        Some(user_id) => match state.db.get_user(user_id).await {
            Ok(user) => user,
            Err(e) => {
                eprintln!(
                    "get_meeting_link {}: user {user_id} lookup failed: {e:#}",
                    query.m
                );
                return database_error();
            }
        },
        None => None,
    };

    match link_access(
        meeting.as_ref(),
        auth.authenticated_user.is_some(),
        user.as_ref(),
    ) {
        LinkAccess::Granted(url) => {
            (no_store(), Json(MeetingLinkResponseBody { url })).into_response()
        }
        LinkAccess::NotFound => (StatusCode::NOT_FOUND, no_store(), "Not found").into_response(),
        LinkAccess::LoginRequired => {
            (StatusCode::UNAUTHORIZED, no_store(), "Unauthorized").into_response()
        }
        LinkAccess::Forbidden => {
            (StatusCode::FORBIDDEN, no_store(), "Not authorized").into_response()
        }
    }
}
