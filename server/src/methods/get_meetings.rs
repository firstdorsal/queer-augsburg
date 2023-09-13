use crate::{
    db::DB,
    interossea::Auth,
    types::{GetMeetingsResponseBody, MeetingTypeQuery},
    utils::{get_query_item, get_query_item_number},
};
use hyper::{Body, Request, Response};

pub async fn get_meetings(
    mut req: Request<Body>,
    db: DB,
    auth: &Auth,
    res: hyper::http::response::Builder,
) -> anyhow::Result<Response<Body>> {
    let limit = get_query_item_number(&req, "l");
    let from_index = get_query_item_number(&req, "i").unwrap_or(0);
    let meeting_type: MeetingTypeQuery = match get_query_item(&req, "t") {
        Some(s) => match s.as_str() {
            "Future" => MeetingTypeQuery::Future,
            "Past" => MeetingTypeQuery::Past,
            "Planned" => MeetingTypeQuery::Planned,
            "All" => MeetingTypeQuery::All,
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

    let (meetings, selected_total_count) = db
        .get_meetings(limit, from_index as u64, meeting_type)
        .await?;

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
