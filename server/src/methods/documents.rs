use axum::{
    extract::{Query, State},
    http::{header, HeaderName, StatusCode},
    response::{IntoResponse, Response},
    Json,
};
use futures_util::stream::TryStreamExt;
use serde::Deserialize;
use std::collections::HashMap;
use std::time::Duration;
use tokio::time::timeout;
use utoipa::IntoParams;

use crate::{
    document_rules::{
        arrange_documents, clean_name, documents_access, first_text, DocumentsAccess,
        MAX_DOCUMENT_TEXT_CHARS, MAX_DOCUMENT_TITLE_CHARS, MAX_IDS_PER_REQUEST,
    },
    document_search::{best_hits, compile_terms, match_document, parse_query},
    extractors::AuthExtractor,
    interossea::Auth,
    require_capability,
    state::AppState,
    types::{
        CreateDocumentRequestBody, DeleteDocumentRequestBody, GetDocumentVersionsResponseBody,
        GetDocumentsResponseBody, SearchDocumentsResponseBody, SetDocumentGroupsRequestBody,
        UserCapabilities, WikiDocument, WikiDocumentHit,
    },
};

/// Searches running at once. Each one streams all documents over a pooled connection
/// (`DB::searchable_documents`), so this is also how many connections searches may hold.
pub const CONCURRENT_SEARCHES: usize = 2;
/// A search reads all documents; when too many wait, the next one is better off with an error.
pub const SEARCH_QUEUE_TIMEOUT: Duration = Duration::from_secs(5);

pub(crate) const UNKNOWN_DOCUMENT: &str = "Dieses Dokument gibt es nicht mehr.";
pub(crate) const UNKNOWN_GROUP: &str = "Diese Gruppe gibt es nicht mehr.";
pub(crate) const TOO_MANY_IDS: &str = "Zu viele Einträge.";

/// Internal content: no proxy or browser cache may keep it.
pub(crate) fn no_store() -> [(HeaderName, &'static str); 1] {
    [(header::CACHE_CONTROL, "private, no-store")]
}

pub(crate) fn database_error() -> Response {
    (
        StatusCode::INTERNAL_SERVER_ERROR,
        no_store(),
        "Datenbankfehler",
    )
        .into_response()
}

pub(crate) fn refused(status: StatusCode, message: impl Into<String>) -> Response {
    (status, no_store(), message.into()).into_response()
}

/// The response refusing this viewer, `None` if they may read the documents.
async fn refuse_reader(state: &AppState, auth: &Auth) -> Option<Response> {
    let user = match auth.authenticated_user.as_deref() {
        Some(user_id) => match state.db.get_user(user_id).await {
            Ok(user) => user,
            Err(e) => {
                eprintln!("documents: user {user_id} lookup failed: {e:#}");
                return Some(database_error());
            }
        },
        None => None,
    };
    match documents_access(auth.authenticated_user.is_some(), user.as_ref()) {
        DocumentsAccess::Granted => None,
        DocumentsAccess::LoginRequired => Some(refused(StatusCode::UNAUTHORIZED, "Unauthorized")),
        DocumentsAccess::Forbidden => Some(refused(StatusCode::FORBIDDEN, "Not authorized")),
    }
}

/// The current list, also the answer to anything that changes it.
pub(crate) async fn documents_response(state: &AppState) -> Response {
    match state.db.get_document_list().await {
        Ok((groups, group_order, documents)) => (
            no_store(),
            Json(arrange_documents(groups, &group_order, documents)),
        )
            .into_response(),
        Err(e) => {
            eprintln!("documents: listing failed: {e:#}");
            database_error()
        }
    }
}

/// Groups and documents in display order, without the text. For verified members, editors and
/// `UpdateDocuments` holders.
#[utoipa::path(
    get,
    path = "/api/documents/",
    responses(
        (status = 200, description = "Groups and documents", body = GetDocumentsResponseBody),
        (status = 401, description = "Not logged in", content_type = "text/plain"),
        (status = 403, description = "Not a verified member", content_type = "text/plain"),
        (status = 500, description = "Database error (German text)", content_type = "text/plain")
    ),
    tag = "documents"
)]
pub async fn get_documents(
    State(state): State<AppState>,
    AuthExtractor(auth): AuthExtractor,
) -> Response {
    if let Some(refusal) = refuse_reader(&state, &auth).await {
        return refusal;
    }
    documents_response(&state).await
}

