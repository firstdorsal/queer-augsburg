use axum::{
    extract::{rejection::JsonRejection, State},
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};

use crate::{
    db::CreateMeetingsError,
    extractors::AuthExtractor,
    meeting_validation::{validate_meeting_batch, MeetingBatchError},
    require_capability,
    state::AppState,
    types::{
        CreateMeetingsErrorBody, CreateMeetingsErrorCode, CreateMeetingsRequestBody,
        CreateMeetingsResponseBody, UserCapabilities,
    },
};

/// Creates up to 50 meetings at once (bulk import). Requires the `UpdateMeetings`
/// capability.
///
/// Every meeting is validated before anything is written; if one is invalid,
/// nothing is created. `_id`, `changed`, `attendance`, `rating`, `cancelled` and
/// `deleted_at` are set by the server. Error bodies carry a German `message` for
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
        (status = 422, description = "Body does not match the schema or a meeting is invalid (`index`); nothing was created", body = CreateMeetingsErrorBody),
        (status = 500, description = "Database error; `code` tells whether anything may have been created", body = CreateMeetingsErrorBody)
    ),
    tag = "meetings"
)]
pub async fn create_meetings(
    State(state): State<AppState>,
    AuthExtractor(auth): AuthExtractor,
    body: Result<Json<CreateMeetingsRequestBody>, JsonRejection>,
) -> Response {
    require_capability!(state, auth, UserCapabilities::UpdateMeetings);
    let Some(user_id) = auth.authenticated_user.as_deref() else {
        return (StatusCode::UNAUTHORIZED, "Unauthorized").into_response();
    };

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

    if let Err(e) = validate_meeting_batch(&body.meetings) {
        let index = match &e {
            MeetingBatchError::InvalidMeeting { index, .. } => u32::try_from(*index).ok(),
            MeetingBatchError::Empty | MeetingBatchError::TooMany => None,
        };
        return error_response(
            StatusCode::UNPROCESSABLE_ENTITY,
            CreateMeetingsErrorCode::InvalidMeeting,
            index,
            e.to_string(),
        );
    }

    match state.db.create_meetings(body.meetings, user_id).await {
        Ok(meetings) => Json(CreateMeetingsResponseBody { meetings }).into_response(),
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
