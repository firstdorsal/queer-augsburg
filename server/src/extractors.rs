use axum::{
    extract::{ConnectInfo, FromRequestParts},
    http::{request::Parts, StatusCode},
    response::{IntoResponse, Response},
};
use axum_extra::extract::CookieJar;
use std::net::SocketAddr;

use crate::{
    config::SERVER_CONFIG,
    interossea::{Auth, UserAssertion, INTEROSSEA},
    state::AppState,
    utils::is_allowed_origin,
};

pub struct AuthExtractor(pub Auth);

impl FromRequestParts<AppState> for AuthExtractor {
    type Rejection = Response;

    async fn from_request_parts(
        parts: &mut Parts,
        state: &AppState,
    ) -> Result<Self, Self::Rejection> {
        let config = &SERVER_CONFIG;

        // Get client address
        let ConnectInfo(addr) = parts
            .extensions
            .get::<ConnectInfo<SocketAddr>>()
            .cloned()
            .ok_or_else(|| {
                (StatusCode::INTERNAL_SERVER_ERROR, "Could not get client address").into_response()
            })?;

        let user_assertion = if config.dev.insecure_skip_interossea {
            Some(UserAssertion {
                iat: 0,
                exp: 0,
                user_id: "dev".to_string(),
                service_id: "qa".to_string(),
                client_ip: "127.0.0.1".to_string(),
                service_origin: "localhost".to_string(),
                ir_admin: true,
            })
        } else {
            // Try to get user assertion from session cookie
            let cookies = CookieJar::from_headers(&parts.headers);
            if let Some(session_cookie) = cookies.get("session") {
                let session_map = state.session_map.read().await;
                if let Some(assertion) = session_map.get(session_cookie.value()).cloned() {
                    // Validate the assertion
                    let interossea = INTEROSSEA.get().ok_or_else(|| {
                        (StatusCode::INTERNAL_SERVER_ERROR, "Interossea not initialized")
                            .into_response()
                    })?;

                    let current_time = chrono::offset::Utc::now().timestamp_millis();
                    let token_created_time = assertion.iat;
                    let ip = addr.ip().to_string();

                    if interossea.assertion_validity_seconds * 1000 + token_created_time
                        < current_time
                    {
                        None // Assertion expired
                    } else if assertion.client_ip != ip {
                        None // IP mismatch
                    } else if is_allowed_origin(&assertion.service_origin).is_err() {
                        None // Origin not allowed
                    } else {
                        Some(assertion)
                    }
                } else {
                    None
                }
            } else {
                None
            }
        };

        let auth = Auth {
            authenticated_user: user_assertion.as_ref().map(|ua| ua.user_id.clone()),
            token: parts
                .uri
                .query()
                .and_then(|q| {
                    q.split('&')
                        .find(|p| p.starts_with("t="))
                        .map(|p| p[2..].to_string())
                }),
            user_assertion,
        };

        Ok(AuthExtractor(auth))
    }
}
