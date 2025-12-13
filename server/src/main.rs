use axum::{
    extract::ConnectInfo,
    http::{header, Method, StatusCode},
    response::{Html, IntoResponse},
    routing::{get, post},
    Json, Router,
};
use backend::config::SERVER_CONFIG;
use backend::db::DB;
use backend::interossea::{Interossea, UserAssertion, INTEROSSEA};
use backend::methods::admin_create_member::admin_create_member;
use backend::methods::confirm_send_email::confirm_send_email;
use backend::methods::create_own_user::create_own_user;
use backend::methods::get_meetings::get_meetings;
use backend::methods::get_own_user::get_own_user;
use backend::methods::get_users::get_users;
use backend::methods::ical::ical_feed;
use backend::methods::send_email_preview::send_email_preview;
use backend::methods::update_meeting::update_meeting;
use backend::methods::update_member_status::update_member_status;
use backend::methods::update_own_member_data::update_own_member_data;
use backend::state::AppState;
use mongodb::options::ClientOptions;
use std::collections::HashMap;
use std::net::SocketAddr;
use std::sync::Arc;
use tokio::sync::RwLock;
use tower_http::cors::CorsLayer;
use utoipa::OpenApi;
use utoipa_scalar::{Scalar, Servable};

#[derive(OpenApi)]
#[openapi(
    paths(
        backend::methods::get_meetings::get_meetings,
        backend::methods::ical::ical_feed,
        backend::methods::get_users::get_users,
        backend::methods::update_meeting::update_meeting,
        backend::methods::get_own_user::get_own_user,
        backend::methods::create_own_user::create_own_user,
        backend::methods::admin_create_member::admin_create_member,
        backend::methods::update_member_status::update_member_status,
        backend::methods::update_own_member_data::update_own_member_data,
        backend::methods::send_email_preview::send_email_preview,
        backend::methods::confirm_send_email::confirm_send_email,
        get_assertion_validity_seconds,
    ),
    components(schemas(
        backend::types::Meeting,
        backend::types::MeetingLocation,
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
    )),
    tags(
        (name = "meetings", description = "Meeting management endpoints"),
        (name = "users", description = "User management endpoints"),
        (name = "members", description = "Member management endpoints"),
        (name = "email", description = "Email sending endpoints"),
    )
)]
struct ApiDoc;

#[tokio::main]
pub async fn main() -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    // Reference variables declared with lazy_static because they are initialized on first access
    let _ = &SERVER_CONFIG.db;
    let config = &SERVER_CONFIG;
    let session_map = Arc::new(RwLock::new(HashMap::<String, UserAssertion>::new()));

    if !config.dev.insecure_skip_interossea {
        match INTEROSSEA.set(Interossea::new(&config.interossea).await?) {
            Ok(_) => {}
            Err(_) => {
                panic!("Failed to initialize interossea");
            }
        };
    }

    let db = DB::new(ClientOptions::parse(&config.db.url).await?).await?;
    db.create_collections().await?;

    let state = AppState {
        db: Arc::new(db),
        session_map,
    };

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
        .route("/get_own_user/", get(get_own_user))
        .route("/create_own_user/", post(create_own_user))
        .route("/admin_create_member/", post(admin_create_member))
        .route("/update_member_status/", post(update_member_status))
        .route("/update_own_member_data/", post(update_own_member_data))
        .route("/send_email_preview/", post(send_email_preview))
        .route("/confirm_send_email/", post(confirm_send_email))
        .route(
            "/get_assertion_validity_seconds/",
            get(get_assertion_validity_seconds),
        )
        .route("/get_session_cookie/", post(get_session_cookie))
        .fallback(handle_not_found);

    // Clone session_map for cleanup task before state is moved
    let cleanup_session_map = state.session_map.clone();

    let app = Router::new()
        .nest("/api", api_routes)
        .route("/docs", get(serve_scalar))
        .route("/openapi.json", get(serve_openapi))
        .layer(cors)
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
    .with_graceful_shutdown(shutdown_signal())
    .await?;

    Ok(())
}

async fn shutdown_signal() {
    tokio::signal::ctrl_c()
        .await
        .expect("failed to install CTRL+C signal handler");
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
