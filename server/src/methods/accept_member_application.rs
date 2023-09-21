use crate::{
    db::DB, interossea::Auth, types::AcceptMemberApplicationRequestBody, utils::send_mail,
};
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

    if let Some(u) = db.get_user(&ama.user_id).await? {
        if let Some(m) = u.member {
            let body_text = "Dein Mitgliedsantrag bei Queer Augsburg wurde angenommen!".to_string();
            let body_html = "Dein Mitgliedsantrag bei Queer Augsburg wurde angenommen!".to_string();

            send_mail(
                &m.email,
                "Dein Mitgliedsantrag wurde angenommen!",
                body_text,
                body_html,
            )
            .await?;
        }
    }

    db.accept_member_application(&ama.user_id).await?;

    Ok(res.status(200).body(Body::from("Ok")).unwrap())
}
