use crate::has_authorized_user_capability_or_error;
use crate::{db::DB, interossea::Auth, types::UpdateMeetingRequestBody};
use hyper::{Body, Request, Response};

pub async fn update_meeting(
    req: Request<Body>,
    db: DB,
    auth: &Auth,
    res: hyper::http::response::Builder,
) -> anyhow::Result<Response<Body>> {
    has_authorized_user_capability_or_error!(
        res,
        db,
        auth,
        crate::types::UserCapabilities::UpdateMeetings
    );

    let body = hyper::body::to_bytes(req.into_body()).await?;

    let mut umrb: UpdateMeetingRequestBody = serde_json::from_slice(&body)?;

    match umrb.delete {
        Some(true) => {
            db.delete_meeting(&umrb.meeting._id).await?;
            Ok(res.body(Body::from("Ok"))?)
        }
        _ => {
            db.update_meeting(&mut umrb.meeting, auth).await?;
            Ok(res
                .header("Content-Type", "application/json")
                .body(Body::from(serde_json::to_string(&umrb.meeting)?))?)
        }
    }
}
