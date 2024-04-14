use crate::{db::DB, interossea::Auth, types::GetUsersResponseBody, utils::get_query_item_number};
use anyhow::bail;
use hyper::{Body, Request, Response};
use crate::{has_authorized_user_capability_or_error};

pub async fn get_users(
    req: Request<Body>,
    db: DB,
    auth: &Auth,
    res: hyper::http::response::Builder,
) -> anyhow::Result<Response<Body>> {
    if auth.user_assertion.as_ref().map(|ua| ua.ir_admin) != Some(true) {
        bail!("Not authorized");
    };

    has_authorized_user_capability_or_error!(res, db, auth, crate::types::UserCapabilities::GetUsers);

    let limit = get_query_item_number(&req, "l");
    let from_index = get_query_item_number(&req, "i").unwrap_or(0);

    let (users, total_count) = db.get_users(limit, from_index as u64).await?;

    let users_response = GetUsersResponseBody { users, total_count };

    Ok(res
        .status(200)
        .header("Content-Type", "application/json")
        .body(serde_json::to_string(&users_response)?.into())
        .unwrap())
}
