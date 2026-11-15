//! Reading everything back and comparing (research-postgres §4.4 item 2). Where the server
//! has a reader (`get_user`, `get_meeting`, `get_place`, `get_document`, the room's
//! `load_state`, `get_document_versions`, `get_document_list`) the rows go through it, so
//! the digest proves what the server will serve; the columns no reader touches are read
//! raw. The counts and digests go to the report, which `judge` then decides on. In test
//! builds a reader's answer passes through `fault` first, so the tests at the end of this
//! file can make each cross-check fire.

use super::canon;
use super::report::{Problem, Reason, Report};
use super::source::{
    Converted, DocumentRow, GroupOrderRow, GroupRow, OriginalUserRow, PlaceRow, UserRow, VersionRow,
};
use super::{describe_anyhow, describe_sqlx, Failure};
use crate::db::{PgDocumentStore, DB, MAX_DOCUMENT_VERSIONS};
use crate::document_rooms::DocumentStore;
use crate::types::SentEmailLog;
use serde_json::Value;
use sqlx::postgres::PgPool;
use sqlx::types::Json;
use sqlx::Row;
use std::sync::Arc;

fn failure(step: &'static str) -> impl FnOnce(sqlx::Error) -> Failure {
    move |e| Failure::Database {
        step,
        detail: describe_sqlx(&e),
    }
}

fn server_failure(step: &'static str) -> impl FnOnce(anyhow::Error) -> Failure {
    move |e| Failure::Database {
        step,
        detail: describe_anyhow(&e),
    }
}

async fn count(pool: &PgPool, table: &'static str, filter: &str) -> Result<i64, Failure> {
    let sql = format!("SELECT count(*) FROM {table} {filter}");
    sqlx::query_scalar(sqlx::AssertSqlSafe(sql))
        .fetch_one(pool)
        .await
        .map_err(failure(table))
}

/// Computes the digests of both sides and the invariants, then judges the report.
pub async fn verify_all(
    pool: &PgPool,
    c: &Converted,
    report: &mut Report,
) -> Result<bool, Failure> {
    let db = Arc::new(DB::new(pool.clone()));

    source_digests(c, report);

    report.collection("users").target = Some(count(pool, "users", "").await? as u64);
    report.collection("originalUsers").target =
        Some(count(pool, "original_users", "").await? as u64);
    report.collection("places").target = Some(count(pool, "places", "").await? as u64);
    report.collection("meetings").target = Some(count(pool, "meetings", "").await? as u64);
    report.collection("sent_email_logs").target =
        Some(count(pool, "sent_email_logs", "").await? as u64);
    report.collection("documents").target = Some(count(pool, "documents", "").await? as u64);
    report.collection("document_groups").target =
        Some(count(pool, "document_groups", "").await? as u64);
    report.collection("document_group_order").target =
        Some(count(pool, "document_group_order", "").await? as u64);
    report.collection("document_versions").target =
        Some(count(pool, "document_versions", "").await? as u64);

    report.collection("users").target_digest = Some(users(&db, pool).await?);
    report.collection("originalUsers").target_digest = Some(original_users(pool).await?);
    report.collection("places").target_digest = Some(places(&db, pool).await?);
    report.collection("meetings").target_digest = Some(meetings(&db, pool).await?);
    report.collection("sent_email_logs").target_digest = Some(sent_email_logs(pool).await?);
    report.collection("documents").target_digest = Some(documents(&db, pool, report).await?);
    let (groups_digest, order_digest) = groups(&db, pool, report).await?;
    report.collection("document_groups").target_digest = Some(groups_digest);
    report.collection("document_group_order").target_digest = Some(order_digest);
    report.collection("document_versions").target_digest = Some(versions(&db, pool, report).await?);

    report.invariant(
        "meeting_changes",
        c.change_count(),
        count(pool, "meeting_changes", "").await?,
    );
    report.invariant(
        "document_group_members",
        c.group_member_count(),
        count(pool, "document_group_members", "").await?,
    );
    report.invariant(
        "members",
        c.member_count(),
        count(pool, "members", "").await?,
    );
    let approved = db
        .count_approved_members()
        .await
        .map_err(server_failure("count_approved_members"))?;
    report.invariant(
        "members approved",
        c.approved_member_count(),
        i64::from(approved),
    );
    report.invariant(
        "documents live",
        c.live_document_count(),
        count(pool, "documents", "WHERE deleted_at IS NULL").await?,
    );
    let users: Vec<&str> = c.users.iter().map(|u| u.user.id.as_str()).collect();
    let meetings: Vec<&str> = c.meetings.iter().map(|m| m._id.as_str()).collect();
    let documents: Vec<&str> = c.documents.iter().map(|d| d._id.as_str()).collect();
    for (table, invariant, ids) in [
        ("users", "users in dump order", users),
        ("meetings", "meetings in dump order", meetings),
        ("documents", "documents in dump order", documents),
    ] {
        let in_place = in_dump_order(pool, table, &ids).await?;
        report.invariant(invariant, ids.len() as i64, in_place);
    }

    Ok(report.judge())
}

