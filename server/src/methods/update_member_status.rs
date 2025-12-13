use axum::{
    extract::State,
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};

use crate::{
    extractors::AuthExtractor,
    require_capability,
    state::AppState,
    types::{MembershipStatus, UpdateMemberStatusRequestBody, UserCapabilities},
    utils::send_mail,
};

#[utoipa::path(
    post,
    path = "/api/update_member_status/",
    request_body = UpdateMemberStatusRequestBody,
    responses(
        (status = 200, description = "Member status updated"),
        (status = 401, description = "Unauthorized"),
        (status = 403, description = "Forbidden")
    ),
    tag = "members"
)]
pub async fn update_member_status(
    State(state): State<AppState>,
    AuthExtractor(auth): AuthExtractor,
    Json(body): Json<UpdateMemberStatusRequestBody>,
) -> Response {
    require_capability!(state, auth, UserCapabilities::UpdateMemberStatus);

    if let Err(e) = state
        .db
        .update_member_status(&body.user_id, &body.new_status)
        .await
    {
        return (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()).into_response();
    }

    if body.send_mail {
        if let Ok(Some(u)) = state.db.get_user(&body.user_id).await {
            if let Some(m) = u.member {
                let (subject, body_text) = match body.new_status {
                    MembershipStatus::Approved => (
                        "Dein Mitgliedsantrag bei Queer Augsburg wurde angenommen!".to_string(),
                        "Dein Mitgliedsantrag bei Queer Augsburg wurde angenommen!".to_string(),
                    ),
                    MembershipStatus::Rejected => (
                        "Dein Mitgliedsantrag bei Queer Augsburg wurde abgelehnt.".to_string(),
                        "Dein Mitgliedsantrag bei Queer Augsburg wurde abgelehnt.".to_string(),
                    ),
                    MembershipStatus::Pending => (
                        "Dein Mitgliedsantrag bei Queer Augsburg ist in Bearbeitung".to_string(),
                        "Dein Mitgliedsantrag bei Queer Augsburg ist in Bearbeitung".to_string(),
                    ),
                    MembershipStatus::Left => (
                        "Du hast Queer Augsburg verlassen.".to_string(),
                        "Du hast Queer Augsburg verlassen.".to_string(),
                    ),
                    MembershipStatus::Expelled => (
                        "Du wurdest von Queer Augsburg ausgeschlossen.".to_string(),
                        "Du wurdest von Queer Augsburg ausgeschlossen.".to_string(),
                    ),
                };
                let body_text = match body.update_reason {
                    Some(ur) => format!("{}\n\nGrund: {}", body_text, ur),
                    None => body_text,
                };

                if let Err(e) = send_mail(&m.email, &subject, body_text.clone(), body_text).await {
                    return (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()).into_response();
                }
            }
        }
    }

    (StatusCode::OK, "Ok").into_response()
}
