// The server's only unsafe code is the library's allocator. This forbid does not reach into
// the library's macros; tests/no_unsafe.rs scans them, within the limits lib.rs names.
#![forbid(unsafe_code)]

use axum::{
    extract::{ConnectInfo, DefaultBodyLimit},
    http::{header, Method, StatusCode},
    response::{Html, IntoResponse},
    routing::{get, post},
    Json, Router,
};
use backend::capped_allocator::CappedAllocator;
use backend::config::SERVER_CONFIG;
use backend::db::DB;
use backend::document_rooms::Rooms;
use backend::interossea::{Interossea, INTEROSSEA};
use backend::meeting_validation::MAX_BATCH_BODY_BYTES;
use backend::methods::admin_create_member::admin_create_member;
use backend::methods::confirm_send_email::confirm_send_email;
use backend::methods::create_meetings::create_meetings;
use backend::methods::create_own_user::create_own_user;
use backend::methods::document_groups::{
    create_document_group, delete_document_group, order_document_groups, order_group_documents,
    rename_document_group,
};
use backend::methods::document_sync::document_sync;
use backend::methods::documents::{
    create_document, delete_document, get_document, get_document_versions, get_documents,
    search_documents, set_document_groups,
};
use backend::methods::get_meeting_link::get_meeting_link;
use backend::methods::get_meetings::get_meetings;
use backend::methods::get_own_user::get_own_user;
use backend::methods::get_users::get_users;
use backend::methods::ical::ical_feed;
use backend::methods::meetings_overview::meetings_overview;
use backend::methods::places::{create_place, get_places};
use backend::methods::send_email_preview::send_email_preview;
use backend::methods::update_meeting::update_meeting;
use backend::methods::update_member_status::update_member_status;
use backend::methods::update_own_member_data::update_own_member_data;
use backend::state::AppState;
use std::net::SocketAddr;
use std::sync::Arc;
use std::time::Duration;
use tokio::signal::unix::{signal, SignalKind};
use tower_http::cors::{Any, CorsLayer};
use utoipa::OpenApi;
use utoipa_scalar::{Scalar, Servable};

/// Below `stop_grace_period` in the compose file.
const ROOMS_SHUTDOWN_TIMEOUT: Duration = Duration::from_secs(15);

#[global_allocator]
static ALLOCATOR: CappedAllocator = CappedAllocator;

#[derive(OpenApi)]
#[openapi(
    paths(
        backend::methods::get_meetings::get_meetings,
        backend::methods::get_meeting_link::get_meeting_link,
        backend::methods::places::get_places,
        backend::methods::places::create_place,
        backend::methods::ical::ical_feed,
        backend::methods::meetings_overview::meetings_overview,
        backend::methods::get_users::get_users,
        backend::methods::update_meeting::update_meeting,
        backend::methods::create_meetings::create_meetings,
        backend::methods::get_own_user::get_own_user,
        backend::methods::create_own_user::create_own_user,
        backend::methods::admin_create_member::admin_create_member,
        backend::methods::update_member_status::update_member_status,
        backend::methods::update_own_member_data::update_own_member_data,
        backend::methods::send_email_preview::send_email_preview,
        backend::methods::confirm_send_email::confirm_send_email,
        backend::methods::documents::get_documents,
        backend::methods::documents::get_document,
        backend::methods::documents::search_documents,
        backend::methods::documents::get_document_versions,
        backend::methods::documents::create_document,
        backend::methods::documents::set_document_groups,
        backend::methods::documents::delete_document,
        backend::methods::document_groups::create_document_group,
        backend::methods::document_groups::rename_document_group,
        backend::methods::document_groups::delete_document_group,
        backend::methods::document_groups::order_document_groups,
        backend::methods::document_groups::order_group_documents,
        get_assertion_validity_seconds,
    ),
    components(schemas(
        backend::types::MeetingsOverview,
        backend::types::MeetingSummary,
        backend::types::Meeting,
        backend::types::MeetingLocation,
        backend::types::OnlineMeeting,
        backend::types::Place,
        backend::types::CreatePlaceRequestBody,
        backend::types::CreatePlaceResponseBody,
        backend::types::GetPlacesResponseBody,
        backend::types::MeetingLinkResponseBody,
        backend::types::MeetingTags,
        backend::types::MeetingStatus,
        backend::types::CommonMeetingTag,
        backend::types::QueerMeetingTag,
        backend::types::ChangedMeeting,
        backend::types::User,
        backend::types::UserCapabilities,
        backend::types::InternalMember,
        backend::types::SubmittedMember,
        backend::types::MembershipStatus,
        backend::types::MemberType,
        backend::types::Name,
        backend::types::Address,
        backend::types::UpdateMeetingRequestBody,
        backend::types::NewMeeting,
        backend::types::CreateMeetingsRequestBody,
        backend::types::CreateMeetingsErrorBody,
        backend::types::CreateMeetingsErrorCode,
        backend::types::CreateMeetingsResponseBody,
        backend::types::GetMeetingsResponseBody,
        backend::types::GetUsersResponseBody,
        backend::types::MeetingTypeQuery,
        backend::types::SetOwnMemberDataRequestBody,
        backend::types::UpdateMemberStatusRequestBody,
        backend::types::EmailAttachment,
        backend::types::SendEmailPreviewRequestBody,
        backend::types::SendEmailPreviewResponseBody,
        backend::types::ConfirmSendEmailRequestBody,
        backend::types::ConfirmSendEmailResponseBody,
        backend::types::WikiDocument,
        backend::types::WikiDocumentSummary,
        backend::types::WikiDocumentGroup,
        backend::types::WikiDocumentHit,
        backend::types::WikiDocumentVersion,
        backend::types::GetDocumentVersionsResponseBody,
        backend::types::GetDocumentsResponseBody,
        backend::types::SearchDocumentsResponseBody,
        backend::types::CreateDocumentRequestBody,
        backend::types::SetDocumentGroupsRequestBody,
        backend::types::DeleteDocumentRequestBody,
        backend::types::CreateDocumentGroupRequestBody,
        backend::types::RenameDocumentGroupRequestBody,
        backend::types::DeleteDocumentGroupRequestBody,
        backend::types::OrderDocumentGroupsRequestBody,
        backend::types::OrderGroupDocumentsRequestBody,
    )),
    tags(
        (name = "meetings", description = "Meeting management endpoints"),
        (name = "places", description = "Places meetings take place at"),
        (name = "users", description = "User management endpoints"),
        (name = "members", description = "Member management endpoints"),
        (name = "email", description = "Email sending endpoints"),
        (name = "documents", description = "Internal documents for members"),
    )
)]
struct ApiDoc;