/// How many rows of the dump have their position in it (from 1) as `seq`, which orders
/// their ties as MongoDB did (`write.rs`).
async fn in_dump_order(pool: &PgPool, table: &'static str, ids: &[&str]) -> Result<i64, Failure> {
    let sql = format!("SELECT _id, seq FROM {table}");
    let stored: std::collections::HashMap<String, i64> = sqlx::query_as(sqlx::AssertSqlSafe(sql))
        .fetch_all(pool)
        .await
        .map_err(failure(table))?
        .into_iter()
        .collect();
    Ok(ids
        .iter()
        .zip(1_i64..)
        .filter(|(id, position)| stored.get(**id) == Some(position))
        .count() as i64)
}

fn source_digests(c: &Converted, report: &mut Report) {
    report.collection("users").source_digest = Some(canon::digest(
        c.users
            .iter()
            .map(|u| (u.user.id.clone(), canon::hash_user(u))),
    ));
    report.collection("originalUsers").source_digest = Some(canon::digest(
        c.original_users
            .iter()
            .map(|u| (u.user_id.clone(), canon::hash_original_user(u))),
    ));
    report.collection("places").source_digest = Some(canon::digest(
        c.places
            .iter()
            .map(|p| (p._id.clone(), canon::hash_place(p))),
    ));
    report.collection("meetings").source_digest = Some(canon::digest(
        c.meetings
            .iter()
            .map(|m| (m._id.clone(), canon::hash_meeting(m))),
    ));
    report.collection("sent_email_logs").source_digest = Some(canon::digest(
        c.sent_email_logs
            .iter()
            .map(|l| (l._id.clone(), canon::hash_sent_email_log(l))),
    ));
    report.collection("documents").source_digest = Some(canon::digest(
        c.documents
            .iter()
            .map(|d| (d._id.clone(), canon::hash_document(d))),
    ));
    report.collection("document_groups").source_digest = Some(canon::digest(
        c.groups
            .iter()
            .map(|g| (g._id.clone(), canon::hash_group(g))),
    ));
    report.collection("document_group_order").source_digest = Some(canon::digest(
        c.group_order
            .iter()
            .map(|o| (o._id.clone(), canon::hash_group_order(o))),
    ));
    report.collection("document_versions").source_digest = Some(canon::digest(
        c.versions
            .iter()
            .map(|v| (v._id.clone(), canon::hash_version(v))),
    ));
}

async fn users(db: &DB, pool: &PgPool) -> Result<String, Failure> {
    let rows = sqlx::query("SELECT _id, extra FROM users")
        .fetch_all(pool)
        .await
        .map_err(failure("users"))?;
    let mut hashes = Vec::with_capacity(rows.len());
    for row in rows {
        let id: String = row.try_get("_id").map_err(failure("users"))?;
        let extra: Option<Json<Value>> = row.try_get("extra").map_err(failure("users"))?;
        let user = db
            .get_user(&id)
            .await
            .map_err(server_failure("get_user"))?
            .ok_or(Failure::Database {
                step: "get_user",
                detail: "row vanished".to_string(),
            })?;
        let row = UserRow {
            user,
            extra: extra.map(|json| json.0),
        };
        hashes.push((id, canon::hash_user(&row)));
    }
    Ok(canon::digest(hashes))
}

