//! Tests against a real MongoDB, for what the driver decides: error kinds, returned documents,
//! rollbacks. `TEST_MONGODB_URI` names the server; CI always sets it (a `mongo:7.0` service).

use backend::db::{CreateMeetingsError, GroupNameError, MongoDocumentStore, DB};
use backend::document_rooms::{text_of_state, DocumentStore, NewVersion, SaveOutcome, SavedState};
use backend::document_rules::arrange_documents;
use backend::types::{DraftStatus, EmailDraft, GetDocumentsResponseBody, Meeting};
use mongodb::bson::{doc, Document};
use mongodb::Client;
use std::sync::Arc;

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

async fn listed(db: &DB) -> GetDocumentsResponseBody {
    let (groups, group_order, documents) = db.get_document_list().await.unwrap();
    arrange_documents(groups, &group_order, documents)
}

#[tokio::test]
async fn a_new_document_stores_its_text_as_state_and_keeps_it_out_of_reads() {
    let Some(db) = test_db().await else { return };
    let text = "# Größe\n\nÄnderung 🏳️‍🌈";
    let created = db.create_document(text, vec![], "user").await.unwrap();
    assert_eq!(created.title, "Größe");

    let read = db.get_document(&created._id).await.unwrap().unwrap();
    assert_eq!(read, created);

    let stored = db
        .db
        .collection::<Document>("documents")
        .find_one(doc! { "_id": &created._id })
        .await
        .unwrap()
        .unwrap();
    let state = stored.get_binary_generic("state").unwrap();
    assert_eq!(text_of_state(state).unwrap(), text);
    db.db.drop().await.unwrap();
}

#[tokio::test]
async fn deleted_documents_disappear_from_lists_reads_and_search() {
    let Some(db) = test_db().await else { return };
    let document = db.create_document("# Weg", vec![], "user").await.unwrap();
    assert!(db.delete_document(&document._id, "user").await.unwrap());
    assert!(!db.delete_document(&document._id, "user").await.unwrap());

    assert!(listed(&db).await.documents.is_empty());
    assert!(db.get_document(&document._id).await.unwrap().is_none());
    let mut search = db.searchable_documents().await.unwrap();
    assert!(!search.advance().await.unwrap());
    assert!(!db.set_document_groups(&document._id, &[]).await.unwrap());
    db.db.drop().await.unwrap();
}

#[tokio::test]
async fn group_names_are_unique_ignoring_case_and_accents() {
    let Some(db) = test_db().await else { return };
    db.create_document_group("Vorstand").await.unwrap();
    let error = db.create_document_group("vorständ").await.unwrap_err();
    assert!(matches!(error, GroupNameError::Taken));

    db.create_document_group("Orga").await.unwrap();
    let orga = listed(&db).await.groups.remove(0)._id;
    let error = db
        .rename_document_group(&orga, "VORSTAND")
        .await
        .unwrap_err();
    assert!(matches!(error, GroupNameError::Taken));
    assert!(db.rename_document_group(&orga, "Team").await.unwrap());
    db.db.drop().await.unwrap();
}

#[tokio::test]
async fn orders_survive_and_a_deleted_group_leaves_its_documents() {
    let Some(db) = test_db().await else { return };
    db.create_document_group("Alpha").await.unwrap();
    db.create_document_group("Beta").await.unwrap();
    let groups = listed(&db).await.groups;
    let (alpha, beta) = (groups[0]._id.clone(), groups[1]._id.clone());

    let first = db
        .create_document("# A", vec![alpha.clone()], "u")
        .await
        .unwrap();
    let second = db
        .create_document("# B", vec![alpha.clone(), beta.clone()], "u")
        .await
        .unwrap();

    db.set_document_group_order(&[beta.clone(), alpha.clone()])
        .await
        .unwrap();
    assert!(db
        .set_group_document_order(&alpha, &[second._id.clone(), first._id.clone()])
        .await
        .unwrap());

    let body = listed(&db).await;
    assert_eq!(body.groups[0]._id, beta);
    assert_eq!(
        body.groups[1].document_ids,
        vec![second._id.clone(), first._id.clone()]
    );

    assert!(db.delete_document_group(&alpha).await.unwrap());
    let body = listed(&db).await;
    assert_eq!(body.groups.len(), 1);
    assert_eq!(body.groups[0].document_ids, vec![second._id.clone()]);
    assert_eq!(body.ungrouped_ids, vec![first._id.clone()]);
    assert!(!db.delete_document_group(&alpha).await.unwrap());
    db.db.drop().await.unwrap();
}

