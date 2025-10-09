use chrono::DateTime;
use hyper::{Body, Request, Response};

use icalendar::{Calendar, Component, Event, EventLike};

use crate::{db::DB, interossea::Auth};

pub async fn ical_feed(
    _req: Request<Body>,
    db: DB,
    _auth: &Auth,
    res: hyper::http::response::Builder,
) -> anyhow::Result<Response<Body>> {
    let mut calender = Calendar::new();

    calender.name("Queer Augsburg");

    db.get_meetings(crate::types::MeetingTypeQuery::Active)
        .await?
        .0
        .into_iter()
        .for_each(|meeting| {
            if let Some(meeting_time) = meeting.time {
                let time_start = DateTime::from_timestamp(meeting_time, 0).unwrap();
                let time_end = time_start + chrono::Duration::hours(1);
                let location_string = format!(
                    "{}: {},{}",
                    meeting.location.name, meeting.location.lat, meeting.location.lon
                );

                let categories_string = meeting
                    .tags
                    .common
                    .iter()
                    .map(|s| s.to_string())
                    .collect::<Vec<String>>()
                    .join(",");

                calender.push(
                    Event::new()
                        .add_property("ORGANIZER", meeting.authority)
                        .add_property("CATEGORIES", categories_string)
                        .summary(&meeting.title)
                        .location(&location_string)
                        .description(&meeting.description)
                        .starts(time_start)
                        .ends(time_end),
                );
            }
        });

    let calendar_string = calender.done().to_string();

    Ok(res
        .status(200)
        .header("Content-Type", "text/calendar")
        .body(calendar_string.into())
        .unwrap())
}
