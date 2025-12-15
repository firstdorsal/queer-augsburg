use axum::{
    extract::{Query, State},
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};

use crate::{
    extractors::AuthExtractor,
    state::AppState,
    types::{GetMeetingsQuery, GetMeetingsResponseBody, MeetingTypeQuery, UserCapabilities},
};

/// Maximum allowed limit for pagination
const MAX_LIMIT: i64 = 1000;
/// Maximum reasonable timestamp (year 3000)
const MAX_TIMESTAMP: i64 = 32503680000000;
/// Maximum reasonable index (no point going beyond total possible meetings)
const MAX_INDEX: i64 = 1_000_000;

#[utoipa::path(
    get,
    path = "/api/get_meetings/",
    params(
        ("t" = String, Query, description = "Meeting type: 'Active' or 'Planned'"),
        ("l" = Option<i64>, Query, description = "Limit number of results (max 1000)"),
        ("i" = Option<i64>, Query, description = "From index (pagination offset)"),
        ("since" = Option<i64>, Query, description = "Only return meetings updated/deleted since this timestamp (ms). Used for delta sync.")
    ),
    responses(
        (status = 200, description = "List of meetings", body = GetMeetingsResponseBody),
        (status = 400, description = "Invalid query parameter")
    ),
    tag = "meetings"
)]
pub async fn get_meetings(
    State(state): State<AppState>,
    AuthExtractor(auth): AuthExtractor,
    Query(query): Query<GetMeetingsQuery>,
) -> Response {
    // Validate and sanitize input parameters
    let limit = match query.l {
        Some(l) if l < 0 => {
            return (StatusCode::BAD_REQUEST, "Limit cannot be negative").into_response();
        }
        Some(l) if l > MAX_LIMIT => Some(MAX_LIMIT),
        other => other,
    };

    let from_index = match query.i {
        Some(i) if i < 0 => {
            return (StatusCode::BAD_REQUEST, "Index cannot be negative").into_response();
        }
        Some(i) if i > MAX_INDEX => {
            return (StatusCode::BAD_REQUEST, "Index too large").into_response();
        }
        Some(i) => i,
        None => 0,
    };

    // Validate since parameter (delta sync available to all users)
    let since = match query.since {
        Some(s) if s < 0 => {
            return (StatusCode::BAD_REQUEST, "Timestamp cannot be negative").into_response();
        }
        Some(s) if s > MAX_TIMESTAMP => {
            return (StatusCode::BAD_REQUEST, "Timestamp too far in future").into_response();
        }
        Some(s) => Some(s),
        None => None,
    };

    let meeting_type: MeetingTypeQuery = match query.t.as_str() {
        "Planned" => MeetingTypeQuery::Planned,
        "Active" => MeetingTypeQuery::Active,
        _ => {
            return (
                StatusCode::BAD_REQUEST,
                "Invalid meeting type. Use 'Active' or 'Planned'",
            )
                .into_response()
        }
    };

    // Planned meetings require UpdateMeetings capability
    if meeting_type == MeetingTypeQuery::Planned {
        let has_capability = match &auth.authenticated_user {
            Some(user_id) => match state.db.get_user(user_id).await {
                Ok(Some(user)) => user
                    .capabilities
                    .map(|caps| caps.contains(&UserCapabilities::UpdateMeetings))
                    .unwrap_or(false),
                _ => false,
            },
            None => false,
        };

        if !has_capability {
            return (
                StatusCode::FORBIDDEN,
                "Planned meetings require UpdateMeetings capability",
            )
                .into_response();
        }
    }

    // When using delta sync (since parameter), include deleted meetings
    let include_deleted = since.is_some();

    let (meetings, selected_total_count) = match state
        .db
        .get_meetings(meeting_type, since, include_deleted)
        .await
    {
        Ok(result) => result,
        Err(e) => {
            return (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()).into_response();
        }
    };

    // Calculate the last_updated timestamp from all meetings (before pagination)
    // Include deleted_at timestamps in the calculation
    let last_updated = meetings
        .iter()
        .flat_map(|m| {
            let changed_times = m
                .changed
                .as_ref()
                .map(|changes| changes.iter().map(|c| c.at).collect::<Vec<_>>())
                .unwrap_or_default();
            let deleted_time = m.deleted_at.into_iter().collect::<Vec<_>>();
            changed_times.into_iter().chain(deleted_time)
        })
        .max();

    // For delta sync, don't apply sorting/pagination - return all changed meetings
    let mut meetings = if since.is_some() {
        meetings
    } else {
        // Normal request: apply sorting and pagination
        match meeting_type {
            MeetingTypeQuery::Active => {
                let current_time_ms = chrono::Utc::now().timestamp_millis();

                // 6h - don't mark meetings as old if they are less than 6h old
                let time_before_old_ms: i64 = 6 * 60 * 60 * 1000;
                let time_barrier = current_time_ms - time_before_old_ms;

                // Sort the meetings
                // first come the future meetings from earliest to latest
                // then come the past meetings from latest to earliest
                let future_meetings = meetings
                    .iter()
                    .filter(|m| {
                        if let Some(t) = m.time {
                            t > time_barrier
                        } else {
                            false
                        }
                    })
                    .rev()
                    .cloned()
                    .collect::<Vec<_>>();

                let past_meetings = meetings
                    .iter()
                    .filter(|m| {
                        if let Some(t) = m.time {
                            t <= time_barrier
                        } else {
                            false
                        }
                    })
                    .cloned()
                    .collect::<Vec<_>>();

                let mut meetings = future_meetings;
                meetings.extend(past_meetings);

                if let Some(limit) = limit {
                    meetings
                        .into_iter()
                        .skip(from_index as usize)
                        .take(limit as usize)
                        .collect::<Vec<_>>()
                } else {
                    meetings
                }
            }
            MeetingTypeQuery::Planned => {
                if let Some(limit) = limit {
                    meetings
                        .into_iter()
                        .skip(from_index as usize)
                        .take(limit as usize)
                        .collect::<Vec<_>>()
                } else {
                    meetings
                }
            }
        }
    };

    // Remove changed field from meetings (internal data)
    for meeting in &mut meetings {
        meeting.changed = None;
    }

    let meetings_response = GetMeetingsResponseBody {
        meetings,
        selected_total_count,
        last_updated,
    };

    Json(meetings_response).into_response()
}
