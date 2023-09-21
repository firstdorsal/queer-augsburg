use crate::{db::DB, interossea::Auth, types::AcceptMemberApplicationRequestBody};
use anyhow::bail;
use hyper::{Body, Request, Response};

pub async fn accept_member_application(
    mut req: Request<Body>,
    db: DB,
    auth: &Auth,
    res: hyper::http::response::Builder,
) -> anyhow::Result<Response<Body>> {
    if auth.user_assertion.as_ref().map(|ua| ua.ir_admin) != Some(true) {
        bail!("Not authorized");
    };

    let body = hyper::body::to_bytes(req.into_body()).await?;

    let ama: AcceptMemberApplicationRequestBody = serde_json::from_slice(&body)?;

    db.accept_member_application(&ama.user_id).await?;

    Ok(res.status(200).body(Body::from("Ok")).unwrap())
}
