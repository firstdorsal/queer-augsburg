use crate::{
    db::DB,
    interossea::Auth,
    types::{GetMeetingsResponseBody, MeetingTypeQuery},
    utils::{get_query_item, get_query_item_number},
};
use hyper::{Body, Request, Response};

pub async fn get_meetings(
    req: Request<Body>,
    db: DB,
    _auth: &Auth,
    res: hyper::http::response::Builder,
) -> anyhow::Result<Response<Body>> {
    let limit = get_query_item_number(&req, "l");
    let from_index = get_query_item_number(&req, "i").unwrap_or(0);
    let meeting_type: MeetingTypeQuery = match get_query_item(&req, "t") {
        Some(s) => match s.as_str() {
            "Planned" => MeetingTypeQuery::Planned,
            "Active" => MeetingTypeQuery::Active,
            _ => {
                return Ok(res
                    .status(400)
                    .body(Body::from(format!("Invalid query parameter 't': {}", s)))?)
            }
        },
        None => {
            return Ok(res
                .status(400)
                .body(Body::from("Missing query parameter 't'"))?)
        }
    };

    let (meetings, selected_total_count) = db.get_meetings(meeting_type).await?;

    let meetings = match meeting_type {
        MeetingTypeQuery::Active => {
            let current_time_ms = chrono::Utc::now().timestamp() * 1000;

            // Sort the meetings
            // first come the future meetings from earliest to latest
            // then come the past meetings from latest to earliest

            let future_meetings = meetings
                .iter()
                .filter(|m| {
                    if let Some(t) = m.time {
                        t > current_time_ms
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
                        t <= current_time_ms
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

    let meetings_response = GetMeetingsResponseBody {
        meetings,
        selected_total_count,
    };

    Ok(res
        .status(200)
        .header("Content-Type", "application/json")
        .body(serde_json::to_string(&meetings_response)?.into())
        .unwrap())
}