async fn original_users(pool: &PgPool) -> Result<String, Failure> {
    let rows = sqlx::query("SELECT user_id, snapshot, created_at FROM original_users")
        .fetch_all(pool)
        .await
        .map_err(failure("original_users"))?;
    let mut hashes = Vec::with_capacity(rows.len());
    for row in rows {
        let snapshot: Json<Value> = row.try_get("snapshot").map_err(failure("original_users"))?;
        let row = OriginalUserRow {
            user_id: row.try_get("user_id").map_err(failure("original_users"))?,
            snapshot: snapshot.0,
            created_at: row
                .try_get("created_at")
                .map_err(failure("original_users"))?,
        };
        hashes.push((row.user_id.clone(), canon::hash_original_user(&row)));
    }
    Ok(canon::digest(hashes))
}

async fn places(db: &DB, pool: &PgPool) -> Result<String, Failure> {
    let rows = sqlx::query("SELECT _id, name_key, created_by, created_at FROM places")
        .fetch_all(pool)
        .await
        .map_err(failure("places"))?;
    let mut hashes = Vec::with_capacity(rows.len());
    for row in rows {
        let id: String = row.try_get("_id").map_err(failure("places"))?;
        let place = db
            .get_place(&id)
            .await
            .map_err(server_failure("get_place"))?
            .ok_or(Failure::Database {
                step: "get_place",
                detail: "row vanished".to_string(),
            })?;
        let row = PlaceRow {
            _id: place._id,
            name: place.name,
            name_key: row.try_get("name_key").map_err(failure("places"))?,
            lat: place.lat,
            lon: place.lon,
            created_by: row.try_get("created_by").map_err(failure("places"))?,
            created_at: row.try_get("created_at").map_err(failure("places"))?,
        };
        hashes.push((id, canon::hash_place(&row)));
    }
    Ok(canon::digest(hashes))
}

async fn meetings(db: &DB, pool: &PgPool) -> Result<String, Failure> {
    let ids: Vec<String> = sqlx::query_scalar("SELECT _id FROM meetings")
        .fetch_all(pool)
        .await
        .map_err(failure("meetings"))?;
    let mut hashes = Vec::with_capacity(ids.len());
    for id in ids {
        let meeting = db
            .get_meeting(&id)
            .await
            .map_err(server_failure("get_meeting"))?
            .ok_or(Failure::Database {
                step: "get_meeting",
                detail: "row vanished".to_string(),
            })?;
        hashes.push((id, canon::hash_meeting(&meeting)));
    }
    Ok(canon::digest(hashes))
}

async fn sent_email_logs(pool: &PgPool) -> Result<String, Failure> {
    let rows = sqlx::query(
        r#"
        SELECT _id, sender_id, sender_email, subject, body, attachment_names, sent_at,
            successful_count, failed_count, failed_emails, reply_to
        FROM sent_email_logs
        "#,
    )
    .fetch_all(pool)
    .await
    .map_err(failure("sent_email_logs"))?;
    let mut hashes = Vec::with_capacity(rows.len());
    for row in rows {
        let get = |name: &str| {
            row.try_get::<String, _>(name)
                .map_err(failure("sent_email_logs"))
        };
        let successful: i32 = row
            .try_get("successful_count")
            .map_err(failure("sent_email_logs"))?;
        let failed: i32 = row
            .try_get("failed_count")
            .map_err(failure("sent_email_logs"))?;
        let log = SentEmailLog {
            _id: get("_id")?,
            sender_id: get("sender_id")?,
            sender_email: get("sender_email")?,
            subject: get("subject")?,
            body: get("body")?,
            attachment_names: row
                .try_get("attachment_names")
                .map_err(failure("sent_email_logs"))?,
            sent_at: row.try_get("sent_at").map_err(failure("sent_email_logs"))?,
            successful_count: u32::try_from(successful).unwrap_or(u32::MAX),
            failed_count: u32::try_from(failed).unwrap_or(u32::MAX),
            failed_emails: row
                .try_get("failed_emails")
                .map_err(failure("sent_email_logs"))?,
            reply_to: row
                .try_get("reply_to")
                .map_err(failure("sent_email_logs"))?,
        };
        hashes.push((log._id.clone(), canon::hash_sent_email_log(&log)));
    }
    Ok(canon::digest(hashes))
}