#[derive(Deserialize, IntoParams)]
pub struct DocumentQuery {
    /// Document id
    pub d: String,
}

/// One document. Same readers as `/api/documents/`.
#[utoipa::path(
    get,
    path = "/api/document/",
    params(DocumentQuery),
    responses(
        (status = 200, description = "The document", body = WikiDocument),
        (status = 401, description = "Not logged in", content_type = "text/plain"),
        (status = 403, description = "Not a verified member", content_type = "text/plain"),
        (status = 404, description = "No such (not deleted) document (German text)", content_type = "text/plain"),
        (status = 500, description = "Database error (German text)", content_type = "text/plain")
    ),
    tag = "documents"
)]
pub async fn get_document(
    State(state): State<AppState>,
    AuthExtractor(auth): AuthExtractor,
    Query(query): Query<DocumentQuery>,
) -> Response {
    if let Some(refusal) = refuse_reader(&state, &auth).await {
        return refusal;
    }
    match state.db.get_document(&query.d).await {
        Ok(Some(mut document)) => {
            document.editing = state.document_rooms.is_open(&document._id);
            (no_store(), Json(document)).into_response()
        }
        Ok(None) => refused(StatusCode::NOT_FOUND, UNKNOWN_DOCUMENT),
        Err(e) => {
            eprintln!("get_document {} failed: {e:#}", query.d);
            database_error()
        }
    }
}

/// The automatically kept earlier texts of a document, newest first. Requires
/// `UpdateDocuments`.
#[utoipa::path(
    get,
    path = "/api/document_versions/",
    params(DocumentQuery),
    responses(
        (status = 200, description = "The versions", body = GetDocumentVersionsResponseBody),
        (status = 401, description = "Not logged in", content_type = "text/plain"),
        (status = 403, description = "Missing UpdateDocuments capability", content_type = "text/plain"),
        (status = 404, description = "No such document or no user record", content_type = "text/plain"),
        (status = 500, description = "Database error (German text)", content_type = "text/plain")
    ),
    tag = "documents"
)]
pub async fn get_document_versions(
    State(state): State<AppState>,
    AuthExtractor(auth): AuthExtractor,
    Query(query): Query<DocumentQuery>,
) -> Response {
    require_capability!(state, auth, UserCapabilities::UpdateDocuments);
    match state.db.get_document(&query.d).await {
        Ok(Some(_)) => {}
        Ok(None) => return refused(StatusCode::NOT_FOUND, UNKNOWN_DOCUMENT),
        Err(e) => {
            eprintln!("get_document_versions {} failed: {e:#}", query.d);
            return database_error();
        }
    }
    match state.db.get_document_versions(&query.d).await {
        Ok(versions) => (
            no_store(),
            Json(GetDocumentVersionsResponseBody { versions }),
        )
            .into_response(),
        Err(e) => {
            eprintln!("get_document_versions {} failed: {e:#}", query.d);
            database_error()
        }
    }
}

#[derive(Deserialize, IntoParams)]
pub struct SearchQuery {
    /// Search terms
    pub q: String,
}

