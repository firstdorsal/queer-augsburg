use crate::{
    config::{InterosseaConfig, SERVER_CONFIG},
    some_or_bail,
    utils::{generate_id, is_allowed_origin, is_allowed_service_id},
};
use anyhow::bail;
use axum::{
    http::{HeaderMap, StatusCode},
    response::{IntoResponse, Response},
};
use jsonwebtoken::{decode, DecodingKey, Validation};
use once_cell::sync::OnceCell;
use serde::{Deserialize, Serialize};
use std::{collections::HashMap, net::SocketAddr, sync::Arc};
use tokio::sync::RwLock;
use utoipa::ToSchema;

pub static INTEROSSEA: OnceCell<Interossea> = OnceCell::new();

#[derive(Deserialize, Debug, Serialize, Eq, PartialEq, Clone, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct UserAssertion {
    pub iat: i64,
    pub exp: i64,
    pub user_id: String,
    pub service_id: String,
    pub client_ip: String,
    pub service_origin: String,
    pub ir_admin: bool,
}

#[derive(Clone)]
pub struct Interossea {
    pub interossea_addr: String,
    pub assertion_validity_seconds: i64,
    pub decoding_key: DecodingKey,
}

#[derive(Deserialize, Debug, Serialize, Eq, PartialEq, Clone)]
pub struct Auth {
    pub authenticated_user: Option<String>,
    pub token: Option<String>,
    pub user_assertion: Option<UserAssertion>,
}

impl Interossea {
    pub async fn new(interossea_config: &InterosseaConfig) -> anyhow::Result<Interossea> {
        Ok(Interossea {
            interossea_addr: interossea_config.url.to_string(),
            decoding_key: get_decoding_key(&interossea_config.url).await?,
            assertion_validity_seconds: interossea_config.assertion_validity_seconds as i64,
        })
    }

    pub fn get_user_assertion_from_header(
        &self,
        headers: &HeaderMap,
        addr: SocketAddr,
    ) -> anyhow::Result<UserAssertion> {
        let authorization_header = some_or_bail!(
            headers.get("InterosseaUserAssertion"),
            "No UserAssertion header"
        )
        .to_str()?;

        let assertion = decode_assertion(authorization_header, &self.decoding_key)?;

        check_age_and_ip(
            &assertion,
            chrono::offset::Utc::now().timestamp_millis(),
            self.assertion_validity_seconds,
            &addr.ip().to_string(),
        )?;

        is_allowed_origin(&assertion.service_origin)?;
        is_allowed_service_id(&assertion.service_id)?;

        Ok(assertion)
    }

    pub async fn get_decoding_key(&self) -> anyhow::Result<DecodingKey> {
        get_decoding_key(&self.interossea_addr).await
    }
}

/// Checks signature and algorithm. Interossea issues `iat` and `exp` in milliseconds, which
/// jsonwebtoken would read as seconds far in the future: expiry is `check_age_and_ip`'s job.
fn decode_assertion(token: &str, key: &DecodingKey) -> jsonwebtoken::errors::Result<UserAssertion> {
    let mut validation = Validation::new(jsonwebtoken::Algorithm::RS256);
    validation.validate_exp = false;
    Ok(decode::<UserAssertion>(token, key, &validation)?.claims)
}

fn check_age_and_ip(
    assertion: &UserAssertion,
    now_ms: i64,
    validity_seconds: i64,
    ip: &str,
) -> anyhow::Result<()> {
    if validity_seconds * 1000 + assertion.iat < now_ms {
        bail!("Assertion expired");
    }
    if assertion.client_ip != ip {
        bail!("Assertion IP mismatch: {} != {}", assertion.client_ip, ip);
    }
    Ok(())
}

pub async fn get_decoding_key(interossea_addr: &str) -> anyhow::Result<DecodingKey> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(10))
        .build()?;
    let res = client
        .post(format!("{}/api/get_public_key/", interossea_addr))
        .send()
        .await?
        .error_for_status()?;
    let text = res.text().await?;
    Ok(DecodingKey::from_rsa_pem(text.as_bytes())?)
}