/// Every document raw; the live ones also through `get_document` and the room's
/// `load_state`, which must see the same title, content, memberships, state and version.
async fn documents(db: &Arc<DB>, pool: &PgPool, report: &mut Report) -> Result<String, Failure> {
    let store = PgDocumentStore(db.clone());
    let rows = sqlx::query(
        r#"
        SELECT d._id, d.title, d.content, d.state, d.state_version, d.created_by,
            d.created_at, d.updated_at, d.deleted_by, d.deleted_at,
            COALESCE((SELECT array_agg(m.group_id ORDER BY m.position)
                      FROM document_group_members m WHERE m.document_id = d._id), '{}')
                AS group_ids
        FROM documents d
        "#,
    )
    .fetch_all(pool)
    .await
    .map_err(failure("documents"))?;
    let mut hashes = Vec::with_capacity(rows.len());
    for row in rows {
        let get = |name: &str| row.try_get::<String, _>(name).map_err(failure("documents"));
        let d = DocumentRow {
            _id: get("_id")?,
            title: get("title")?,
            content: get("content")?,
            state: row.try_get("state").map_err(failure("documents"))?,
            state_version: row.try_get("state_version").map_err(failure("documents"))?,
            group_ids: row.try_get("group_ids").map_err(failure("documents"))?,
            created_by: get("created_by")?,
            created_at: row.try_get("created_at").map_err(failure("documents"))?,
            updated_at: row.try_get("updated_at").map_err(failure("documents"))?,
            deleted_by: row.try_get("deleted_by").map_err(failure("documents"))?,
            deleted_at: row.try_get("deleted_at").map_err(failure("documents"))?,
        };
        if d.deleted_at.is_none() {
            let served = db
                .get_document(&d._id)
                .await
                .map_err(server_failure("get_document"))?;
            #[cfg(test)]
            let served = fault::document(served);
            let same = served.as_ref().is_some_and(|s| {
                s.title == d.title && s.content == d.content && s.group_ids == d.group_ids
            });
            if !same {
                report.error(Problem::new("documents", "", Reason::RereadDiffers));
            }
            let loaded = store
                .load_state(d._id.clone())
                .await
                .map_err(server_failure("load_state"))?;
            #[cfg(test)]
            let loaded = fault::state(loaded);
            let same_state = loaded
                .as_ref()
                .is_some_and(|l| l.state == d.state && l.state_version == d.state_version);
            if !same_state {
                report.error(Problem::new("documents", "state", Reason::RereadDiffers));
            }
        }
        hashes.push((d._id.clone(), canon::hash_document(&d)));
    }
    Ok(canon::digest(hashes))
}

/// Groups and the group order raw, cross-checked with what `get_document_list` serves.
async fn groups(db: &DB, pool: &PgPool, report: &mut Report) -> Result<(String, String), Failure> {
    let rows = sqlx::query("SELECT _id, name, name_key, document_order FROM document_groups")
        .fetch_all(pool)
        .await
        .map_err(failure("document_groups"))?;
    let mut groups = Vec::with_capacity(rows.len());
    for row in rows {
        groups.push(GroupRow {
            _id: row.try_get("_id").map_err(failure("document_groups"))?,
            name: row.try_get("name").map_err(failure("document_groups"))?,
            name_key: row
                .try_get("name_key")
                .map_err(failure("document_groups"))?,
            document_order: row
                .try_get("document_order")
                .map_err(failure("document_groups"))?,
        });
    }
    let rows = sqlx::query("SELECT _id, group_ids FROM document_group_order")
        .fetch_all(pool)
        .await
        .map_err(failure("document_group_order"))?;
    let mut orders = Vec::with_capacity(rows.len());
    for row in rows {
        orders.push(GroupOrderRow {
            _id: row
                .try_get("_id")
                .map_err(failure("document_group_order"))?,
            group_ids: row
                .try_get("group_ids")
                .map_err(failure("document_group_order"))?,
        });
    }

    let (served_groups, served_order, _) = db
        .get_document_list()
        .await
        .map_err(server_failure("get_document_list"))?;
    #[cfg(test)]
    let (served_groups, served_order) = fault::groups(served_groups, served_order);
    let mut served: Vec<(String, String, Vec<String>)> = served_groups
        .into_iter()
        .map(|g| (g._id, g.name, g.document_order))
        .collect();
    served.sort();
    let mut raw: Vec<(String, String, Vec<String>)> = groups
        .iter()
        .map(|g| (g._id.clone(), g.name.clone(), g.document_order.clone()))
        .collect();
    raw.sort();
    if served != raw {
        report.error(Problem::new("document_groups", "", Reason::RereadDiffers));
    }
    let raw_order = orders
        .iter()
        .find(|o| o._id == "main")
        .map(|o| o.group_ids.clone())
        .unwrap_or_default();
    if served_order != raw_order {
        report.error(Problem::new(
            "document_group_order",
            "",
            Reason::RereadDiffers,
        ));
    }

    Ok((
        canon::digest(groups.iter().map(|g| (g._id.clone(), canon::hash_group(g)))),
        canon::digest(
            orders
                .iter()
                .map(|o| (o._id.clone(), canon::hash_group_order(o))),
        ),
    ))
}

