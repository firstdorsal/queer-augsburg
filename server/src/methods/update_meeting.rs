use crate::{db::DB, interossea::Auth, types::UpdateMeetingRequestBody};
use anyhow::bail;
use hyper::{Body, Request, Response};

pub async fn update_meeting(
    mut req: Request<Body>,
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
        Some(true) => match umrb.meeting {
            Some(meeting) => {
                db.delete_meeting(&meeting._id).await?;
            }
            None => {
                bail!("No meeting id given");
            }
        },
        _ => match umrb.meeting {
            Some(meeting) => {
                db.update_meeting(&meeting).await?;
            }
            None => {
                bail!("No meeting id given");
            }
        },
    }

    Ok(res.body(Body::from("Hello world"))?)
}
