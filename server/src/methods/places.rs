use axum::{
    extract::State,
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};

use crate::{
    extractors::AuthExtractor,
    place_rules::validate_place,
    require_capability,
    state::AppState,
    types::{
        CreatePlaceRequestBody, CreatePlaceResponseBody, GetPlacesResponseBody, UserCapabilities,
    },
};

/// All places meetings can be assigned to, sorted by name. Requires `UpdateMeetings`;
/// public pages never need it because meetings carry a copy of their place.
#[utoipa::path(
    get,
    path = "/api/places/",
    responses(
        (status = 200, description = "All places", body = GetPlacesResponseBody),
        (status = 401, description = "Not logged in", content_type = "text/plain"),
        (status = 403, description = "Missing UpdateMeetings capability", content_type = "text/plain"),
        (status = 404, description = "Logged-in account has no user record", content_type = "text/plain"),
        (status = 500, description = "Database error (German text)", content_type = "text/plain")
    ),
    tag = "places"
)]
pub async fn get_places(
    State(state): State<AppState>,
    AuthExtractor(auth): AuthExtractor,
) -> Response {
    let user = require_capability!(state, auth, UserCapabilities::UpdateMeetings);
    match state.db.get_places().await {
        Ok(places) => Json(GetPlacesResponseBody { places }).into_response(),
        Err(e) => {
            eprintln!("get_places for {} failed: {e:#}", user.id);
            (StatusCode::INTERNAL_SERVER_ERROR, "Datenbankfehler").into_response()
        }
    }
}

/// Creates a place, or returns the existing one with the same name (ignoring case,
/// spacing and apostrophe style) with `created: false`. Requires `UpdateMeetings`.
#[utoipa::path(
    post,
    path = "/api/create_place/",
    request_body = CreatePlaceRequestBody,
    responses(
        (status = 200, description = "The new or the existing place", body = CreatePlaceResponseBody),
        (status = 401, description = "Not logged in", content_type = "text/plain"),
        (status = 403, description = "Missing UpdateMeetings capability", content_type = "text/plain"),
        (status = 404, description = "Logged-in account has no user record", content_type = "text/plain"),
        (status = 422, description = "Invalid name or coordinates (German text)", content_type = "text/plain"),
        (status = 500, description = "Database error (German text)", content_type = "text/plain")
    ),
    tag = "places"
)]
pub async fn create_place(
    State(state): State<AppState>,
    AuthExtractor(auth): AuthExtractor,
    Json(body): Json<CreatePlaceRequestBody>,
) -> Response {
    let user = require_capability!(state, auth, UserCapabilities::UpdateMeetings);
    let name = match validate_place(&body.name, body.lat, body.lon) {
        Ok(name) => name,
        Err(e) => return (StatusCode::UNPROCESSABLE_ENTITY, e.to_string()).into_response(),
    };
    match state
        .db
        .create_place(name, body.lat, body.lon, &user.id)
        .await
    {
        Ok((place, created)) => Json(CreatePlaceResponseBody { place, created }).into_response(),
        Err(e) => {
            eprintln!("create_place by {} failed: {e:#}", user.id);
            (StatusCode::INTERNAL_SERVER_ERROR, "Datenbankfehler").into_response()
        }
    }
}
