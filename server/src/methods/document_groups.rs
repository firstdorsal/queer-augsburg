use axum::{
    extract::State,
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};

use crate::{
    db::GroupNameError,
    document_rules::{clean_name, MAX_GROUP_NAME_CHARS, MAX_IDS_PER_REQUEST},
    extractors::AuthExtractor,
    methods::documents::{
        database_error, documents_response, refused, TOO_MANY_IDS, UNKNOWN_GROUP,
    },
    require_capability,
    state::AppState,
    types::{
        CreateDocumentGroupRequestBody, DeleteDocumentGroupRequestBody, GetDocumentsResponseBody,
        OrderDocumentGroupsRequestBody, OrderGroupDocumentsRequestBody,
        RenameDocumentGroupRequestBody, UserCapabilities,
    },
};

fn group_name_refused(action: &str, error: GroupNameError) -> Response {
    match error {
        GroupNameError::Taken => refused(StatusCode::CONFLICT, error.to_string()),
        GroupNameError::Database(e) => {
            eprintln!("{action} failed: {e:#}");
            database_error()
        }
    }
}

/// Creates a group. Requires `UpdateDocuments`. Answers with the list.
#[utoipa::path(
    post,
    path = "/api/create_document_group/",
    request_body = CreateDocumentGroupRequestBody,
    responses(
        (status = 200, description = "Groups and documents", body = GetDocumentsResponseBody),
        (status = 401, description = "Not logged in", content_type = "text/plain"),
        (status = 403, description = "Missing UpdateDocuments capability", content_type = "text/plain"),
        (status = 404, description = "Logged-in account has no user record", content_type = "text/plain"),
        (status = 409, description = "Name is taken (German text)", content_type = "text/plain"),
        (status = 422, description = "Invalid name (German text)", content_type = "text/plain"),
        (status = 500, description = "Database error (German text)", content_type = "text/plain")
    ),
    tag = "documents"
)]
pub async fn create_document_group(
    State(state): State<AppState>,
    AuthExtractor(auth): AuthExtractor,
    Json(body): Json<CreateDocumentGroupRequestBody>,
) -> Response {
    require_capability!(state, auth, UserCapabilities::UpdateDocuments);
    let name = match clean_name(&body.name, MAX_GROUP_NAME_CHARS, "der Name") {
        Ok(name) => name,
        Err(message) => return refused(StatusCode::UNPROCESSABLE_ENTITY, message),
    };
    match state.db.create_document_group(&name).await {
        Ok(()) => documents_response(&state).await,
        Err(e) => group_name_refused("create_document_group", e),
    }
}

/// Renames a group. Requires `UpdateDocuments`. Answers with the list.
#[utoipa::path(
    post,
    path = "/api/rename_document_group/",
    request_body = RenameDocumentGroupRequestBody,
    responses(
        (status = 200, description = "Groups and documents", body = GetDocumentsResponseBody),
        (status = 401, description = "Not logged in", content_type = "text/plain"),
        (status = 403, description = "Missing UpdateDocuments capability", content_type = "text/plain"),
        (status = 404, description = "No such group or no user record", content_type = "text/plain"),
        (status = 409, description = "Name is taken (German text)", content_type = "text/plain"),
        (status = 422, description = "Invalid name (German text)", content_type = "text/plain"),
        (status = 500, description = "Database error (German text)", content_type = "text/plain")
    ),
    tag = "documents"
)]
pub async fn rename_document_group(
    State(state): State<AppState>,
    AuthExtractor(auth): AuthExtractor,
    Json(body): Json<RenameDocumentGroupRequestBody>,
) -> Response {
    require_capability!(state, auth, UserCapabilities::UpdateDocuments);
    let name = match clean_name(&body.name, MAX_GROUP_NAME_CHARS, "der Name") {
        Ok(name) => name,
        Err(message) => return refused(StatusCode::UNPROCESSABLE_ENTITY, message),
    };
    match state.db.rename_document_group(&body.group_id, &name).await {
        Ok(true) => documents_response(&state).await,
        Ok(false) => refused(StatusCode::NOT_FOUND, UNKNOWN_GROUP),
        Err(e) => group_name_refused("rename_document_group", e),
    }
}

