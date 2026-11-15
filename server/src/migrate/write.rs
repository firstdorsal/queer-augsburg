//! Writing the converted rows: one transaction, every row an upsert keyed by the v1 id,
//! child rows replaced under their parent, so a second run on the same dump changes
//! nothing and a changed document is re-applied (research-postgres §4.4 item 3). The
//! `migration_hashes` table remembers the canonical hash of every row written, which is
//! how the report tells inserted, updated and unchanged rows apart.
//!
//! `users`, `meetings` and `documents` get their `seq` from the position in the dump, which
//! mongodump writes in natural order: the order MongoDB returned ties in (see the schema).
//! The run writes only when no document was left out (`convert`), so the position in the
//! converted list is the position in the dump.

use super::canon;
use super::report::{Report, EMPTY_DIGEST};
use super::source::Converted;
use super::{describe_sqlx, Failure};
use crate::types::{
    CommonMeetingTag, MeetingStatus, MemberType, MembershipStatus, QueerMeetingTag,
    UserCapabilities,
};
use sqlx::postgres::PgPool;
use sqlx::types::Json;
use sqlx::{PgConnection, Postgres, Transaction};
use std::collections::HashMap;

/// Keeps the hash of every row the migrator wrote, per collection and v1 id. Dropped with
/// the migrator after the rollback window (task 11).
const HASHES_TABLE: &str = r#"
    CREATE TABLE IF NOT EXISTS migration_hashes (
        collection text NOT NULL,
        _id        text COLLATE "C" NOT NULL,
        hash       text NOT NULL,
        PRIMARY KEY (collection, _id)
    )
"#;

/// The tables whose `seq` holds the natural order of their collection.
pub const SEQ_TABLES: [&str; 3] = ["users", "meetings", "documents"];

fn failure(step: &'static str) -> impl FnOnce(sqlx::Error) -> Failure {
    move |e| Failure::Database {
        step,
        detail: describe_sqlx(&e),
    }
}

/// The hashes of the rows already written, from an earlier run.
struct Known {
    hashes: HashMap<(String, String), String>,
}

impl Known {
    async fn load(tx: &mut PgConnection) -> Result<Self, Failure> {
        let rows: Vec<(String, String, String)> =
            sqlx::query_as("SELECT collection, _id, hash FROM migration_hashes")
                .fetch_all(tx)
                .await
                .map_err(failure("load hashes"))?;
        Ok(Self {
            hashes: rows
                .into_iter()
                .map(|(collection, id, hash)| ((collection, id), hash))
                .collect(),
        })
    }

    /// Counts the row in the report and records its hash.
    async fn record(
        &self,
        tx: &mut PgConnection,
        report: &mut Report,
        collection: &'static str,
        id: &str,
        hash: &[u8; 32],
    ) -> Result<(), Failure> {
        let hex = super::report::hex(hash);
        let counts = report.collection(collection);
        match self.hashes.get(&(collection.to_string(), id.to_string())) {
            None => counts.inserted += 1,
            Some(known) if *known == hex => counts.unchanged += 1,
            Some(_) => counts.updated += 1,
        }
        sqlx::query(
            r#"
            INSERT INTO migration_hashes (collection, _id, hash) VALUES ($1, $2, $3)
            ON CONFLICT (collection, _id) DO UPDATE SET hash = EXCLUDED.hash
            "#,
        )
        .bind(collection)
        .bind(id)
        .bind(&hex)
        .execute(tx)
        .await
        .map_err(failure("record hash"))?;
        Ok(())
    }
}