/// Every version raw; per document the newest `MAX_DOCUMENT_VERSIONS` must be what
/// `get_document_versions` serves.
async fn versions(db: &DB, pool: &PgPool, report: &mut Report) -> Result<String, Failure> {
    let rows =
        sqlx::query("SELECT _id, document_id, content, editors, saved_at FROM document_versions")
            .fetch_all(pool)
            .await
            .map_err(failure("document_versions"))?;
    let mut versions = Vec::with_capacity(rows.len());
    for row in rows {
        versions.push(VersionRow {
            _id: row.try_get("_id").map_err(failure("document_versions"))?,
            document_id: row
                .try_get("document_id")
                .map_err(failure("document_versions"))?,
            content: row
                .try_get("content")
                .map_err(failure("document_versions"))?,
            editors: row
                .try_get("editors")
                .map_err(failure("document_versions"))?,
            saved_at: row
                .try_get("saved_at")
                .map_err(failure("document_versions"))?,
        });
    }
    let mut document_ids: Vec<&String> = versions.iter().map(|v| &v.document_id).collect();
    document_ids.sort();
    document_ids.dedup();
    for document_id in document_ids {
        let mut newest: Vec<&VersionRow> = versions
            .iter()
            .filter(|v| &v.document_id == document_id)
            .collect();
        newest.sort_by(|a, b| b.saved_at.cmp(&a.saved_at).then(b._id.cmp(&a._id)));
        newest.truncate(MAX_DOCUMENT_VERSIONS as usize);
        let served = db
            .get_document_versions(document_id)
            .await
            .map_err(server_failure("get_document_versions"))?;
        #[cfg(test)]
        let served = fault::versions(served);
        let same = served.len() == newest.len()
            && served.iter().zip(&newest).all(|(s, n)| {
                s._id == n._id
                    && s.content == n.content
                    && s.editors == n.editors
                    && s.saved_at == n.saved_at
            });
        if !same {
            report.error(Problem::new("document_versions", "", Reason::RereadDiffers));
        }
    }
    Ok(canon::digest(
        versions
            .iter()
            .map(|v| (v._id.clone(), canon::hash_version(v))),
    ))
}

/// The fault seam of the tests below, in test builds only: a test names one change to what a
/// reader served, and the verification awaited in [`fault::FAULT`]'s scope compares the
/// changed answer with the raw rows. With today's readers the two sides cannot differ, so
/// without it no test would see a cross-check fire. Outside that scope, and in every build
/// that is not a test, the readers' answers are compared as they come.
#[cfg(test)]
mod fault {
    use crate::document_rooms::LoadedState;
    use crate::document_rules::StoredGroup;
    use crate::types::{WikiDocument, WikiDocumentVersion};

