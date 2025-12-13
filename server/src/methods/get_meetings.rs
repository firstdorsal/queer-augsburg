use axum::{
    extract::{Query, State},
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};

use crate::{
    extractors::AuthExtractor,
    state::AppState,
    types::{GetMeetingsQuery, GetMeetingsResponseBody, MeetingTypeQuery},
};

#[utoipa::path(
    get,
    path = "/api/get_meetings/",
    params(
        ("t" = String, Query, description = "Meeting type: 'Active' or 'Planned'"),
        ("l" = Option<i64>, Query, description = "Limit number of results"),
        ("i" = Option<i64>, Query, description = "From index (pagination offset)")
    ),
    responses(
        (status = 200, description = "List of meetings", body = GetMeetingsResponseBody),
        (status = 400, description = "Invalid query parameter")
    ),
    tag = "meetings"
)]
pub async fn get_meetings(
    State(state): State<AppState>,
    AuthExtractor(_auth): AuthExtractor,
    Query(query): Query<GetMeetingsQuery>,
) -> Response {
    let limit = query.l;
    let from_index = query.i.unwrap_or(0);

    let meeting_type: MeetingTypeQuery = match query.t.as_str() {
        "Planned" => MeetingTypeQuery::Planned,
        "Active" => MeetingTypeQuery::Active,
        _ => {
            return (
                StatusCode::BAD_REQUEST,
                format!("Invalid query parameter 't': {}", query.t),
            )
                .into_response()
        }
    };

    let (meetings, selected_total_count) = match state.db.get_meetings(meeting_type).await {
        Ok(result) => result,
        Err(e) => {
            return (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()).into_response();
        }
    };

    let mut meetings = match meeting_type {
        MeetingTypeQuery::Active => {
            let current_time_ms = chrono::Utc::now().timestamp() * 1000;

            // 6h - don't mark meetings as old if they are less than 6h old
            let time_before_old_ms = 6 * 60 * 60 * 1000;
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
    };

    // Remove changed field from meetings
    for meeting in &mut meetings {
        meeting.changed = None;
    }

    let meetings_response = GetMeetingsResponseBody {
        meetings,
        selected_total_count,
    };

    Json(meetings_response).into_response()
}
