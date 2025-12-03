use crate::has_authorized_user_capability_or_error;
use crate::{
    db::DB,
    interossea::Auth,
    types::{ConfirmSendEmailRequestBody, ConfirmSendEmailResponseBody, SentEmailLog},
    utils::{generate_id, send_mail_with_attachments},
};
use hyper::{Body, Request, Response};

const DRAFT_TTL_MS: i64 = 30 * 60 * 1000; // 30 minutes
const TEST_EMAIL: &str = "test@queer-augsburg.de";

pub async fn confirm_send_email(
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
    let request: ConfirmSendEmailRequestBody = serde_json::from_slice(&body)?;

    // Check if testing mode is enabled (from frontend checkbox)
    let testing_mode = request.testing_mode.unwrap_or(false);

    // Atomically claim the draft (prevents race conditions)
    let draft = match db.claim_email_draft(&request.preview_id).await? {
        Some(d) => d,
        None => {
            // Could be not found OR already being processed
            return Ok(res
                .status(404)
                .body(Body::from("Draft not found or already being processed"))?);
        }
    };

    // Check TTL
    let now = chrono::Utc::now().timestamp_millis();
    if now - draft.created_at > DRAFT_TTL_MS {
        db.delete_email_draft(&request.preview_id).await?;
        return Ok(res
            .status(400)
            .body(Body::from("Draft expired, please try again"))?);
    }

    // Verify sender
    let user_id = match auth.authenticated_user.as_ref() {
        Some(id) => id,
        None => {
            return Ok(res.status(401).body(Body::from("Unauthorized"))?);
        }
    };
    if draft.sender_id != *user_id {
        return Ok(res
            .status(403)
            .body(Body::from("Not authorized to send this email"))?);
    }

    // Verify code
    if draft.verification_code != request.verification_code {
        return Ok(res
            .status(400)
            .body(Body::from("Invalid verification code"))?);
    }

    // Get recipient emails (test mode sends only to TEST_EMAIL)
    let recipient_emails = if testing_mode {
        vec![TEST_EMAIL.to_string()]
    } else {
        db.get_approved_member_emails().await?
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
    db.insert_sent_email_log(&log).await?;

    // Delete draft
    db.delete_email_draft(&request.preview_id).await?;

    // Return response
    let response = ConfirmSendEmailResponseBody {
        sent_count,
        failed_count,
    };

    Ok(res
        .status(200)
        .header("Content-Type", "application/json")
        .body(Body::from(serde_json::to_string(&response)?))?)
}
