use backend::config::SERVER_CONFIG;
use backend::db::DB;
use backend::interossea::{get_session_cookie, Auth, Interossea, UserAssertion, INTEROSSEA};
use backend::methods::admin_create_member::admin_create_member;
use backend::methods::create_own_user::create_own_user;
use backend::methods::get_meetings::get_meetings;
use backend::methods::get_own_user::get_own_user;
use backend::methods::get_users::get_users;
use backend::methods::ical::{self, ical_feed};
use backend::methods::update_meeting::update_meeting;
use backend::methods::update_member_status::update_member_status;
use backend::methods::update_own_member_data::update_own_member_data;
use backend::utils::{get_token_from_query, is_allowed_origin};
use hyper::server::conn::AddrStream;
use hyper::service::{make_service_fn, service_fn};
use hyper::{Body, Method, Request, Response, Server};
use mongodb::options::ClientOptions;
use std::collections::HashMap;
use std::convert::Infallible;
use std::net::SocketAddr;
use std::sync::Arc;
use tokio::sync::RwLock;
// An async function that consumes a request, does nothing with it and returns a
// response.

#[tokio::main]
pub async fn main() -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    // reference variables declared with lazy_static because they are initialized on first access
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

    let internal_http_addr: SocketAddr = SERVER_CONFIG.http.internal_address.parse().unwrap();

    let server =
        Server::bind(&internal_http_addr).serve(make_service_fn(move |conn: &AddrStream| {
            let req_addr = conn.remote_addr();
            let session_map = Arc::clone(&session_map);
            async move {
                Ok::<_, Infallible>(service_fn(move |req| {
                    handle_request(req, req_addr, Arc::clone(&session_map))
                }))
            }
        }));

    println!("Listening on http://{}", internal_http_addr);

    server.with_graceful_shutdown(shutdown_signal()).await?;

    Ok(())
}

async fn shutdown_signal() {
    tokio::signal::ctrl_c()
        .await
        .expect("failed to install CTRL+C signal handler");
}

async fn handle_request(
    req: Request<Body>,
    addr: SocketAddr,
    session_map: Arc<RwLock<HashMap<String, UserAssertion>>>,
) -> Result<Response<Body>, Infallible> {
    match handle_inner(req, addr, session_map).await {
        Ok(res) => Ok(res),
        Err(e) => {
            println!("Internal Server Error: {}", e);
            Ok(Response::builder()
                .status(500)
                .body(Body::from(format!("Internal Server Error: {e}")))
                .unwrap())
        }
    }
}

async fn handle_inner(
    req: Request<Body>,
    addr: SocketAddr,
    session_map: Arc<RwLock<HashMap<String, UserAssertion>>>,
) -> anyhow::Result<Response<Body>> {
    let config = &SERVER_CONFIG;
    let db = DB::new(ClientOptions::parse(&config.db.url).await?).await?;

    let mut p = req.uri().path();
    if p.starts_with("/api") {
        p = &p[4..];
    } else {
        return Ok(Response::builder()
            .status(404)
            .body(Body::from("Not found"))
            .unwrap());
    }
    let m = req.method();

    let res = match req.headers().get("origin") {
        Some(origin) => {
            let origin_str = origin.to_str()?;
            if is_allowed_origin(origin_str).is_ok() {
                Response::builder()
                    .header("Access-Control-Allow-Origin", origin_str)
                    .header("Access-Control-Allow-Credentials", "true")
                    .header(
                        "Access-Control-Allow-Headers",
                        "interosseauserassertion, request",
                    )
            } else {
                Response::builder()
            }
        }
        None => Response::builder(),
    };

    if p.starts_with("/get_session_cookie/") && m == Method::POST {
        return get_session_cookie(&req, session_map, addr, res).await;
    }

    let user_assertion = match config.dev.insecure_skip_interossea {
        true => Some(UserAssertion {
            iat: 0,
            exp: 0,
            user_id: "dev".to_string(),
            service_id: "qa".to_string(),
            client_ip: "127.0.0.1".to_string(),
            service_origin: "localhost".to_string(),
            ir_admin: true,
        }),
        false => {
            match INTEROSSEA
                .get()
                .unwrap()
                .get_user_assertion_from_session(&req, addr, session_map)
                .await
            {
                Ok(v) => Some(v),
                Err(_) => None,
            }
        }
    };

    let auth = Auth {
        authenticated_user: user_assertion.as_ref().map(|ua| ua.user_id.clone()),
        token: get_token_from_query(&req),
        user_assertion,
    };

    if p.starts_with("/get_meetings/") && m == Method::GET {
        get_meetings(req, db, &auth, res).await
    } else if p.starts_with("/ical_feed/") && m == Method::GET {
        ical_feed(req, db, &auth, res).await
    } else if p.starts_with("/get_users/") && m == Method::GET {
        get_users(req, db, &auth, res).await
    } else if p.starts_with("/update_meeting/") && m == Method::POST {
        update_meeting(req, db, &auth, res).await
    } else if p.starts_with("/get_own_user/") && m == Method::GET {
        get_own_user(req, db, &auth, res).await
    } else if p.starts_with("/create_own_user/") && m == Method::POST {
        create_own_user(req, db, &auth, res).await
    } else if p.starts_with("/admin_create_member/") && m == Method::POST {
        admin_create_member(req, db, &auth, res).await
    } else if p.starts_with("/update_member_status/") && m == Method::POST {
        update_member_status(req, db, &auth, res).await
    } else if p.starts_with("/update_own_member_data/") && m == Method::POST {
        update_own_member_data(req, db, &auth, res).await
    } else if p == "/get_assertion_validity_seconds/" && m == Method::GET {
        Ok(res
            .status(200)
            .body(Body::from(
                config.interossea.assertion_validity_seconds.to_string(),
            ))
            .unwrap())
    } else if m == Method::OPTIONS {
        Ok(res.status(200).body(Body::from("Ok")).unwrap())
    } else {
        Ok(res.status(404).body(Body::from("Not found")).unwrap())
    }
}
