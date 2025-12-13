use axum::{
    extract::State,
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};

use serde_valid::Validate;

use crate::{
    extractors::AuthExtractor,
    require_capability,
    state::AppState,
    types::{SubmittedMember, UserCapabilities},
    utils::generate_id,
};

#[utoipa::path(
    post,
    path = "/api/admin_create_member/",
    request_body = SubmittedMember,
    responses(
        (status = 201, description = "Member created"),
        (status = 401, description = "Unauthorized"),
        (status = 403, description = "Forbidden"),
        (status = 400, description = "Bad request")
    ),
    tag = "members"
)]
pub async fn admin_create_member(
    State(state): State<AppState>,
    AuthExtractor(auth): AuthExtractor,
    Json(submitted_member): Json<SubmittedMember>,
) -> Response {
    require_capability!(state, auth, UserCapabilities::CreateMember);

    if let Err(e) = submitted_member.validate() {
        return (StatusCode::BAD_REQUEST, format!("Validation error: {}", e)).into_response();
    }

    let user_id = generate_id(30);

    if let Err(e) = state.db.create_user(&user_id).await {
        return (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()).into_response();
    }

    if let Err(e) = state.db.update_member_data(&user_id, submitted_member).await {
        return (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()).into_response();
    }

    (StatusCode::CREATED, "Nutzer erfolgreich erstellt").into_response()
}