#[tokio::main]
pub async fn main() -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    // Reference variables declared with lazy_static because they are initialized on first access
    let _ = &SERVER_CONFIG.db;
    let config = &SERVER_CONFIG;

    if !config.dev.insecure_skip_interossea {
        match INTEROSSEA.set(Interossea::new(&config.interossea).await?) {
            Ok(_) => {}
            Err(_) => {
                panic!("Failed to initialize interossea");
            }
        };
    }

    let db = DB::connect(&config.db.url).await?;
    db.migrate().await?;

    let state = AppState::new(Arc::new(db));
    let document_rooms = state.document_rooms.clone();

    // Build CORS layer
    let cors = CorsLayer::new()
        .allow_methods([Method::GET, Method::POST, Method::OPTIONS])
        .allow_headers([
            header::CONTENT_TYPE,
            header::HeaderName::from_static("interosseauserassertion"),
            header::HeaderName::from_static("request"),
        ])
        .allow_credentials(true)
        .allow_origin(
            config
                .services
                .iter()
                .flat_map(|s| s.allowed_origins.iter())
                .filter_map(|o| o.parse().ok())
                .collect::<Vec<_>>(),
        );

    let api_routes = Router::new()
        .route("/get_meetings/", get(get_meetings))
        .route("/ical_feed/", get(ical_feed))
        .route("/get_users/", get(get_users))
        .route("/update_meeting/", post(update_meeting))
        .route("/meeting_link/", get(get_meeting_link))
        .route("/places/", get(get_places))
        .route("/create_place/", post(create_place))
        .route(
            "/create_meetings/",
            post(create_meetings).layer(DefaultBodyLimit::max(MAX_BATCH_BODY_BYTES)),
        )
        .route("/get_own_user/", get(get_own_user))
        .route("/create_own_user/", post(create_own_user))
        .route("/admin_create_member/", post(admin_create_member))
        .route("/update_member_status/", post(update_member_status))
        .route("/update_own_member_data/", post(update_own_member_data))
        .route("/send_email_preview/", post(send_email_preview))
        .route("/confirm_send_email/", post(confirm_send_email))
        .route("/documents/", get(get_documents))
        .route("/document/", get(get_document))
        .route("/search_documents/", get(search_documents))
        .route("/document_versions/", get(get_document_versions))
        .route("/document_sync/{document_id}", get(document_sync))
        .route("/create_document/", post(create_document))
        .route("/set_document_groups/", post(set_document_groups))
        .route("/delete_document/", post(delete_document))
        .route("/create_document_group/", post(create_document_group))
        .route("/rename_document_group/", post(rename_document_group))
        .route("/delete_document_group/", post(delete_document_group))
        .route("/order_document_groups/", post(order_document_groups))
        .route("/order_group_documents/", post(order_group_documents))
        .route(
            "/get_assertion_validity_seconds/",
            get(get_assertion_validity_seconds),
        )
        .route("/get_session_cookie/", post(get_session_cookie))
        .fallback(handle_not_found);

    // Clone session_map for cleanup task before state is moved
    let cleanup_session_map = state.session_map.clone();

    // Public data without credentials: any website or browser-based tool may read it.
    // Merged after `.layer(cors)`, which only wraps the routes added before it.
    let public_routes = Router::new()
        .route("/api/meetings_overview/", get(meetings_overview))
        .layer(
            CorsLayer::new()
                .allow_origin(Any)
                .allow_methods([Method::GET]),
        );

    let app = Router::new()
        .nest("/api", api_routes)
        .route("/docs", get(serve_scalar))
        .route("/openapi.json", get(serve_openapi))
        .layer(cors)
        .merge(public_routes)
        .with_state(state);

    let internal_http_addr: SocketAddr = config.http.internal_address.parse().unwrap();

    let listener = tokio::net::TcpListener::bind(&internal_http_addr).await?;
    println!("Listening on http://{}", internal_http_addr);
    println!("API docs available at http://{}/docs", internal_http_addr);

    // Spawn session cleanup task
    let assertion_validity_seconds = config.interossea.assertion_validity_seconds as i64;
    tokio::spawn(async move {
        let mut interval = tokio::time::interval(tokio::time::Duration::from_secs(60));
        loop {
            interval.tick().await;
            let current_time = chrono::offset::Utc::now().timestamp_millis();
            let mut session_map = cleanup_session_map.write().await;
            session_map.retain(|_, assertion| {
                assertion.iat + assertion_validity_seconds * 1000 > current_time
            });
        }
    });

    axum::serve(
        listener,
        app.into_make_service_with_connect_info::<SocketAddr>(),
    )
    .with_graceful_shutdown(shutdown_signal(document_rooms))
    .await?;

    Ok(())
}