/// Searches the title and the whole text of all documents: every term must occur, also inside
/// a word. Title hits first, then by title. Same readers as `/api/documents/`.
#[utoipa::path(
    get,
    path = "/api/search_documents/",
    params(SearchQuery),
    responses(
        (status = 200, description = "At most 50 hits", body = SearchDocumentsResponseBody),
        (status = 401, description = "Not logged in", content_type = "text/plain"),
        (status = 403, description = "Not a verified member", content_type = "text/plain"),
        (status = 422, description = "Invalid query (German text)", content_type = "text/plain"),
        (status = 500, description = "Database error (German text)", content_type = "text/plain")
    ),
    tag = "documents"
)]
pub async fn search_documents(
    State(state): State<AppState>,
    AuthExtractor(auth): AuthExtractor,
    Query(query): Query<SearchQuery>,
) -> Response {
    if let Some(refusal) = refuse_reader(&state, &auth).await {
        return refusal;
    }
    let terms = match parse_query(&query.q) {
        Ok(terms) => terms,
        Err(e) => return refused(StatusCode::UNPROCESSABLE_ENTITY, e.to_string()),
    };
    match run_search(&state, &terms).await {
        Ok(hits) => (no_store(), Json(SearchDocumentsResponseBody { hits })).into_response(),
        Err(e) => {
            eprintln!("search_documents failed: {e:#}");
            database_error()
        }
    }
}

/// The search behind `/api/search_documents/` once the caller is allowed and the query is
/// parsed: waits for one of `CONCURRENT_SEARCHES` slots, then matches every live document as
/// it streams in. Public for `tests/document_search_load.rs`.
pub async fn run_search(
    state: &AppState,
    terms: &[String],
) -> anyhow::Result<Vec<WikiDocumentHit>> {
    let patterns = compile_terms(terms)?;
    let _slot = timeout(SEARCH_QUEUE_TIMEOUT, state.document_searches().acquire()).await??;
    let mut documents = state.db.searchable_documents().await?;
    let mut hits = Vec::new();
    while let Some(document) = documents.try_next().await? {
        if let Some(found) = match_document(&document.title, &document.content, &patterns) {
            hits.push((found, document.title, document._id));
        }
    }
    let titles: HashMap<String, String> = hits
        .iter()
        .map(|(_, title, id)| (id.clone(), title.clone()))
        .collect();
    Ok(best_hits(hits)
        .into_iter()
        .map(|(found, id)| WikiDocumentHit {
            title: titles[&id].clone(),
            _id: id,
            snippet: found.snippet,
        })
        .collect())
}

/// Creates a document with `title` as its first heading. Requires `UpdateDocuments`.
#[utoipa::path(
    post,
    path = "/api/create_document/",
    request_body = CreateDocumentRequestBody,
    responses(
        (status = 200, description = "The new document", body = WikiDocument),
        (status = 401, description = "Not logged in", content_type = "text/plain"),
        (status = 403, description = "Missing UpdateDocuments capability", content_type = "text/plain"),
        (status = 404, description = "Logged-in account has no user record", content_type = "text/plain"),
        (status = 422, description = "Invalid input (German text)", content_type = "text/plain"),
        (status = 500, description = "Database error (German text)", content_type = "text/plain")
    ),
    tag = "documents"
)]
pub async fn create_document(
    State(state): State<AppState>,
    AuthExtractor(auth): AuthExtractor,
    Json(body): Json<CreateDocumentRequestBody>,
) -> Response {
    let user = require_capability!(state, auth, UserCapabilities::UpdateDocuments);
    let title = match clean_name(&body.title, MAX_DOCUMENT_TITLE_CHARS, "der Titel") {
        Ok(title) => title,
        Err(message) => return refused(StatusCode::UNPROCESSABLE_ENTITY, message),
    };
    if body.content.chars().count() > MAX_DOCUMENT_TEXT_CHARS {
        let message =
            format!("Der Text ist zu lang (höchstens {MAX_DOCUMENT_TEXT_CHARS} Zeichen).");
        return refused(StatusCode::UNPROCESSABLE_ENTITY, message);
    }
    if let Some(refusal) = check_groups(&state, &body.group_ids).await {
        return refusal;
    }
    let text = first_text(&title, &body.content);
    match state
        .db
        .create_document(&text, body.group_ids, &user.id)
        .await
    {
        Ok(document) => (no_store(), Json(document)).into_response(),
        Err(e) => {
            eprintln!("create_document by {} failed: {e:#}", user.id);
            database_error()
        }
    }
}

