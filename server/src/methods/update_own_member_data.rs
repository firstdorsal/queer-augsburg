use crate::{
    db::DB,
    interossea::Auth,
    types::{SetOwnMemberDataRequestBody, SubmittedMember},
    utils::send_mail,
};
use anyhow::bail;
use hyper::{Body, Request, Response};
use validator::Validate;

pub async fn update_own_member_data(
    req: Request<Body>,
    db: DB,
    auth: &Auth,
    res: hyper::http::response::Builder,
) -> anyhow::Result<Response<Body>> {
    let user_id = match &auth.authenticated_user {
        Some(user_id) => user_id,
        None => return Ok(res.status(401).body(Body::from("Unauthorized"))?),
    };

    let body = hyper::body::to_bytes(req.into_body()).await?;
    let uoub: SetOwnMemberDataRequestBody = serde_json::from_slice(&body)?;

    match uoub.member.validate() {
        Ok(_) => {}
        Err(e) => return Ok(res.status(400).body(Body::from(e.to_string()))?),
    };

    // more valdiation
    match validate_submitted_member(&uoub.member) {
        Ok(_) => {}
        Err(e) => return Ok(res.status(400).body(Body::from(e.to_string()))?),
    };

    let email = uoub.member.email.clone();

    let first_time = db.update_member_data(user_id, uoub.member).await?;

    if first_time {
        let subject = "Dein Mitgliedsantrag bei Queer Augsburg wurde eingereicht!".to_string();
        let body_text = "Dein Mitgliedsantrag bei Queer Augsburg wurde eingereicht!".to_string();

        send_mail(&email, &subject, body_text.clone(), body_text).await?;
    } else {
        let subject = "Deine Mitgliedsdaten bei Queer Augsburg wurden aktualisiert!".to_string();
        let body_text = "Deine Mitgliedsdaten bei Queer Augsburg wurden aktualisiert!".to_string();

        send_mail(&email, &subject, body_text.clone(), body_text).await?;
    }

    Ok(res.body(Body::from("Ok"))?)
}

pub fn validate_submitted_member(sm: &SubmittedMember) -> anyhow::Result<()> {
    // accept all policies
    if !(sm.above_18 && sm.approved_charter && sm.approved_privacy) {
        bail!("You must be above 18 and approve the charter and privacy policy to become a member")
    }

    // provide either name or institution
    if sm.natural_person {
        if sm.name.is_none() {
            bail!("You must provide a name")
        }
    } else if sm.institution.is_none() {
        bail!("You must provide an institution")
    }

    Ok(())
}
