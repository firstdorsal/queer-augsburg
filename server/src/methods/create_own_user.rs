use axum::{
    extract::State,
    http::StatusCode,
    response::{IntoResponse, Response},
};

use crate::{extractors::AuthExtractor, state::AppState};

#[utoipa::path(
    post,
    path = "/api/create_own_user/",
    responses(
        (status = 201, description = "User created"),
        (status = 200, description = "User already exists"),
        (status = 401, description = "Unauthorized"),
        (status = 400, description = "Bad request")
    ),
    tag = "users"
)]
pub async fn create_own_user(
    State(state): State<AppState>,
    AuthExtractor(auth): AuthExtractor,
) -> Response {
    let user_id = match &auth.authenticated_user {
        Some(user_id) => user_id,
        None => return (StatusCode::UNAUTHORIZED, "Unauthorized").into_response(),
    };

    match state.db.create_user(user_id).await {
        Ok(_) => (StatusCode::CREATED, "OK").into_response(),
        Err(e) => {
            if e.to_string() == "User already exists" {
                (StatusCode::OK, "User exists but ok cool").into_response()
            } else {
                (StatusCode::BAD_REQUEST, e.to_string()).into_response()
            }
        }
    }
}
