use crate::{db::DB, interossea::Auth, types::UpdateMeetingRequestBody};
use anyhow::bail;
use hyper::{Body, Request, Response};

pub async fn update_meeting(
    req: Request<Body>,
    db: DB,
    auth: &Auth,
    res: hyper::http::response::Builder,
) -> anyhow::Result<Response<Body>> {
    if auth.user_assertion.as_ref().map(|ua| ua.ir_admin) != Some(true) {
        bail!("Not authorized");
    };

    let body = hyper::body::to_bytes(req.into_body()).await?;

    let umrb: UpdateMeetingRequestBody = serde_json::from_slice(&body)?;

    match umrb.delete {
        Some(true) => {
            db.delete_meeting(&umrb.meeting._id).await?;
            Ok(res.body(Body::from("Ok"))?)
        }
        _ => {
            db.update_meeting(&umrb.meeting).await?;
            Ok(res
                .header("Content-Type", "application/json")
                .body(Body::from(serde_json::to_string(&umrb.meeting)?))?)
        }
    }
}
