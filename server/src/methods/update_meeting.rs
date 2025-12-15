use axum::{
    extract::State,
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};

use crate::{
    extractors::AuthExtractor,
    require_capability,
    state::AppState,
    types::{UpdateMeetingRequestBody, UserCapabilities},
};

#[utoipa::path(
    post,
    path = "/api/update_meeting/",
    request_body = UpdateMeetingRequestBody,
    responses(
        (status = 200, description = "Meeting updated", body = crate::types::Meeting),
        (status = 401, description = "Unauthorized"),
        (status = 403, description = "Forbidden")
    ),
    tag = "meetings"
)]
pub async fn update_meeting(
    State(state): State<AppState>,
    AuthExtractor(auth): AuthExtractor,
    Json(mut body): Json<UpdateMeetingRequestBody>,
) -> Response {
    require_capability!(state, auth, UserCapabilities::UpdateMeetings);

    match body.delete {
        Some(true) => {
            let db_auth = crate::interossea::Auth {
                authenticated_user: auth.authenticated_user.clone(),
                token: auth.token.clone(),
                user_assertion: auth.user_assertion.clone(),
            };
            if let Err(e) = state.db.delete_meeting(&body.meeting._id, &db_auth).await {
                return (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()).into_response();
            }
            (StatusCode::OK, "Ok").into_response()
        }
        _ => {
            let db_auth = crate::interossea::Auth {
                authenticated_user: auth.authenticated_user.clone(),
                token: auth.token.clone(),
                user_assertion: auth.user_assertion.clone(),
            };
            if let Err(e) = state.db.update_meeting(&mut body.meeting, &db_auth).await {
                return (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()).into_response();
            }
            Json(body.meeting).into_response()
        }
    }
}