    /// One change to one reader's answer.
    #[derive(Debug, Clone, Copy, PartialEq, Eq)]
    pub enum Reread {
        /// `get_document` finds no document.
        DocumentGone,
        DocumentTitle,
        DocumentContent,
        /// The groups in the reverse order.
        DocumentGroups,
        /// `load_state` finds no document.
        StateGone,
        State,
        StateVersion,
        /// `get_document_list` serves one group fewer.
        GroupGone,
        GroupId,
        GroupName,
        /// A group's wished order of documents reversed.
        GroupDocumentOrder,
        /// The order of the groups reversed.
        GroupOrder,
        /// `get_document_versions` serves the oldest of its versions no more.
        VersionGone,
        VersionId,
        VersionContent,
        VersionEditors,
        VersionSavedAt,
    }

    tokio::task_local! {
        pub static FAULT: Reread;
    }

    fn is(fault: Reread) -> bool {
        FAULT.try_with(|active| *active == fault).unwrap_or(false)
    }

    pub fn document(served: Option<WikiDocument>) -> Option<WikiDocument> {
        if is(Reread::DocumentGone) {
            return None;
        }
        served.map(|mut s| {
            if is(Reread::DocumentTitle) {
                s.title.push('!');
            }
            if is(Reread::DocumentContent) {
                s.content.push('!');
            }
            if is(Reread::DocumentGroups) {
                s.group_ids.reverse();
            }
            s
        })
    }

    pub fn state(loaded: Option<LoadedState>) -> Option<LoadedState> {
        if is(Reread::StateGone) {
            return None;
        }
        loaded.map(|mut l| {
            if is(Reread::State) {
                l.state.push(0);
            }
            if is(Reread::StateVersion) {
                l.state_version += 1;
            }
            l
        })
    }

    pub fn groups(
        mut groups: Vec<StoredGroup>,
        mut order: Vec<String>,
    ) -> (Vec<StoredGroup>, Vec<String>) {
        if is(Reread::GroupGone) {
            groups.pop();
        }
        if let Some(group) = groups.first_mut() {
            if is(Reread::GroupId) {
                group._id.push('!');
            }
            if is(Reread::GroupName) {
                group.name.push('!');
            }
        }
        if is(Reread::GroupDocumentOrder) {
            for group in &mut groups {
                group.document_order.reverse();
            }
        }
        if is(Reread::GroupOrder) {
            order.reverse();
        }
        (groups, order)
    }

    /// A field changes on the version in the middle of those served, so a comparison that
    /// checks only the newest or only the oldest one fails too.
    pub fn versions(mut served: Vec<WikiDocumentVersion>) -> Vec<WikiDocumentVersion> {
        if is(Reread::VersionGone) {
            served.pop();
        }
        let middle = served.len() / 2;
        if let Some(version) = served.get_mut(middle) {
            if is(Reread::VersionId) {
                version._id.push('!');
            }
            if is(Reread::VersionContent) {
                version.content.push('!');
            }
            if is(Reread::VersionEditors) {
                version.editors.push("someone".to_string());
            }
            if is(Reread::VersionSavedAt) {
                version.saved_at += 1;
            }
        }
        served
    }
}

#[cfg(test)]
mod tests {
    use super::fault::{Reread, FAULT};
    use super::*;
    use crate::document_rules::sort_key;
    use crate::migrate::report::COLLECTIONS;
    use crate::migrate::write::write_all;
    use sqlx::postgres::{PgConnectOptions, PgPoolOptions};
    use sqlx::{AssertSqlSafe, Connection, PgConnection};
    use std::collections::BTreeMap;
    use std::future::Future;
    use std::time::Duration;

    /// How long a login may take, as in `tests/db_support`.
    const LOGIN_WAIT: Duration = Duration::from_secs(30);
    const T0: i64 = 1_730_000_000_000;

    async fn login(options: &PgConnectOptions) -> PgConnection {
        tokio::time::timeout(LOGIN_WAIT, PgConnection::connect_with(options))
            .await
            .expect("no login within LOGIN_WAIT")
            .unwrap()
    }