/// Writes everything in one transaction. The schema must already be applied.
pub async fn write_all(pool: &PgPool, c: &Converted, report: &mut Report) -> Result<(), Failure> {
    sqlx::query(HASHES_TABLE)
        .execute(pool)
        .await
        .map_err(failure("create hashes table"))?;
    let mut tx: Transaction<'_, Postgres> = pool.begin().await.map_err(failure("begin"))?;
    let known = Known::load(&mut tx).await?;

    for (row, seq) in c.users.iter().zip(1_i64..) {
        let u = &row.user;
        sqlx::query(
            r#"
            INSERT INTO users (_id, seq, capabilities, extra) VALUES ($1, $2, $3, $4)
            ON CONFLICT (_id) DO UPDATE SET
                seq = EXCLUDED.seq, capabilities = EXCLUDED.capabilities, extra = EXCLUDED.extra
            "#,
        )
        .bind(&u.id)
        .bind(seq)
        .bind(u.capabilities.as_deref().unwrap_or(&[]) as &[UserCapabilities])
        .bind(row.extra.as_ref().map(Json))
        .execute(&mut *tx)
        .await
        .map_err(failure("users"))?;
        match &u.member {
            Some(m) => {
                sqlx::query(
                    r#"
                    INSERT INTO members (
                        user_id, member_type, natural_person, name_passport, name_first,
                        name_last, institution, pronouns, address_street, address_number,
                        address_addition, address_zip, address_city, address_country, email,
                        phone, start_time_ms, end_time_ms, status, user_notes, admin_notes,
                        reference, approved_charter, approved_privacy, above_18, honorary
                    ) VALUES (
                        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16,
                        $17, $18, $19, $20, $21, $22, $23, $24, $25, $26
                    )
                    ON CONFLICT (user_id) DO UPDATE SET
                        member_type = EXCLUDED.member_type,
                        natural_person = EXCLUDED.natural_person,
                        name_passport = EXCLUDED.name_passport, name_first = EXCLUDED.name_first,
                        name_last = EXCLUDED.name_last, institution = EXCLUDED.institution,
                        pronouns = EXCLUDED.pronouns, address_street = EXCLUDED.address_street,
                        address_number = EXCLUDED.address_number,
                        address_addition = EXCLUDED.address_addition,
                        address_zip = EXCLUDED.address_zip, address_city = EXCLUDED.address_city,
                        address_country = EXCLUDED.address_country, email = EXCLUDED.email,
                        phone = EXCLUDED.phone, start_time_ms = EXCLUDED.start_time_ms,
                        end_time_ms = EXCLUDED.end_time_ms, status = EXCLUDED.status,
                        user_notes = EXCLUDED.user_notes, admin_notes = EXCLUDED.admin_notes,
                        reference = EXCLUDED.reference,
                        approved_charter = EXCLUDED.approved_charter,
                        approved_privacy = EXCLUDED.approved_privacy,
                        above_18 = EXCLUDED.above_18, honorary = EXCLUDED.honorary
                    "#,
                )
                .bind(&u.id)
                .bind(m._type as MemberType)
                .bind(m.natural_person)
                .bind(m.name.as_ref().map(|n| n.passport.as_str()))
                .bind(m.name.as_ref().map(|n| n.first_name.as_str()))
                .bind(m.name.as_ref().map(|n| n.last_name.as_str()))
                .bind(&m.institution)
                .bind(&m.pronouns)
                .bind(&m.address.street)
                .bind(&m.address.number)
                .bind(&m.address.addition)
                .bind(&m.address.zip)
                .bind(&m.address.city)
                .bind(&m.address.country)
                .bind(&m.email)
                .bind(&m.phone)
                .bind(m.start_time_ms)
                .bind(m.end_time_ms)
                .bind(m.status.clone() as Option<MembershipStatus>)
                .bind(&m.user_notes)
                .bind(&m.admin_notes)
                .bind(&m.reference)
                .bind(m.approved_charter)
                .bind(m.approved_privacy)
                .bind(m.above_18)
                .bind(m.honorary)
                .execute(&mut *tx)
                .await
                .map_err(failure("members"))?;
            }
            None => {
                sqlx::query("DELETE FROM members WHERE user_id = $1")
                    .bind(&u.id)
                    .execute(&mut *tx)
                    .await
                    .map_err(failure("members"))?;
            }
        }
        known
            .record(&mut tx, report, "users", &u.id, &canon::hash_user(row))
            .await?;
    }

    for row in &c.original_users {
        sqlx::query("DELETE FROM original_users WHERE user_id = $1")
            .bind(&row.user_id)
            .execute(&mut *tx)
            .await
            .map_err(failure("original_users"))?;
        sqlx::query(
            "INSERT INTO original_users (user_id, snapshot, created_at) VALUES ($1, $2, $3)",
        )
        .bind(&row.user_id)
        .bind(Json(&row.snapshot))
        .bind(row.created_at)
        .execute(&mut *tx)
        .await
        .map_err(failure("original_users"))?;
        known
            .record(
                &mut tx,
                report,
                "originalUsers",
                &row.user_id,
                &canon::hash_original_user(row),
            )
            .await?;
    }

    for row in &c.places {
        sqlx::query(
            r#"
            INSERT INTO places (_id, name, name_key, lat, lon, created_by, created_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            ON CONFLICT (_id) DO UPDATE SET
                name = EXCLUDED.name, name_key = EXCLUDED.name_key, lat = EXCLUDED.lat,
                lon = EXCLUDED.lon, created_by = EXCLUDED.created_by,
                created_at = EXCLUDED.created_at
            "#,
        )
        .bind(&row._id)
        .bind(&row.name)
        .bind(&row.name_key)
        .bind(row.lat)
        .bind(row.lon)
        .bind(&row.created_by)
        .bind(row.created_at)
        .execute(&mut *tx)
        .await
        .map_err(failure("places"))?;
        known
            .record(&mut tx, report, "places", &row._id, &canon::hash_place(row))
            .await?;
    }

    for (m, seq) in c.meetings.iter().zip(1_i64..) {
        let age_restriction: Vec<i16> = m.age_restriction.iter().map(|a| i16::from(*a)).collect();
        sqlx::query(
            r#"
            INSERT INTO meetings (
                _id, title, authority, age_restriction, time,
                location_name, location_lat, location_lon, place_id,
                online_platform, online_url, online_members_only, place_to_be_announced,
                description, price, trigger_warning, attendance, rating, accessibility,
                tags_freeform, tags_common, tags_queer, status, cancelled, deleted_at, seq
            ) VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17,
                $18, $19, $20, $21, $22, $23, $24, $25, $26
            )
            ON CONFLICT (_id) DO UPDATE SET
                seq = EXCLUDED.seq,
                title = EXCLUDED.title, authority = EXCLUDED.authority,
                age_restriction = EXCLUDED.age_restriction, time = EXCLUDED.time,
                location_name = EXCLUDED.location_name, location_lat = EXCLUDED.location_lat,
                location_lon = EXCLUDED.location_lon, place_id = EXCLUDED.place_id,
                online_platform = EXCLUDED.online_platform, online_url = EXCLUDED.online_url,
                online_members_only = EXCLUDED.online_members_only,
                place_to_be_announced = EXCLUDED.place_to_be_announced,
                description = EXCLUDED.description, price = EXCLUDED.price,
                trigger_warning = EXCLUDED.trigger_warning, attendance = EXCLUDED.attendance,
                rating = EXCLUDED.rating, accessibility = EXCLUDED.accessibility,
                tags_freeform = EXCLUDED.tags_freeform, tags_common = EXCLUDED.tags_common,
                tags_queer = EXCLUDED.tags_queer, status = EXCLUDED.status,
                cancelled = EXCLUDED.cancelled, deleted_at = EXCLUDED.deleted_at
            "#,
        )
        .bind(&m._id)
        .bind(&m.title)
        .bind(&m.authority)
        .bind(&age_restriction)
        .bind(m.time)
        .bind(m.location.as_ref().map(|l| l.name.as_str()))
        .bind(m.location.as_ref().map(|l| l.lat))
        .bind(m.location.as_ref().map(|l| l.lon))
        .bind(&m.place_id)
        .bind(m.online.as_ref().map(|o| o.platform.as_str()))
        .bind(m.online.as_ref().and_then(|o| o.url.as_deref()))
        .bind(m.online.as_ref().map(|o| o.members_only))
        .bind(m.place_to_be_announced)
        .bind(&m.description)
        .bind(&m.price)
        .bind(&m.trigger_warning)
        .bind(m.attendance.map(i32::from))
        .bind(m.rating)
        .bind(&m.accessibility)
        .bind(&m.tags.freeform)
        .bind(&m.tags.common as &[CommonMeetingTag])
        .bind(&m.tags.queer as &[QueerMeetingTag])
        .bind(m.status as MeetingStatus)
        .bind(m.cancelled)
        .bind(m.deleted_at)
        .bind(seq)
        .execute(&mut *tx)
        .await
        .map_err(failure("meetings"))?;
        sqlx::query("DELETE FROM meeting_changes WHERE meeting_id = $1")
            .bind(&m._id)
            .execute(&mut *tx)
            .await
            .map_err(failure("meeting_changes"))?;
        for (position, change) in m.changed.iter().flatten().enumerate() {
            sqlx::query(
                "INSERT INTO meeting_changes (meeting_id, position, at, by) VALUES ($1, $2, $3, $4)",
            )
            .bind(&m._id)
            .bind(position as i32)
            .bind(change.at)
            .bind(&change.by)
            .execute(&mut *tx)
            .await
            .map_err(failure("meeting_changes"))?;
        }
        known
            .record(&mut tx, report, "meetings", &m._id, &canon::hash_meeting(m))
            .await?;
    }

    for l in &c.sent_email_logs {
        sqlx::query(
            r#"
            INSERT INTO sent_email_logs (
                _id, sender_id, sender_email, subject, body, attachment_names, sent_at,
                successful_count, failed_count, failed_emails, reply_to
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
            ON CONFLICT (_id) DO UPDATE SET
                sender_id = EXCLUDED.sender_id, sender_email = EXCLUDED.sender_email,
                subject = EXCLUDED.subject, body = EXCLUDED.body,
                attachment_names = EXCLUDED.attachment_names, sent_at = EXCLUDED.sent_at,
                successful_count = EXCLUDED.successful_count,
                failed_count = EXCLUDED.failed_count, failed_emails = EXCLUDED.failed_emails,
                reply_to = EXCLUDED.reply_to
            "#,
        )
        .bind(&l._id)
        .bind(&l.sender_id)
        .bind(&l.sender_email)
        .bind(&l.subject)
        .bind(&l.body)
        .bind(&l.attachment_names)
        .bind(l.sent_at)
        // `convert::count_u32` keeps both within `i32`.
        .bind(i32::try_from(l.successful_count).unwrap_or(i32::MAX))
        .bind(i32::try_from(l.failed_count).unwrap_or(i32::MAX))
        .bind(&l.failed_emails)
        .bind(&l.reply_to)
        .execute(&mut *tx)
        .await
        .map_err(failure("sent_email_logs"))?;
        known
            .record(
                &mut tx,
                report,
                "sent_email_logs",
                &l._id,
                &canon::hash_sent_email_log(l),
            )
            .await?;
    }

    // Groups before documents: the memberships reference them.
    for g in &c.groups {
        sqlx::query(
            r#"
            INSERT INTO document_groups (_id, name, name_key, document_order)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (_id) DO UPDATE SET
                name = EXCLUDED.name, name_key = EXCLUDED.name_key,
                document_order = EXCLUDED.document_order
            "#,
        )
        .bind(&g._id)
        .bind(&g.name)
        .bind(&g.name_key)
        .bind(&g.document_order)
        .execute(&mut *tx)
        .await
        .map_err(failure("document_groups"))?;
        known
            .record(
                &mut tx,
                report,
                "document_groups",
                &g._id,
                &canon::hash_group(g),
            )
            .await?;
    }

    for (d, seq) in c.documents.iter().zip(1_i64..) {
        sqlx::query(
            r#"
            INSERT INTO documents (
                _id, title, content, state, state_version, created_by, created_at,
                updated_at, deleted_by, deleted_at, seq
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
            ON CONFLICT (_id) DO UPDATE SET
                seq = EXCLUDED.seq,
                title = EXCLUDED.title, content = EXCLUDED.content, state = EXCLUDED.state,
                state_version = EXCLUDED.state_version, created_by = EXCLUDED.created_by,
                created_at = EXCLUDED.created_at, updated_at = EXCLUDED.updated_at,
                deleted_by = EXCLUDED.deleted_by, deleted_at = EXCLUDED.deleted_at
            "#,
        )
        .bind(&d._id)
        .bind(&d.title)
        .bind(&d.content)
        .bind(&d.state)
        .bind(d.state_version)
        .bind(&d.created_by)
        .bind(d.created_at)
        .bind(d.updated_at)
        .bind(&d.deleted_by)
        .bind(d.deleted_at)
        .bind(seq)
        .execute(&mut *tx)
        .await
        .map_err(failure("documents"))?;
        sqlx::query("DELETE FROM document_group_members WHERE document_id = $1")
            .bind(&d._id)
            .execute(&mut *tx)
            .await
            .map_err(failure("document_group_members"))?;
        for (position, group_id) in d.group_ids.iter().enumerate() {
            sqlx::query(
                r#"
                INSERT INTO document_group_members (document_id, group_id, position)
                VALUES ($1, $2, $3)
                "#,
            )
            .bind(&d._id)
            .bind(group_id)
            .bind(position as i32)
            .execute(&mut *tx)
            .await
            .map_err(failure("document_group_members"))?;
        }
        known
            .record(
                &mut tx,
                report,
                "documents",
                &d._id,
                &canon::hash_document(d),
            )
            .await?;
    }

    for o in &c.group_order {
        sqlx::query(
            r#"
            INSERT INTO document_group_order (_id, group_ids) VALUES ($1, $2)
            ON CONFLICT (_id) DO UPDATE SET group_ids = EXCLUDED.group_ids
            "#,
        )
        .bind(&o._id)
        .bind(&o.group_ids)
        .execute(&mut *tx)
        .await
        .map_err(failure("document_group_order"))?;
        known
            .record(
                &mut tx,
                report,
                "document_group_order",
                &o._id,
                &canon::hash_group_order(o),
            )
            .await?;
    }

    for v in &c.versions {
        sqlx::query(
            r#"
            INSERT INTO document_versions (_id, document_id, content, editors, saved_at)
            VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT (_id) DO UPDATE SET
                document_id = EXCLUDED.document_id, content = EXCLUDED.content,
                editors = EXCLUDED.editors, saved_at = EXCLUDED.saved_at
            "#,
        )
        .bind(&v._id)
        .bind(&v.document_id)
        .bind(&v.content)
        .bind(&v.editors)
        .bind(v.saved_at)
        .execute(&mut *tx)
        .await
        .map_err(failure("document_versions"))?;
        known
            .record(
                &mut tx,
                report,
                "document_versions",
                &v._id,
                &canon::hash_version(v),
            )
            .await?;
    }

    // Rows the server creates from now on come after every migrated one.
    for table in SEQ_TABLES {
        let sql = format!(
            "SELECT setval(pg_get_serial_sequence('{table}', 'seq'), \
             COALESCE((SELECT max(seq) FROM {table}), 1), \
             (SELECT max(seq) FROM {table}) IS NOT NULL)"
        );
        sqlx::query(sqlx::AssertSqlSafe(sql))
            .execute(&mut *tx)
            .await
            .map_err(failure("seq"))?;
    }

    tx.commit().await.map_err(failure("commit"))?;
    debug_assert!(EMPTY_DIGEST.len() == 64);
    Ok(())
}
