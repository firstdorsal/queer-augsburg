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
    types::{
        DraftStatus, EmailDraft, SendEmailPreviewRequestBody, SendEmailPreviewResponseBody,
        UserCapabilities,
    },
    utils::{generate_id, send_mail_with_attachments},
};

const MAX_ATTACHMENT_SIZE: usize = 10 * 1024 * 1024; // 10MB
const MAX_SUBJECT_LENGTH: usize = 200;
const MAX_BODY_LENGTH: usize = 100_000; // ~100KB
const MAX_ATTACHMENT_COUNT: usize = 10;

#[utoipa::path(
    post,
    path = "/api/send_email_preview/",
    request_body = SendEmailPreviewRequestBody,
    responses(
        (status = 200, description = "Preview created", body = SendEmailPreviewResponseBody),
        (status = 401, description = "Unauthorized"),
        (status = 403, description = "Forbidden"),
        (status = 400, description = "Validation error")
    ),
    tag = "email"
)]
pub async fn send_email_preview(
    State(state): State<AppState>,
    AuthExtractor(auth): AuthExtractor,
    Json(request): Json<SendEmailPreviewRequestBody>,
) -> Response {
    require_capability!(state, auth, UserCapabilities::SendMassEmail);

    // Validate subject
    if request.subject.trim().is_empty() {
        return (StatusCode::BAD_REQUEST, "Subject cannot be empty").into_response();
    }
    if request.subject.len() > MAX_SUBJECT_LENGTH {
        return (
            StatusCode::BAD_REQUEST,
            format!("Subject exceeds {} characters", MAX_SUBJECT_LENGTH),
        )
            .into_response();
    }
    // Prevent header injection
    if request.subject.contains('\r') || request.subject.contains('\n') {
        return (StatusCode::BAD_REQUEST, "Subject cannot contain newlines").into_response();
    }

    // Validate body
    if request.body.trim().is_empty() {
        return (StatusCode::BAD_REQUEST, "Body cannot be empty").into_response();
    }
    if request.body.len() > MAX_BODY_LENGTH {
        return (
            StatusCode::BAD_REQUEST,
            format!("Body exceeds {} characters", MAX_BODY_LENGTH),
        )
            .into_response();
    }

    // Validate attachment count
    if request.attachments.len() > MAX_ATTACHMENT_COUNT {
        return (
            StatusCode::BAD_REQUEST,
            format!("Maximum {} attachments allowed", MAX_ATTACHMENT_COUNT),
        )
            .into_response();
    }

    // Validate attachment size
    let total_size: usize = request.attachments.iter().map(|a| a.data.len()).sum();

    if total_size > MAX_ATTACHMENT_SIZE {
        return (StatusCode::BAD_REQUEST, "Attachments exceed 10MB limit").into_response();
    }

    // Get sender info
    let user_id = match auth.authenticated_user.as_ref() {
        Some(id) => id,
        None => return (StatusCode::UNAUTHORIZED, "Unauthorized").into_response(),
    };

    let user = match state.db.get_user(user_id).await {
        Ok(u) => u,
        Err(e) => return (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()).into_response(),
    };

    let sender_email = match user.and_then(|u| u.member) {
        Some(m) => m.email,
        None => return (StatusCode::BAD_REQUEST, "Sender has no member email").into_response(),
    };

    // Count approved members
    let recipient_count = match state.db.count_approved_members().await {
        Ok(count) => count,
        Err(e) => return (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()).into_response(),
    };

    // Check for zero recipients
    if recipient_count == 0 {
        return (StatusCode::BAD_REQUEST, "No approved members to send to").into_response();
    }

    // Generate verification code and draft ID
    let verification_code = generate_id(8);
    let draft_id = generate_id(16);

    // Create draft
    let draft = EmailDraft {
        _id: draft_id.clone(),
        sender_id: user_id.clone(),
        sender_email: sender_email.clone(),
        subject: request.subject.clone(),
        body: request.body.clone(),
        attachments: request.attachments.clone(),
        verification_code: verification_code.clone(),
        created_at: chrono::Utc::now().timestamp_millis(),
        recipient_count,
        status: DraftStatus::Pending,
        reply_to: request.reply_to.clone(),
    };

    // Store draft
    if let Err(e) = state.db.insert_email_draft(&draft).await {
        return (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()).into_response();
    }

    // Send preview email to sender with verification code
    let preview_body = format!(
        "{}\n\n---\nDies ist eine Vorschau. Die E-Mail wird an {} Mitglieder gesendet.\n\nBestätigungscode: {}",
        request.body,
        recipient_count,
        verification_code
    );

    if let Err(e) = send_mail_with_attachments(
        &sender_email,
        &format!("[Vorschau] {}", request.subject),
        preview_body,
        &request.attachments,
        request.reply_to.as_deref(),
    )
    .await
    {
        return (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()).into_response();
    }

    // Return response
    let response = SendEmailPreviewResponseBody {
        preview_id: draft_id,
        recipient_count,
    };

    Json(response).into_response()
}
