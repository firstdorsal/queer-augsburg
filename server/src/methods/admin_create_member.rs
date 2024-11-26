use crate::{
    db::DB, has_authorized_user_capability_or_error, interossea::Auth, types::SubmittedMember,
    utils::generate_id,
};
use hyper::{Body, Request, Response};

pub async fn admin_create_member(
    req: Request<Body>,
    db: DB,
    auth: &Auth,
    res: hyper::http::response::Builder,
) -> anyhow::Result<Response<Body>> {
    has_authorized_user_capability_or_error!(
        res,
        db,
        auth,
        crate::types::UserCapabilities::CreateMember
    );

    let body = hyper::body::to_bytes(req.into_body()).await?;
    let submitted_member: SubmittedMember = serde_json::from_slice(&body)?;

    let user_id = generate_id(30);

    db.create_user(&user_id).await?;

    db.update_member_data(&user_id, submitted_member).await?;

    Ok(res
        .status(201)
        .body(Body::from("Nutzer erfolgreich erstellt"))?)
}