async fn check_groups(state: &AppState, group_ids: &[String]) -> Option<Response> {
    if group_ids.len() > MAX_IDS_PER_REQUEST {
        return Some(refused(StatusCode::UNPROCESSABLE_ENTITY, TOO_MANY_IDS));
    }
    match state.db.document_groups_exist(group_ids).await {
        Ok(true) => None,
        Ok(false) => Some(refused(StatusCode::UNPROCESSABLE_ENTITY, UNKNOWN_GROUP)),
        Err(e) => {
            eprintln!("documents: group lookup failed: {e:#}");
            Some(database_error())
        }
    }
}

/// Sets the groups of a document. Requires `UpdateDocuments`. Answers with the list.
#[utoipa::path(
    post,
    path = "/api/set_document_groups/",
    request_body = SetDocumentGroupsRequestBody,
    responses(
        (status = 200, description = "Groups and documents", body = GetDocumentsResponseBody),
        (status = 401, description = "Not logged in", content_type = "text/plain"),
        (status = 403, description = "Missing UpdateDocuments capability", content_type = "text/plain"),
        (status = 404, description = "No such document or no user record", content_type = "text/plain"),
        (status = 422, description = "Unknown group (German text)", content_type = "text/plain"),
        (status = 500, description = "Database error (German text)", content_type = "text/plain")
    ),
    tag = "documents"
)]
pub async fn set_document_groups(
    State(state): State<AppState>,
    AuthExtractor(auth): AuthExtractor,
    Json(body): Json<SetDocumentGroupsRequestBody>,
) -> Response {
    let user = require_capability!(state, auth, UserCapabilities::UpdateDocuments);
    if let Some(refusal) = check_groups(&state, &body.group_ids).await {
        return refusal;
    }
    match state
        .db
        .set_document_groups(&body.document_id, &body.group_ids)
        .await
    {
        Ok(true) => documents_response(&state).await,
        Ok(false) => refused(StatusCode::NOT_FOUND, UNKNOWN_DOCUMENT),
        Err(e) => {
            eprintln!(
                "set_document_groups {} by {} failed: {e:#}",
                body.document_id, user.id
            );
            database_error()
        }
    }
}

/// Deletes a document (it stays in the database, like deleted meetings). Requires
/// `UpdateDocuments`. Answers with the list.
#[utoipa::path(
    post,
    path = "/api/delete_document/",
    request_body = DeleteDocumentRequestBody,
    responses(
        (status = 200, description = "Groups and documents", body = GetDocumentsResponseBody),
        (status = 401, description = "Not logged in", content_type = "text/plain"),
        (status = 403, description = "Missing UpdateDocuments capability", content_type = "text/plain"),
        (status = 404, description = "No such document or no user record", content_type = "text/plain"),
        (status = 500, description = "Database error (German text)", content_type = "text/plain")
    ),
    tag = "documents"
)]
pub async fn delete_document(
    State(state): State<AppState>,
    AuthExtractor(auth): AuthExtractor,
    Json(body): Json<DeleteDocumentRequestBody>,
) -> Response {
    let user = require_capability!(state, auth, UserCapabilities::UpdateDocuments);
    match state.db.delete_document(&body.document_id, &user.id).await {
        Ok(true) => {
            state
                .document_rooms
                .document_deleted(&body.document_id)
                .await;
            documents_response(&state).await
        }
        Ok(false) => refused(StatusCode::NOT_FOUND, UNKNOWN_DOCUMENT),
        Err(e) => {
            eprintln!(
                "delete_document {} by {} failed: {e:#}",
                body.document_id, user.id
            );
            database_error()
        }
    }
}
