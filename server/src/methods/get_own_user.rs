use axum::{
    extract::State,
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};

use crate::{extractors::AuthExtractor, state::AppState};

#[utoipa::path(
    get,
    path = "/api/get_own_user/",
    responses(
        (status = 200, description = "Current user profile", body = crate::types::User),
        (status = 401, description = "Unauthorized"),
        (status = 404, description = "User not found")
    ),
    tag = "users"
)]
pub async fn get_own_user(
    State(state): State<AppState>,
    AuthExtractor(auth): AuthExtractor,
) -> Response {
    let user_id = match &auth.authenticated_user {
        Some(user_id) => user_id,
        None => return (StatusCode::UNAUTHORIZED, "Unauthorized").into_response(),
    };

    let user = match state.db.get_user(user_id).await {
        Ok(Some(user)) => user,
        Ok(None) => return (StatusCode::NOT_FOUND, "User not found").into_response(),
        Err(e) => return (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()).into_response(),
    };

    Json(user).into_response()
}