    /// Runs `body` with the connection options of a schema of its own in the database
    /// `TEST_DATABASE_URL` names (the shape of `tests/db_support`'s `TestSchema`, which a unit
    /// test cannot reach), and removes the schema afterwards, its sessions first, also when
    /// `body` panicked: the body runs as a task of its own, and its panic is raised again once
    /// the schema is gone. Skipped without the variable, outside CI. Not covered, as there: a
    /// process that ends without unwinding.
    async fn in_a_schema_of_its_own<F, Fut>(body: F)
    where
        F: FnOnce(PgConnectOptions) -> Fut,
        Fut: Future<Output = ()> + Send + 'static,
    {
        let Ok(url) = std::env::var("TEST_DATABASE_URL") else {
            assert!(
                std::env::var("CI").is_err(),
                "CI must set TEST_DATABASE_URL"
            );
            eprintln!("skipped: TEST_DATABASE_URL is not set");
            return;
        };
        let server: PgConnectOptions = url.parse().unwrap();
        // Lower-case letters, digits and `_`: a plain identifier, also inside `search_path`.
        let name = format!(
            "qa_test_{}",
            crate::utils::generate_id(12)
                .to_lowercase()
                .replace('-', "_")
        );
        let mut connection = login(&server).await;
        sqlx::query(AssertSqlSafe(format!("CREATE SCHEMA \"{name}\"")))
            .execute(&mut connection)
            .await
            .unwrap();
        let options = server
            .clone()
            .options([("search_path", &name)])
            .application_name(&name);
        let outcome = tokio::spawn(body(options)).await;

        let removal = async {
            sqlx::query(
                "SELECT pg_terminate_backend(pid, $2) FROM pg_stat_activity \
                 WHERE application_name = $1 AND pid <> pg_backend_pid()",
            )
            .bind(&name)
            .bind(i64::try_from(LOGIN_WAIT.as_millis()).unwrap())
            .fetch_all(&mut connection)
            .await?;
            sqlx::query(AssertSqlSafe(format!(
                "DROP SCHEMA IF EXISTS \"{name}\" CASCADE"
            )))
            .execute(&mut connection)
            .await?;
            Ok::<_, sqlx::Error>(())
        }
        .await;
        if let Err(error) = &removal {
            eprintln!("schema {name} is left behind: {error}");
        }
        if let Err(panicked) = outcome {
            std::panic::resume_unwind(panicked.into_panic());
        }
        removal.unwrap();
        connection.close().await.unwrap();
    }

    /// A live document in two groups with three versions, two of them saved in the same
    /// millisecond; a deleted document with one version, which no reader serves; and a second
    /// live document in both groups in the other order, without versions, so a reread that
    /// checks only the first live document fails a test.
    fn converted() -> Converted {
        let document = |id: &str, group_ids: &[&str], deleted_at: Option<i64>| DocumentRow {
            _id: id.to_string(),
            title: "Satzung".to_string(),
            content: "# Satzung\n\nText".to_string(),
            state: vec![1, 2, 3],
            state_version: 4,
            group_ids: group_ids.iter().map(|g| g.to_string()).collect(),
            created_by: "user1".to_string(),
            created_at: T0,
            updated_at: T0 + 1,
            deleted_by: deleted_at.map(|_| "user1".to_string()),
            deleted_at,
        };
        let group = |id: &str, name: &str, document_order: &[&str]| GroupRow {
            _id: id.to_string(),
            name: name.to_string(),
            name_key: sort_key(name),
            document_order: document_order.iter().map(|d| d.to_string()).collect(),
        };
        let version = |id: &str, document_id: &str, saved_at: i64| VersionRow {
            _id: id.to_string(),
            document_id: document_id.to_string(),
            content: format!("# Satzung\n\n{id}"),
            editors: vec!["Anna".to_string()],
            saved_at,
        };
        Converted {
            documents: vec![
                document("doc1", &["grp1", "grp2"], None),
                document("doc2", &[], Some(T0 + 2)),
                document("doc3", &["grp2", "grp1"], None),
            ],
            groups: vec![
                group("grp1", "Vorstand", &["doc1", "doc2"]),
                group("grp2", "Orga", &[]),
            ],
            group_order: vec![GroupOrderRow {
                _id: "main".to_string(),
                group_ids: vec!["grp2".to_string(), "grp1".to_string()],
            }],
            versions: vec![
                version("ver1", "doc1", T0 + 10),
                version("ver2", "doc1", T0 + 11),
                version("ver3", "doc1", T0 + 11),
                version("ver4", "doc2", T0 + 5),
            ],
            ..Converted::default()
        }
    }