pub async fn create_session_cookie(
    headers: &HeaderMap,
    session_map: Arc<RwLock<HashMap<String, UserAssertion>>>,
    addr: SocketAddr,
) -> Response {
    let interossea = match INTEROSSEA.get() {
        Some(i) => i,
        None => {
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                "Interossea not initialized",
            )
                .into_response()
        }
    };

    let ua = match interossea.get_user_assertion_from_header(headers, addr) {
        Ok(ua) => ua,
        Err(e) => return (StatusCode::UNAUTHORIZED, e.to_string()).into_response(),
    };

    let new_session_id = generate_id(32);
    session_map.write().await.insert(new_session_id.clone(), ua);

    let session_cookie = cookie::Cookie::build(("session", &new_session_id))
        .path("/")
        .secure(true)
        .max_age(cookie::time::Duration::seconds(
            SERVER_CONFIG.interossea.assertion_validity_seconds as i64,
        ))
        .http_only(true)
        .same_site(cookie::SameSite::None)
        .build();

    (
        StatusCode::OK,
        [(axum::http::header::SET_COOKIE, session_cookie.to_string())],
        "OK",
    )
        .into_response()
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::{http::StatusCode, routing::post};
    use jsonwebtoken::{encode, EncodingKey, Header};

    // Throwaway key pair made for these tests; nothing outside them trusts it.
    const PRIVATE_KEY: &[u8] = include_bytes!("testdata/assertion-test-private-key.pem");
    const PUBLIC_KEY: &str = include_str!("testdata/assertion-test-public-key.pem");
    const ONE_HOUR_MS: i64 = 3_600_000;
    const VALIDITY_SECONDS: i64 = 600;
    const PROXY_IP: &str = "::ffff:192.168.160.27";

    /// The claims as interossea issues them: times in milliseconds, plus `irEmail`, which
    /// this server does not read.
    fn issued_claims() -> serde_json::Value {
        let now = chrono::offset::Utc::now().timestamp_millis();
        serde_json::json!({
            "iat": now,
            "exp": now + ONE_HOUR_MS,
            "userId": "test-user",
            "serviceId": "qa",
            "clientIp": PROXY_IP,
            "serviceOrigin": "https://queer-augsburg.de",
            "irAdmin": false,
            "irEmail": "test@example.invalid",
        })
    }

    fn signed(claims: &serde_json::Value) -> String {
        encode(
            &Header::new(jsonwebtoken::Algorithm::RS256),
            claims,
            &EncodingKey::from_rsa_pem(PRIVATE_KEY).unwrap(),
        )
        .unwrap()
    }

    fn base64url(bytes: &[u8]) -> String {
        use base64::Engine;
        base64::engine::general_purpose::URL_SAFE_NO_PAD.encode(bytes)
    }

    async fn stub_login_service(status: StatusCode, body: &'static str) -> String {
        let router = axum::Router::new().route(
            "/api/get_public_key/",
            post(move || async move { (status, body) }),
        );
        let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
        let address = listener.local_addr().unwrap();
        tokio::spawn(async move { axum::serve(listener, router).await.unwrap() });
        format!("http://{address}")
    }

    fn test_key() -> DecodingKey {
        DecodingKey::from_rsa_pem(PUBLIC_KEY.as_bytes()).unwrap()
    }

    #[tokio::test]
    async fn assertions_verify_with_the_key_fetched_over_plain_http() {
        let address = stub_login_service(StatusCode::OK, PUBLIC_KEY).await;
        let key = get_decoding_key(&address).await.unwrap();
        let assertion = decode_assertion(&signed(&issued_claims()), &key).unwrap();
        assert_eq!(assertion.user_id, "test-user");
        assert_eq!(assertion.service_origin, "https://queer-augsburg.de");
    }

    #[tokio::test]
    async fn an_error_page_from_the_login_service_is_not_read_as_a_key() {
        let address = stub_login_service(StatusCode::INTERNAL_SERVER_ERROR, PUBLIC_KEY).await;
        let error = get_decoding_key(&address).await.err().unwrap();
        assert!(error.to_string().contains("500"), "{error}");
    }

    #[test]
    fn an_edited_payload_is_refused() {
        let token = signed(&issued_claims());
        let parts: Vec<&str> = token.split('.').collect();
        let mut claims = issued_claims();
        claims["irAdmin"] = serde_json::json!(true);
        let forged_payload = base64url(claims.to_string().as_bytes());
        let forged = format!("{}.{forged_payload}.{}", parts[0], parts[2]);
        let error = decode_assertion(&forged, &test_key()).err().unwrap();
        assert_eq!(
            *error.kind(),
            jsonwebtoken::errors::ErrorKind::InvalidSignature
        );
    }

    #[test]
    fn other_algorithms_are_refused() {
        use jsonwebtoken::errors::ErrorKind;
        let claims = issued_claims();
        // The classic confusion: HMAC with the public key as the secret.
        let hmac = encode(
            &Header::new(jsonwebtoken::Algorithm::HS256),
            &claims,
            &EncodingKey::from_secret(PUBLIC_KEY.as_bytes()),
        )
        .unwrap();
        let error = decode_assertion(&hmac, &test_key()).err().unwrap();
        assert_eq!(*error.kind(), ErrorKind::InvalidAlgorithm);

        let header = base64url(br#"{"alg":"none","typ":"JWT"}"#);
        let unsigned = format!("{header}.{}.", base64url(claims.to_string().as_bytes()));
        assert!(decode_assertion(&unsigned, &test_key()).is_err());
    }

    #[test]
    fn age_is_counted_from_iat_in_milliseconds() {
        let assertion: UserAssertion = serde_json::from_value(issued_claims()).unwrap();
        let limit = assertion.iat + VALIDITY_SECONDS * 1000;
        assert!(check_age_and_ip(&assertion, limit, VALIDITY_SECONDS, PROXY_IP).is_ok());
        let error = check_age_and_ip(&assertion, limit + 1, VALIDITY_SECONDS, PROXY_IP);
        assert_eq!(error.unwrap_err().to_string(), "Assertion expired");
    }

    #[test]
    fn a_different_address_is_refused() {
        let assertion: UserAssertion = serde_json::from_value(issued_claims()).unwrap();
        let error = check_age_and_ip(&assertion, assertion.iat, VALIDITY_SECONDS, "192.0.2.1");
        assert!(error.unwrap_err().to_string().contains("IP mismatch"));
    }
}
