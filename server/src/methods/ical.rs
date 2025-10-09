use chrono::DateTime;
use hyper::{Body, Request, Response};

use icalendar::{Calendar, Component, Event, EventLike, Property};

use crate::{db::DB, interossea::Auth};

pub async fn ical_feed(
    _req: Request<Body>,
    db: DB,
    _auth: &Auth,
    res: hyper::http::response::Builder,
) -> anyhow::Result<Response<Body>> {
    let mut calender = Calendar::new();

    calender
        .name("Queer Augsburg")
        .timezone("Europe/Berlin")
        .description(
        "Kalender mit allen Veranstaltungen von Queer Augsburg e.V. (https://queer-augsburg.de)",
    );

    db.get_meetings(crate::types::MeetingTypeQuery::Active)
        .await?
        .0
        .into_iter()
        .for_each(|meeting| {
            if let Some(meeting_time) = meeting.time {
                let time_start = DateTime::from_timestamp(meeting_time / 1000, 0).unwrap();
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
                        .uid(&format!("{}@queer-augsburg.de", meeting._id))
                        .append_property(
                            Property::new("ORGANIZER", "mailto:mail@queer-augsburg.de")
                                .add_parameter("CN", &meeting.authority),
                        )
                        .append_property(Property::new("CATEGORIES", categories_string))
                        .append_property(Property::new(
                            "GEO",
                            format!("{};{}", meeting.location.lat, meeting.location.lon),
                        ))
                        .append_property(Property::new(
                            "URL",
                            format!("https://queer-augsburg.de/?m={}", meeting._id),
                        ))
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
        .header(
            "Content-Disposition",
            "attachment; filename=\"Queer Augsburg.ics\"",
        )
        .body(calendar_string.into())
        .unwrap())
}
