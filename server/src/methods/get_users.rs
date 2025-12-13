use axum::{
    extract::{Query, State},
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};

use crate::{
    extractors::AuthExtractor,
    require_capability,
    state::AppState,
    types::{GetUsersQuery, GetUsersResponseBody, UserCapabilities},
};

#[utoipa::path(
    get,
    path = "/api/get_users/",
    params(
        ("l" = Option<i64>, Query, description = "Limit number of results"),
        ("i" = Option<i64>, Query, description = "From index (pagination offset)"),
        ("s" = Option<String>, Query, description = "Search term"),
        ("sb" = Option<String>, Query, description = "Sort by field"),
        ("so" = Option<String>, Query, description = "Sort order ('asc' or 'desc')")
    ),
    responses(
        (status = 200, description = "List of users", body = GetUsersResponseBody),
        (status = 401, description = "Unauthorized"),
        (status = 403, description = "Forbidden")
    ),
    tag = "users"
)]
pub async fn get_users(
    State(state): State<AppState>,
    AuthExtractor(auth): AuthExtractor,
    Query(query): Query<GetUsersQuery>,
) -> Response {
    require_capability!(state, auth, UserCapabilities::GetUsers);

    let limit = query.l;
    let from_index = query.i.unwrap_or(0);
    let search = query.s;
    let sort_by = query.sb;
    let sort_order = query.so;

    let (users, total_count) = match state
        .db
        .get_users(limit, from_index as u64, search, sort_by, sort_order)
        .await
    {
        Ok(result) => result,
        Err(e) => {
            return (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()).into_response();
        }
    };

    let users_response = GetUsersResponseBody { users, total_count };

    Json(users_response).into_response()
}