/// `serve` does not wait for upgraded sockets, so the rooms must be done before this returns.
async fn shutdown_signal(document_rooms: Arc<Rooms>) {
    let mut terminate = signal(SignalKind::terminate()).expect("failed to install SIGTERM handler");
    tokio::select! {
        _ = terminate.recv() => {}
        result = tokio::signal::ctrl_c() => result.expect("failed to install CTRL+C handler"),
    }
    document_rooms.shut_down(ROOMS_SHUTDOWN_TIMEOUT).await;
}

#[utoipa::path(
    get,
    path = "/api/get_assertion_validity_seconds/",
    responses(
        (status = 200, description = "Returns assertion validity in seconds", body = String)
    )
)]
async fn get_assertion_validity_seconds() -> String {
    SERVER_CONFIG
        .interossea
        .assertion_validity_seconds
        .to_string()
}

async fn get_session_cookie(
    axum::extract::State(state): axum::extract::State<AppState>,
    ConnectInfo(addr): ConnectInfo<SocketAddr>,
    headers: axum::http::HeaderMap,
) -> impl IntoResponse {
    use backend::interossea::create_session_cookie;
    create_session_cookie(&headers, state.session_map, addr).await
}

async fn handle_not_found() -> impl IntoResponse {
    (StatusCode::NOT_FOUND, "Not found")
}

async fn serve_scalar() -> Html<String> {
    Html(Scalar::with_url("/openapi.json", ApiDoc::openapi()).to_html())
}

async fn serve_openapi() -> Json<utoipa::openapi::OpenApi> {
    Json(ApiDoc::openapi())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_overview_is_documented() {
        let api = ApiDoc::openapi();
        assert!(api.paths.paths.contains_key("/api/meetings_overview/"));
        let schemas = api.components.unwrap().schemas;
        assert!(schemas.contains_key("MeetingsOverview") && schemas.contains_key("MeetingSummary"));
    }

    #[test]
    fn the_documents_are_documented() {
        let api = ApiDoc::openapi();
        for path in [
            "/api/documents/",
            "/api/document/",
            "/api/search_documents/",
            "/api/document_versions/",
            "/api/create_document/",
            "/api/set_document_groups/",
            "/api/delete_document/",
            "/api/create_document_group/",
            "/api/rename_document_group/",
            "/api/delete_document_group/",
            "/api/order_document_groups/",
            "/api/order_group_documents/",
        ] {
            assert!(api.paths.paths.contains_key(path), "{path}");
        }
        assert!(api.components.unwrap().schemas.contains_key("WikiDocument"));
    }
}
