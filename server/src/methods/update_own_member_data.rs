use axum::{
    extract::State,
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use serde_valid::Validate;

use crate::{
    extractors::AuthExtractor,
    state::AppState,
    types::{SetOwnMemberDataRequestBody, SubmittedMember},
    utils::send_mail,
};

#[utoipa::path(
    post,
    path = "/api/update_own_member_data/",
    request_body = SetOwnMemberDataRequestBody,
    responses(
        (status = 200, description = "Member data updated"),
        (status = 401, description = "Unauthorized"),
        (status = 400, description = "Validation error")
    ),
    tag = "members"
)]
pub async fn update_own_member_data(
    State(state): State<AppState>,
    AuthExtractor(auth): AuthExtractor,
    Json(body): Json<SetOwnMemberDataRequestBody>,
) -> Response {
    let user_id = match &auth.authenticated_user {
        Some(user_id) => user_id,
        None => return (StatusCode::UNAUTHORIZED, "Unauthorized").into_response(),
    };

    if let Err(e) = body.member.validate() {
        return (StatusCode::BAD_REQUEST, e.to_string()).into_response();
    }

    if let Err(e) = validate_submitted_member(&body.member) {
        return (StatusCode::BAD_REQUEST, e.to_string()).into_response();
    }

    let email = body.member.email.clone();

    let first_time = match state.db.update_member_data(user_id, body.member).await {
        Ok(first_time) => first_time,
        Err(e) => return (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()).into_response(),
    };

    if first_time {
        let subject = "Dein Mitgliedsantrag bei Queer Augsburg wurde eingereicht!".to_string();
        let body_text = "Dein Mitgliedsantrag bei Queer Augsburg wurde eingereicht!".to_string();

        if let Err(e) = send_mail(&email, &subject, body_text.clone(), body_text).await {
            return (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()).into_response();
        }
    } else {
        let subject = "Deine Mitgliedsdaten bei Queer Augsburg wurden aktualisiert!".to_string();
        let body_text = "Deine Mitgliedsdaten bei Queer Augsburg wurden aktualisiert!".to_string();

        if let Err(e) = send_mail(&email, &subject, body_text.clone(), body_text).await {
            return (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()).into_response();
        }
    }

    (StatusCode::OK, "Ok").into_response()
}

pub fn validate_submitted_member(sm: &SubmittedMember) -> anyhow::Result<()> {
    use anyhow::bail;

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
