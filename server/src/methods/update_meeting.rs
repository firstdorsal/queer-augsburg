use axum::{
    extract::State,
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};

use crate::{
    extractors::AuthExtractor,
    place_rules::{finish_venue, needs_stored_link, VenueError},
    require_capability,
    state::AppState,
    types::{Meeting, UpdateMeetingRequestBody, UserCapabilities},
};

/// Creates (unknown `_id`), updates or deletes (`delete: true`, responds with text "Ok")
/// a meeting. On save the meeting needs a `place_id` of an existing place or `online`
/// details; name and coordinates are copied from the place. A withheld members-only link
/// (`url_hidden`, `url: null`) is kept, `url: ""` removes it. Members-only links are
/// removed from the response.
#[utoipa::path(
    post,
    path = "/api/update_meeting/",
    request_body = UpdateMeetingRequestBody,
    responses(
        (status = 200, description = "Meeting saved (or text \"Ok\" after delete)", body = crate::types::Meeting),
        (status = 401, description = "Unauthorized", content_type = "text/plain"),
        (status = 403, description = "Forbidden", content_type = "text/plain"),
        (status = 422, description = "No place / invalid online details (German text)", content_type = "text/plain"),
        (status = 500, description = "Database error (German text)", content_type = "text/plain")
    ),
    tag = "meetings"
)]
pub async fn update_meeting(
    State(state): State<AppState>,
    AuthExtractor(auth): AuthExtractor,
    Json(body): Json<UpdateMeetingRequestBody>,
) -> Response {
    let user = require_capability!(state, auth, UserCapabilities::UpdateMeetings);

    let db_auth = crate::interossea::Auth {
        authenticated_user: auth.authenticated_user.clone(),
        token: auth.token.clone(),
        user_assertion: auth.user_assertion.clone(),
    };
    let database_error = |action: &str, e: &dyn std::fmt::Display| {
        eprintln!(
            "update_meeting {} {action} by {} failed: {e:#}",
            body.meeting._id, user.id
        );
        (StatusCode::INTERNAL_SERVER_ERROR, "Datenbankfehler").into_response()
    };

    if body.delete == Some(true) {
        if let Err(e) = state.db.delete_meeting(&body.meeting._id, &db_auth).await {
            return database_error("delete", &e);
        }
        return (StatusCode::OK, "Ok").into_response();
    }

    let mut meeting = match prepare_venue(&state, body.meeting.clone()).await {
        Ok(meeting) => meeting,
        Err(SaveError::Venue(e)) => {
            return (StatusCode::UNPROCESSABLE_ENTITY, e.to_string()).into_response()
        }
        Err(SaveError::Database(e)) => return database_error("venue lookup", &e),
    };
    if let Err(e) = state.db.update_meeting(&mut meeting, &db_auth).await {
        return database_error("save", &e);
    }
    Json(meeting.without_private_link()).into_response()
}

#[derive(Debug, thiserror::Error)]
enum SaveError {
    #[error(transparent)]
    Venue(#[from] VenueError),
    #[error("database: {0:#}")]
    Database(#[from] anyhow::Error),
}

/// Loads the place and, if needed, the stored link, then applies `finish_venue`. The
/// stored link is read before the write; two editors saving the same meeting at the same
/// moment can race here, which is accepted for this low-volume, editor-only path.
async fn prepare_venue(state: &AppState, meeting: Meeting) -> Result<Meeting, SaveError> {
    let place = match (&meeting.online, &meeting.place_id) {
        (None, Some(place_id)) => state.db.get_place(place_id).await?,
        _ => None,
    };
    let stored_link = if needs_stored_link(&meeting) {
        state
            .db
            .get_meeting(&meeting._id)
            .await?
            .and_then(|stored| stored.online)
            .and_then(|online| online.url)
    } else {
        None
    };
    Ok(finish_venue(meeting, place, stored_link)?)
}