    /// A report as `run` hands it to `verify_all`: every collection expected and read with the
    /// number of rows `c` has.
    fn report_for(c: &Converted) -> Report {
        let mut report = Report::new();
        for collection in COLLECTIONS {
            let rows = match collection {
                "documents" => c.documents.len(),
                "document_groups" => c.groups.len(),
                "document_group_order" => c.group_order.len(),
                "document_versions" => c.versions.len(),
                _ => 0,
            } as u64;
            report.collection(collection).expected = Some(rows);
            report.collection(collection).source = Some(rows);
        }
        report
    }

    async fn verified(pool: &PgPool, c: &Converted, fault: Option<Reread>) -> Report {
        let mut report = report_for(c);
        match fault {
            Some(fault) => FAULT.scope(fault, verify_all(pool, c, &mut report)).await,
            None => verify_all(pool, c, &mut report).await,
        }
        .unwrap();
        report
    }

    /// Each comparison of what a reader serves with the raw rows fails the verification on its
    /// own: every reread of each live document, each group field, the group order and each
    /// version field, the state version included. The deleted document is not reread, and the
    /// versions of every document that has any are. Last, a document out of its place in the
    /// dump (`seq`) fails the dump-order invariant.
    #[tokio::test]
    async fn a_reread_that_differs_from_the_rows_fails_verification() {
        in_a_schema_of_its_own(|options| async move {
            let pool = PgPoolOptions::new()
                .max_connections(4)
                .acquire_timeout(LOGIN_WAIT)
                .connect_with(options)
                .await
                .unwrap();
            DB::new(pool.clone()).migrate().await.unwrap();
            let c = converted();
            let mut written = report_for(&c);
            write_all(&pool, &c, &mut written).await.unwrap();

            let report = verified(&pool, &c, None).await;
            assert!(report.verified, "{}", report.render());
            assert!(report.errors.is_empty(), "{}", report.render());

            let cases = [
                (Reread::DocumentGone, "documents reread_differs", 2),
                (Reread::DocumentTitle, "documents reread_differs", 2),
                (Reread::DocumentContent, "documents reread_differs", 2),
                (Reread::DocumentGroups, "documents reread_differs", 2),
                (Reread::StateGone, "documents.state reread_differs", 2),
                (Reread::State, "documents.state reread_differs", 2),
                (Reread::StateVersion, "documents.state reread_differs", 2),
                (Reread::GroupGone, "document_groups reread_differs", 1),
                (Reread::GroupId, "document_groups reread_differs", 1),
                (Reread::GroupName, "document_groups reread_differs", 1),
                (
                    Reread::GroupDocumentOrder,
                    "document_groups reread_differs",
                    1,
                ),
                (Reread::GroupOrder, "document_group_order reread_differs", 1),
                (Reread::VersionGone, "document_versions reread_differs", 2),
                (Reread::VersionId, "document_versions reread_differs", 2),
                (
                    Reread::VersionContent,
                    "document_versions reread_differs",
                    2,
                ),
                (
                    Reread::VersionEditors,
                    "document_versions reread_differs",
                    2,
                ),
                (
                    Reread::VersionSavedAt,
                    "document_versions reread_differs",
                    2,
                ),
            ];
            for (fault, problem, times) in cases {
                let report = verified(&pool, &c, Some(fault)).await;
                assert!(!report.verified, "{fault:?}: {}", report.render());
                assert_eq!(
                    report.errors,
                    BTreeMap::from([(problem.to_string(), times)]),
                    "{fault:?}"
                );
            }

            // Every row is there, but one document is no longer in its place in the dump.
            sqlx::query("UPDATE documents SET seq = seq + 100 WHERE _id = 'doc1'")
                .execute(&pool)
                .await
                .unwrap();
            let report = verified(&pool, &c, None).await;
            assert!(!report.verified, "{}", report.render());
            assert_eq!(
                report.errors,
                BTreeMap::from([(
                    "documents in dump order target_count_mismatch".to_string(),
                    1
                )]),
                "{}",
                report.render()
            );
            pool.close().await;
        })
        .await;
    }
}
