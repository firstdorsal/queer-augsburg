use crate::{
    db::DB, interossea::Auth, types::GetMeetingsResponseBody, utils::get_query_item_number,
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

    let meetings = db.get_meetings(limit, from_index as u64).await?;

    let all_meetings_count = db.get_all_meetings_count().await?;

    let meetings_response = GetMeetingsResponseBody {
        meetings,
        all_meetings_count,
    };

    Ok(res
        .status(200)
        .header("Content-Type", "application/json")
        .body(serde_json::to_string(&meetings_response)?.into())
        .unwrap())
}
