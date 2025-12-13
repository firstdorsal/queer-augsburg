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
    types::{ConfirmSendEmailRequestBody, ConfirmSendEmailResponseBody, SentEmailLog, UserCapabilities},
    utils::{generate_id, send_mail_with_attachments},
};

const DRAFT_TTL_MS: i64 = 30 * 60 * 1000; // 30 minutes
const TEST_EMAIL: &str = "test@queer-augsburg.de";

#[utoipa::path(
    post,
    path = "/api/confirm_send_email/",
    request_body = ConfirmSendEmailRequestBody,
    responses(
        (status = 200, description = "Email sent", body = ConfirmSendEmailResponseBody),
        (status = 401, description = "Unauthorized"),
        (status = 403, description = "Forbidden"),
        (status = 400, description = "Validation error"),
        (status = 404, description = "Draft not found")
    ),
    tag = "email"
)]
pub async fn confirm_send_email(
    State(state): State<AppState>,
    AuthExtractor(auth): AuthExtractor,
    Json(request): Json<ConfirmSendEmailRequestBody>,
) -> Response {
    require_capability!(state, auth, UserCapabilities::SendMassEmail);

    // Check if testing mode is enabled
    let testing_mode = request.testing_mode.unwrap_or(false);

    // Atomically claim the draft (prevents race conditions)
    let draft = match state.db.claim_email_draft(&request.preview_id).await {
        Ok(Some(d)) => d,
        Ok(None) => {
            return (
                StatusCode::NOT_FOUND,
                "Draft not found or already being processed",
            )
                .into_response();
        }
        Err(e) => return (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()).into_response(),
    };

    // Check TTL
    let now = chrono::Utc::now().timestamp_millis();
    if now - draft.created_at > DRAFT_TTL_MS {
        let _ = state.db.delete_email_draft(&request.preview_id).await;
        return (StatusCode::BAD_REQUEST, "Draft expired, please try again").into_response();
    }

    // Verify sender
    let user_id = match auth.authenticated_user.as_ref() {
        Some(id) => id,
        None => return (StatusCode::UNAUTHORIZED, "Unauthorized").into_response(),
    };
    if draft.sender_id != *user_id {
        return (StatusCode::FORBIDDEN, "Not authorized to send this email").into_response();
    }

    // Verify code
    if draft.verification_code != request.verification_code {
        return (StatusCode::BAD_REQUEST, "Invalid verification code").into_response();
    }

    // Get recipient emails (test mode sends only to TEST_EMAIL)
    let recipient_emails = if testing_mode {
        vec![TEST_EMAIL.to_string()]
    } else {
        match state.db.get_approved_member_emails().await {
            Ok(emails) => emails,
            Err(e) => return (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()).into_response(),
        }
    };

    // Send to each recipient, tracking failures
    let mut sent_count: u32 = 0;
    let mut failed_count: u32 = 0;
    let mut failed_emails: Vec<String> = Vec::new();

    for email in &recipient_emails {
        match send_mail_with_attachments(
            email,
            &draft.subject,
            draft.body.clone(),
            &draft.attachments,
            draft.reply_to.as_deref(),
        )
        .await
        {
            Ok(_) => sent_count += 1,
            Err(_) => {
                failed_count += 1;
                failed_emails.push(email.clone());
            }
        }
    }

    // Create audit log
    let log = SentEmailLog {
        _id: generate_id(16),
        sender_id: draft.sender_id,
        sender_email: draft.sender_email,
        subject: draft.subject,
        body: draft.body,
        attachment_names: draft.attachments.iter().map(|a| a.filename.clone()).collect(),
        sent_at: chrono::Utc::now().timestamp_millis(),
        successful_count: sent_count,
        failed_count,
        failed_emails,
        reply_to: draft.reply_to,
    };

    if let Err(e) = state.db.insert_sent_email_log(&log).await {
        return (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()).into_response();
    }

    // Delete draft
    let _ = state.db.delete_email_draft(&request.preview_id).await;

    // Return response
    let response = ConfirmSendEmailResponseBody {
        sent_count,
        failed_count,
    };

    Json(response).into_response()
}
