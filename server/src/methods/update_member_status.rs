use crate::{db::DB, interossea::Auth, types::UpdateMemberStatusRequestBody, utils::send_mail};
use anyhow::bail;
use hyper::{Body, Request, Response};

pub async fn update_member_status(
    req: Request<Body>,
    db: DB,
    auth: &Auth,
    res: hyper::http::response::Builder,
) -> anyhow::Result<Response<Body>> {
    if auth.user_assertion.as_ref().map(|ua| ua.ir_admin) != Some(true) {
        bail!("Not authorized");
    };

    let body = hyper::body::to_bytes(req.into_body()).await?;

    let ama: UpdateMemberStatusRequestBody = serde_json::from_slice(&body)?;

    db.update_member_status(&ama.user_id, &ama.new_status)
        .await?;

    if ama.send_mail {
        if let Some(u) = db.get_user(&ama.user_id).await? {
            if let Some(m) = u.member {
                let (subject, body_text) = match ama.new_status {
                    crate::types::MembershipStatus::Approved => (
                        "Dein Mitgliedsantrag bei Queer Augsburg wurde angenommen!".to_string(),
                        "Dein Mitgliedsantrag bei Queer Augsburg wurde angenommen!".to_string(),
                    ),
                    crate::types::MembershipStatus::Rejected => (
                        "Dein Mitgliedsantrag bei Queer Augsburg wurde abgelehnt.".to_string(),
                        "Dein Mitgliedsantrag bei Queer Augsburg wurde abgelehnt.".to_string(),
                    ),
                    crate::types::MembershipStatus::Pending => (
                        "Dein Mitgliedsantrag bei Queer Augsburg ist in Bearbeitung".to_string(),
                        "Dein Mitgliedsantrag bei Queer Augsburg ist in Bearbeitung".to_string(),
                    ),
                    crate::types::MembershipStatus::Left => (
                        "Du hast Queer Augsburg verlassen.".to_string(),
                        "Du hast Queer Augsburg verlassen.".to_string(),
                    ),
                    crate::types::MembershipStatus::Expelled => (
                        "Du wurdest von Queer Augsburg ausgeschlossen.".to_string(),
                        "Du wurdest von Queer Augsburg ausgeschlossen.".to_string(),
                    ),
                };
                let body_text = match ama.update_reason {
                    Some(ur) => format!("{}\n\nGrund: {}", body_text, ur),
                    None => body_text,
                };

                send_mail(&m.email, &subject, body_text.clone(), body_text).await?;
            }
        };
    }

    Ok(res.status(200).body(Body::from("Ok")).unwrap())
}