/// Deletes a group; its documents stay. Requires `UpdateDocuments`. Answers with the list.
#[utoipa::path(
    post,
    path = "/api/delete_document_group/",
    request_body = DeleteDocumentGroupRequestBody,
    responses(
        (status = 200, description = "Groups and documents", body = GetDocumentsResponseBody),
        (status = 401, description = "Not logged in", content_type = "text/plain"),
        (status = 403, description = "Missing UpdateDocuments capability", content_type = "text/plain"),
        (status = 404, description = "No such group or no user record", content_type = "text/plain"),
        (status = 500, description = "Database error (German text)", content_type = "text/plain")
    ),
    tag = "documents"
)]
pub async fn delete_document_group(
    State(state): State<AppState>,
    AuthExtractor(auth): AuthExtractor,
    Json(body): Json<DeleteDocumentGroupRequestBody>,
) -> Response {
    require_capability!(state, auth, UserCapabilities::UpdateDocuments);
    match state.db.delete_document_group(&body.group_id).await {
        Ok(true) => documents_response(&state).await,
        Ok(false) => refused(StatusCode::NOT_FOUND, UNKNOWN_GROUP),
        Err(e) => {
            eprintln!("delete_document_group {} failed: {e:#}", body.group_id);
            database_error()
        }
    }
}

/// Sets the order of the groups. Requires `UpdateDocuments`. Answers with the list.
#[utoipa::path(
    post,
    path = "/api/order_document_groups/",
    request_body = OrderDocumentGroupsRequestBody,
    responses(
        (status = 200, description = "Groups and documents", body = GetDocumentsResponseBody),
        (status = 401, description = "Not logged in", content_type = "text/plain"),
        (status = 403, description = "Missing UpdateDocuments capability", content_type = "text/plain"),
        (status = 404, description = "Logged-in account has no user record", content_type = "text/plain"),
        (status = 422, description = "Too many ids (German text)", content_type = "text/plain"),
        (status = 500, description = "Database error (German text)", content_type = "text/plain")
    ),
    tag = "documents"
)]
pub async fn order_document_groups(
    State(state): State<AppState>,
    AuthExtractor(auth): AuthExtractor,
    Json(body): Json<OrderDocumentGroupsRequestBody>,
) -> Response {
    require_capability!(state, auth, UserCapabilities::UpdateDocuments);
    if body.group_ids.len() > MAX_IDS_PER_REQUEST {
        return refused(StatusCode::UNPROCESSABLE_ENTITY, TOO_MANY_IDS);
    }
    match state.db.set_document_group_order(&body.group_ids).await {
        Ok(()) => documents_response(&state).await,
        Err(e) => {
            eprintln!("order_document_groups failed: {e:#}");
            database_error()
        }
    }
}

/// Sets the order of the documents in a group. Requires `UpdateDocuments`. Answers with the
/// list.
#[utoipa::path(
    post,
    path = "/api/order_group_documents/",
    request_body = OrderGroupDocumentsRequestBody,
    responses(
        (status = 200, description = "Groups and documents", body = GetDocumentsResponseBody),
        (status = 401, description = "Not logged in", content_type = "text/plain"),
        (status = 403, description = "Missing UpdateDocuments capability", content_type = "text/plain"),
        (status = 404, description = "No such group or no user record", content_type = "text/plain"),
        (status = 422, description = "Too many ids (German text)", content_type = "text/plain"),
        (status = 500, description = "Database error (German text)", content_type = "text/plain")
    ),
    tag = "documents"
)]
pub async fn order_group_documents(
    State(state): State<AppState>,
    AuthExtractor(auth): AuthExtractor,
    Json(body): Json<OrderGroupDocumentsRequestBody>,
) -> Response {
    require_capability!(state, auth, UserCapabilities::UpdateDocuments);
    if body.document_ids.len() > MAX_IDS_PER_REQUEST {
        return refused(StatusCode::UNPROCESSABLE_ENTITY, TOO_MANY_IDS);
    }
    match state
        .db
        .set_group_document_order(&body.group_id, &body.document_ids)
        .await
    {
        Ok(true) => documents_response(&state).await,
        Ok(false) => refused(StatusCode::NOT_FOUND, UNKNOWN_GROUP),
        Err(e) => {
            eprintln!("order_group_documents {} failed: {e:#}", body.group_id);
            database_error()
        }
    }
}
