use crate::has_authorized_user_capability_or_error;
use crate::{
    db::DB,
    interossea::Auth,
    types::{DraftStatus, EmailDraft, SendEmailPreviewRequestBody, SendEmailPreviewResponseBody},
    utils::{generate_id, send_mail_with_attachments},
};
use hyper::{Body, Request, Response};

const MAX_ATTACHMENT_SIZE: usize = 10 * 1024 * 1024; // 10MB
const MAX_SUBJECT_LENGTH: usize = 200;
const MAX_BODY_LENGTH: usize = 100_000; // ~100KB
const MAX_ATTACHMENT_COUNT: usize = 10;

pub async fn send_email_preview(
    req: Request<Body>,
    db: DB,
    auth: &Auth,
    res: hyper::http::response::Builder,
) -> anyhow::Result<Response<Body>> {
    has_authorized_user_capability_or_error!(
        res,
        db,
        auth,
        crate::types::UserCapabilities::SendMassEmail
    );

    let body = hyper::body::to_bytes(req.into_body()).await?;
    let request: SendEmailPreviewRequestBody = serde_json::from_slice(&body)?;

    // Validate subject
    if request.subject.trim().is_empty() {
        return Ok(res
            .status(400)
            .body(Body::from("Subject cannot be empty"))?);
    }
    if request.subject.len() > MAX_SUBJECT_LENGTH {
        return Ok(res
            .status(400)
            .body(Body::from(format!(
                "Subject exceeds {} characters",
                MAX_SUBJECT_LENGTH
            )))?);
    }
    // Prevent header injection
    if request.subject.contains('\r') || request.subject.contains('\n') {
        return Ok(res
            .status(400)
            .body(Body::from("Subject cannot contain newlines"))?);
    }

    // Validate body
    if request.body.trim().is_empty() {
        return Ok(res
            .status(400)
            .body(Body::from("Body cannot be empty"))?);
    }
    if request.body.len() > MAX_BODY_LENGTH {
        return Ok(res
            .status(400)
            .body(Body::from(format!(
                "Body exceeds {} characters",
                MAX_BODY_LENGTH
            )))?);
    }

    // Validate attachment count
    if request.attachments.len() > MAX_ATTACHMENT_COUNT {
        return Ok(res
            .status(400)
            .body(Body::from(format!(
                "Maximum {} attachments allowed",
                MAX_ATTACHMENT_COUNT
            )))?);
    }

    // Validate attachment size
    let total_size: usize = request
        .attachments
        .iter()
        .map(|a| a.data.len())
        .sum();

    if total_size > MAX_ATTACHMENT_SIZE {
        return Ok(res
            .status(400)
            .body(Body::from("Attachments exceed 10MB limit"))?);
    }

    // Get sender info (safe: macro already verified auth)
    let user_id = match auth.authenticated_user.as_ref() {
        Some(id) => id,
        None => {
            return Ok(res.status(401).body(Body::from("Unauthorized"))?);
        }
    };
    let user = db.get_user(user_id).await?;
    let sender_email = match user.and_then(|u| u.member) {
        Some(m) => m.email,
        None => {
            return Ok(res
                .status(400)
                .body(Body::from("Sender has no member email"))?);
        }
    };

    // Count approved members
    let recipient_count = db.count_approved_members().await?;

    // Check for zero recipients
    if recipient_count == 0 {
        return Ok(res
            .status(400)
            .body(Body::from("No approved members to send to"))?);
    }

    // Generate verification code and draft ID
    let verification_code = generate_id(8); // Increased from 6 to 8 for better security
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
    };

    // Store draft
    db.insert_email_draft(&draft).await?;

    // Send preview email to sender with verification code
    let preview_body = format!(
        "{}\n\n---\nDies ist eine Vorschau. Die E-Mail wird an {} Mitglieder gesendet.\n\nBestätigungscode: {}",
        request.body,
        recipient_count,
        verification_code
    );

    send_mail_with_attachments(
        &sender_email,
        &format!("[Vorschau] {}", request.subject),
        preview_body,
        &request.attachments,
    )
    .await?;

    // Return response
    let response = SendEmailPreviewResponseBody {
        preview_id: draft_id,
        recipient_count,
    };

    Ok(res
        .status(200)
        .header("Content-Type", "application/json")
        .body(Body::from(serde_json::to_string(&response)?))?)
}
