use crate::{
    db::DB,
    interossea::Auth,
    types::{InternalMember, SetOwnMemberDataRequestBody, SubmittedMember},
};
use anyhow::bail;
use hyper::{Body, Request, Response};
use validator::Validate;

pub async fn update_own_member_data(
    mut req: Request<Body>,
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

    uoub.member.validate()?;

    // more valdiation
    validate_submitted_member(&uoub.member)?;

    let sm = uoub.member;
    let current_time = chrono::Utc::now().timestamp();

    let internal_member = InternalMember {
        _type: sm._type,
        natural_person: sm.natural_person,
        name: sm.name,
        institution: sm.institution,
        pronouns: sm.pronouns,
        address: sm.address,
        email: sm.email,
        phone: sm.phone,
        start_time_secs: current_time,
        end_time_secs: None,
        approved: false,
        user_notes: sm.user_notes,
        admin_notes: None,
        reference: sm.reference,
        approved_charter: sm.approved_charter,
        approved_privacy: sm.approved_privacy,
        above_18: sm.above_18,
        linked_accounts: sm.linked_accounts,
    };

    db.update_member_data(user_id, internal_member).await?;

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
