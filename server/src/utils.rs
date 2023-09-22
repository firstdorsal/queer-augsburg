use crate::{config::SERVER_CONFIG, db::DB, some_or_bail, types::Meeting};
use anyhow::bail;
use hyper::{Body, Request};
use lettre::{
    message::{header, MultiPart, SinglePart},
    transport::smtp::authentication::Credentials,
    Message, SmtpTransport, Transport,
};
use qstring::QString;
use std::collections::HashMap;
pub async fn send_mail(
    recipient: &str,
    subject: &str,
    body_text: String,
    body_html: String,
) -> anyhow::Result<()> {
    let config = &SERVER_CONFIG;

    let mailer = SmtpTransport::relay(&config.mail.smtp_server)?
        .credentials(Credentials::new(
            config.mail.username.clone(),
            config.mail.password.clone(),
        ))
        .build();

    let email = Message::builder()
        .from(format!("{} <{}>", &config.mail.from_name, &config.mail.from_address).parse()?)
        .to(recipient.parse()?)
        .reply_to(config.mail.reply_to.parse()?)
        .user_agent(config.mail.user_agent.clone())
        .subject(subject)
        .multipart(
            MultiPart::alternative()
                .singlepart(
                    SinglePart::builder()
                        .header(header::ContentType::TEXT_PLAIN)
                        .body(body_text),
                )
                .singlepart(
                    SinglePart::builder()
                        .header(header::ContentType::TEXT_HTML)
                        .body(body_html),
                ),
        )?;

    mailer.send(&email)?;

    Ok(())
}

pub async fn import_old_meetings(db: &DB) -> anyhow::Result<()> {
    let file = include_str!("./old_meetings.json");
    let meetings: Vec<Meeting> = serde_json::from_str(file).unwrap();
    db.insert_old_meetings(meetings).await
}

pub fn get_token_from_query(req: &Request<Body>) -> Option<String> {
    get_query_item(req, "t")
}

#[allow(clippy::manual_map)]
pub fn get_query_item(req: &Request<Body>, item: &str) -> Option<String> {
    match req.uri().query() {
        Some(q) => match QString::from(q).get(item) {
            Some(qp) => Some(qp.to_string()),
            None => None,
        },
        None => None,
    }
}

pub fn get_query_item_number(req: &Request<Body>, item: &str) -> Option<i64> {
    match get_query_item(req, item) {
        Some(l) => match l.parse::<i64>() {
            Ok(l) => Some(l),
            Err(_) => None,
        },
        None => None,
    }
}

pub fn get_cookies(req: &Request<Body>) -> anyhow::Result<HashMap<String, String>> {
    let cookie_str = some_or_bail!(req.headers().get("cookie"), "No cookies found").to_str()?;
    let split = cookie_str.split(';');

    let mut cookies = HashMap::new();

    for s in split {
        let parsed_cookie = cookie::Cookie::parse(s);
        if let Ok(p) = parsed_cookie {
            cookies.insert(p.name().to_string(), p.value().to_string());
        }
    }

    Ok(cookies)
}

pub fn generate_id(len: usize) -> String {
    use rand::Rng;
    const CHARSET: &[u8; 64] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
    let mut rng = rand::thread_rng();

    (0..len)
        .map(|_| {
            let idx = rng.gen_range(0..CHARSET.len());
            CHARSET[idx] as char
        })
        .collect()
}

pub fn is_allowed_origin(origin_to_test: &str) -> anyhow::Result<()> {
    let config = &SERVER_CONFIG;
    if !config
        .services
        .iter()
        .any(|s| s.allowed_origins.iter().any(|ss| ss == origin_to_test))
    {
        bail!(
            "Assertion host mismatch: {} is not in list of allowed origins ",
            origin_to_test
        );
    }
    Ok(())
}

pub fn is_allowed_service_id(service_id_to_test: &str) -> anyhow::Result<()> {
    let config = &SERVER_CONFIG;
    if !config.services.iter().any(|s| s.id == service_id_to_test) {
        bail!(
            "Assertion service ID mismatch: {} is not in list of allowed service ids",
            service_id_to_test
        );
    }
    Ok(())
}
