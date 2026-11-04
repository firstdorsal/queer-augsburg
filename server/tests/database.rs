//! Tests against a real MongoDB, for what the driver decides: error kinds, returned documents,
//! rollbacks. `TEST_MONGODB_URI` names the server; CI always sets it (a `mongo:7.0` service).

use backend::db::{CreateMeetingsError, DB};
use backend::types::{DraftStatus, EmailDraft, Meeting};
use mongodb::bson::{doc, Document};
use mongodb::Client;

/// A database of its own, as tests run in parallel. `None` without a server, outside CI.
async fn test_db() -> Option<DB> {
    let Ok(uri) = std::env::var("TEST_MONGODB_URI") else {
        assert!(std::env::var("CI").is_err(), "CI must set TEST_MONGODB_URI");
        eprintln!("skipped: TEST_MONGODB_URI is not set");
        return None;
    };
    let client = Client::with_uri_str(uri).await.unwrap();
    let db = client.database(&format!("qa-test-{}", backend::utils::generate_id(12)));
    let db = DB { client, db };
    db.create_collections().await.unwrap();
    Some(db)
}

fn meeting(title: &str) -> Meeting {
    serde_json::from_value(serde_json::json!({
        "_id": "", "title": title, "authority": "", "age_restriction": [0],
        "time": 1_793_124_000_000_i64, "location": null,
        "description": "", "price": [0.0], "trigger_warning": null, "attendance": null,
        "rating": null, "accessibility": null,
        "tags": {"freeform": [], "common": [], "queer": []}, "status": "Planned",
        "changed": null, "cancelled": false, "deleted_at": null
    }))
    .unwrap()
}

fn draft(id: &str) -> EmailDraft {
    EmailDraft {
        _id: id.to_string(),
        sender_id: "sender".to_string(),
        sender_email: "sender@example.invalid".to_string(),
        subject: "Betreff".to_string(),
        body: "Text".to_string(),
        attachments: vec![],
        verification_code: "1234".to_string(),
        created_at: 1,
        recipient_count: 1,
        status: DraftStatus::Pending,
        reply_to: None,
    }
}

#[tokio::test]
async fn collections_and_indexes_can_be_created_again_on_every_start() {
    let Some(db) = test_db().await else { return };
    db.create_collections().await.unwrap();
    db.db.drop().await.unwrap();
}

#[tokio::test]
async fn an_email_draft_can_be_claimed_only_once() {
    let Some(db) = test_db().await else { return };
    db.insert_email_draft(&draft("d1")).await.unwrap();

    let claimed = db.claim_email_draft("d1").await.unwrap().unwrap();
    assert_eq!(claimed.status, DraftStatus::Processing);
    assert!(db.claim_email_draft("d1").await.unwrap().is_none());

    db.delete_email_draft("d1").await.unwrap();
    assert!(db.get_email_draft("d1").await.unwrap().is_none());
    db.db.drop().await.unwrap();
}

#[tokio::test]
async fn mass_emails_reach_approved_members_only() {
    let Some(db) = test_db().await else { return };
    let member = |email: &str, status: &str| {
        doc! {
            "type": "Active", "natural_person": true, "name": null, "institution": null,
            "pronouns": null,
            "address": { "street": "S", "number": "1", "addition": null, "zip": "86150",
                         "city": "Augsburg", "country": "DE" },
            "email": email, "phone": null, "start_time_ms": 1_i64, "end_time_ms": null,
            "status": status, "user_notes": null, "admin_notes": null, "reference": null,
            "approved_charter": true, "approved_privacy": true, "above_18": true,
            "honorary": false,
        }
    };
    let users = db.db.collection::<Document>("users");
    users
        .insert_many([
            doc! { "_id": "a", "member": member("a@example.invalid", "Approved"), "capabilities": [] },
            doc! { "_id": "b", "member": member("b@example.invalid", "Pending"), "capabilities": [] },
            doc! { "_id": "c", "member": null, "capabilities": [] },
        ])
        .await
        .unwrap();

    assert_eq!(db.count_approved_members().await.unwrap(), 1);
    assert_eq!(
        db.get_approved_member_emails().await.unwrap(),
        vec!["a@example.invalid".to_string()]
    );
    db.db.drop().await.unwrap();
}

#[tokio::test]
async fn places_with_the_same_name_race_to_one_place() {
    let Some(db) = test_db().await else { return };
    let (first, second) = tokio::join!(
        db.create_place("Café Neruda".to_string(), 48.0, 10.0, "a"),
        db.create_place("café  neruda".to_string(), 48.0, 10.0, "b"),
    );
    let (first, first_created) = first.unwrap();
    let (second, second_created) = second.unwrap();
    assert_eq!(first._id, second._id);
    assert!(first_created != second_created);
    assert_eq!(db.get_places().await.unwrap().len(), 1);
    db.db.drop().await.unwrap();
}

#[tokio::test]
async fn a_batch_of_meetings_gets_distinct_ids() {
    let Some(db) = test_db().await else { return };
    let meetings = (0..50).map(|n| meeting(&format!("Treffen {n}"))).collect();
    let created = db.create_meetings(meetings, "user").await.unwrap();
    let mut ids: Vec<_> = created.iter().map(|meeting| meeting._id.clone()).collect();
    ids.sort();
    ids.dedup();
    assert_eq!(ids.len(), 50);
    db.db.drop().await.unwrap();
}

#[tokio::test]
async fn a_batch_that_fails_halfway_leaves_nothing_behind() {
    let Some(db) = test_db().await else { return };
    db.db
        .run_command(doc! { "collMod": "meetings", "validator": { "title": { "$ne": "kaputt" } } })
        .await
        .unwrap();

    let batch = vec![meeting("gut"), meeting("kaputt"), meeting("auch gut")];
    let error = db.create_meetings(batch, "user").await.unwrap_err();
    assert!(
        matches!(error, CreateMeetingsError::RolledBack(_)),
        "{error}"
    );

    let stored = db.db.collection::<Document>("meetings");
    assert_eq!(stored.count_documents(doc! {}).await.unwrap(), 0);
    db.db.drop().await.unwrap();
}