#[tokio::test]
async fn a_room_saves_into_the_database_with_its_derived_fields() {
    let Some(db) = test_db().await else { return };
    let db = Arc::new(db);
    let store = MongoDocumentStore(db.clone());
    let document = db.create_document("# Alt\n", vec![], "u").await.unwrap();

    let loaded = store
        .load_state(document._id.clone())
        .await
        .unwrap()
        .unwrap();
    assert_eq!(loaded.state_version, 1);
    assert_eq!(text_of_state(&loaded.state).unwrap(), "# Alt\n");

    let saved = SavedState {
        state: loaded.state.clone(),
        content: "# Neu\n".to_string(),
        title: "Neu".to_string(),
        state_version: 1,
    };
    let outcome = store
        .save_state(document._id.clone(), saved.clone())
        .await
        .unwrap();
    assert_eq!(outcome, SaveOutcome::Saved { state_version: 2 });
    let read = db.get_document(&document._id).await.unwrap().unwrap();
    assert_eq!(read.title, "Neu");

    // The same version again means a second writer, a deleted document the end of the room.
    let outcome = store
        .save_state(document._id.clone(), saved.clone())
        .await
        .unwrap();
    assert_eq!(outcome, SaveOutcome::Gone);
    db.delete_document(&document._id, "u").await.unwrap();
    let late = SavedState {
        state_version: 2,
        ..saved
    };
    assert_eq!(
        store.save_state(document._id.clone(), late).await.unwrap(),
        SaveOutcome::Gone
    );
    assert!(store
        .load_state(document._id.clone())
        .await
        .unwrap()
        .is_none());
    db.db.drop().await.unwrap();
}

#[tokio::test]
async fn versions_skip_repeats_are_spaced_and_keep_the_newest() {
    let Some(db) = test_db().await else { return };
    let db = Arc::new(db);
    let store = MongoDocumentStore(db.clone());
    let add = |content: &str| {
        store.add_version(
            "d".to_string(),
            NewVersion {
                content: content.to_string(),
                editors: vec!["u".to_string()],
            },
        )
    };
    add("eins").await.unwrap();
    add("eins").await.unwrap();
    add("gleich danach").await.unwrap();
    let versions = db.get_document_versions("d").await.unwrap();
    assert_eq!(versions.len(), 1);
    assert_eq!(versions[0].content, "eins");

    let old = |n: i64| {
        doc! {
            "_id": format!("v{n}"), "document_id": "d", "content": format!("Stand {n}"),
            "editors": [], "saved_at": 1_000 + n,
        }
    };
    let stored = db.db.collection::<Document>("document_versions");
    stored.delete_many(doc! {}).await.unwrap();
    stored.insert_many((0..60).map(old)).await.unwrap();
    add("neu").await.unwrap();
    let versions = db.get_document_versions("d").await.unwrap();
    assert_eq!(versions.len(), 50);
    assert_eq!(versions[0].content, "neu");
    assert_eq!(stored.count_documents(doc! {}).await.unwrap(), 50);
    db.db.drop().await.unwrap();
}

#[tokio::test]
async fn two_people_sorting_at_once_lose_no_document() {
    let Some(db) = test_db().await else { return };
    db.create_document_group("Alpha").await.unwrap();
    let alpha = listed(&db).await.groups.remove(0)._id;
    let first = db
        .create_document("# A", vec![alpha.clone()], "u")
        .await
        .unwrap();
    let second = db
        .create_document("# B", vec![alpha.clone()], "u")
        .await
        .unwrap();

    let order = [second._id.clone()];
    let new_one = db.create_document("# C", vec![alpha.clone()], "u");
    let (reordered, added) = tokio::join!(db.set_group_document_order(&alpha, &order), new_one);
    assert!(reordered.unwrap());
    let added = added.unwrap();

    let body = listed(&db).await;
    let ids = &body.groups[0].document_ids;
    assert_eq!(ids[0], second._id);
    assert!(ids.contains(&first._id) && ids.contains(&added._id));
    assert_eq!(ids.len(), 3);
    db.db.drop().await.unwrap();
}

#[tokio::test]
async fn only_existing_groups_count() {
    let Some(db) = test_db().await else { return };
    db.create_document_group("Alpha").await.unwrap();
    let alpha = listed(&db).await.groups.remove(0)._id;
    assert!(db
        .document_groups_exist(std::slice::from_ref(&alpha))
        .await
        .unwrap());
    assert!(db
        .document_groups_exist(&[alpha.clone(), alpha.clone()])
        .await
        .unwrap());
    assert!(db.document_groups_exist(&[]).await.unwrap());
    assert!(!db
        .document_groups_exist(&[alpha, "weg".to_string()])
        .await
        .unwrap());
    db.db.drop().await.unwrap();
}
