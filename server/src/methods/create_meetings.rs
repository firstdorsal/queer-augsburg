use axum::{
    extract::{rejection::JsonRejection, State},
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};

use std::collections::HashMap;

use crate::{
    db::CreateMeetingsError,
    extractors::AuthExtractor,
    meeting_validation::prepare_meeting_batch,
    require_capability,
    state::AppState,
    types::{
        CreateMeetingsErrorBody, CreateMeetingsErrorCode, CreateMeetingsRequestBody,
        CreateMeetingsResponseBody, Meeting, Place, UserCapabilities,
    },
};

/// Creates up to 50 meetings at once (bulk import). Requires the `UpdateMeetings`
/// capability.
///
/// Every meeting is validated before anything is written; if one is invalid,
/// nothing is created. Each meeting needs either the `place_id` of a stored place
/// (name and coordinates are copied from it into `location`) or `online` details, not
/// both. `_id`, `changed`, `location`, `attendance`, `rating`, `cancelled` and
/// `deleted_at` are set by the server; sending any of them is rejected. Members-only
/// links are not included in the response. Error bodies carry a German `message` for
/// the member.
#[utoipa::path(
    post,
    path = "/api/create_meetings/",
    request_body = CreateMeetingsRequestBody,
    responses(
        (status = 200, description = "All meetings were created", body = CreateMeetingsResponseBody),
        (status = 400, description = "Malformed JSON; nothing was created", body = CreateMeetingsErrorBody),
        (status = 401, description = "Not logged in", content_type = "text/plain"),
        (status = 403, description = "Missing UpdateMeetings capability", content_type = "text/plain"),
        (status = 404, description = "Logged-in user has no user record", content_type = "text/plain"),
        (status = 413, description = "Body larger than the batch limit; nothing was created", body = CreateMeetingsErrorBody),
        (status = 415, description = "Body is not application/json; nothing was created", body = CreateMeetingsErrorBody),
        (status = 422, description = "Body does not match the schema, or a meeting is invalid or its place does not exist (`index`); nothing was created", body = CreateMeetingsErrorBody),
        (status = 500, description = "Database error; `code` tells whether anything may have been created", body = CreateMeetingsErrorBody)
    ),
    tag = "meetings"
)]
pub async fn create_meetings(
    State(state): State<AppState>,
    AuthExtractor(auth): AuthExtractor,
    body: Result<Json<CreateMeetingsRequestBody>, JsonRejection>,
) -> Response {
    let user = require_capability!(state, auth, UserCapabilities::UpdateMeetings);
    let user_id = user.id.as_str();

    let body = match body {
        Ok(Json(body)) => body,
        Err(rejection) => {
            return error_response(
                rejection.status(),
                CreateMeetingsErrorCode::InvalidBody,
                None,
                format!("Ungültige Anfrage: {}", rejection.body_text()),
            )
        }
    };

    // Loaded once for the whole batch; each meeting's place is looked up by id.
    let places: HashMap<String, Place> = match state.db.get_places().await {
        Ok(places) => places
            .into_iter()
            .map(|place| (place._id.clone(), place))
            .collect(),
        Err(e) => {
            eprintln!("create_meetings by {user_id}: loading places failed: {e:#}");
            return error_response(
                StatusCode::INTERNAL_SERVER_ERROR,
                CreateMeetingsErrorCode::Internal,
                None,
                "Datenbankfehler, es wurde nichts angelegt. Bitte später erneut versuchen."
                    .to_string(),
            );
        }
    };
    let meetings = match prepare_meeting_batch(body.meetings, &places) {
        Ok(meetings) => meetings,
        Err(e) => {
            return error_response(
                StatusCode::UNPROCESSABLE_ENTITY,
                CreateMeetingsErrorCode::InvalidMeeting,
                e.index().and_then(|index| u32::try_from(index).ok()),
                e.to_string(),
            )
        }
    };

    match state.db.create_meetings(meetings, user_id).await {
        // Same as every save response: members-only links stay out (see `OnlineMeeting::url`).
        Ok(meetings) => Json(CreateMeetingsResponseBody {
            meetings: meetings
                .into_iter()
                .map(Meeting::without_private_link)
                .collect(),
        })
        .into_response(),
        Err(e) => {
            eprintln!("create_meetings by {user_id} failed: {e}");
            let (code, message) = match e {
                CreateMeetingsError::IdLookup(_) | CreateMeetingsError::RolledBack(_) => (
                    CreateMeetingsErrorCode::Internal,
                    "Datenbankfehler, es wurde nichts angelegt. Bitte später erneut versuchen.",
                ),
                CreateMeetingsError::RollbackFailed { .. } => (
                    CreateMeetingsErrorCode::PartiallyCreated,
                    "Datenbankfehler, einige Treffen wurden eventuell trotzdem angelegt. Bitte die Liste prüfen, bevor du es erneut versuchst.",
                ),
            };
            error_response(
                StatusCode::INTERNAL_SERVER_ERROR,
                code,
                None,
                message.to_string(),
            )
        }
    }
}

fn error_response(
    status: StatusCode,
    code: CreateMeetingsErrorCode,
    index: Option<u32>,
    message: String,
) -> Response {
    (
        status,
        Json(CreateMeetingsErrorBody {
            code,
            index,
            message,
        }),
    )
        .into_response()
}
