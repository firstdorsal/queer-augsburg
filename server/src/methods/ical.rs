use axum::{
    extract::State,
    http::{header, StatusCode},
    response::{IntoResponse, Response},
};
use chrono::DateTime;
use icalendar::{Calendar, Component, Event, EventLike, EventStatus, Property};

use crate::{extractors::AuthExtractor, state::AppState};

#[utoipa::path(
    get,
    path = "/api/ical_feed/",
    responses(
        (status = 200, description = "iCalendar feed", content_type = "text/calendar")
    ),
    tag = "meetings"
)]
pub async fn ical_feed(
    State(state): State<AppState>,
    AuthExtractor(_auth): AuthExtractor,
) -> Response {
    let mut calender = Calendar::new();

    calender
        .name("Queer Augsburg")
        .timezone("Europe/Berlin")
        .description(
            "Kalender mit allen Veranstaltungen von Queer Augsburg e.V. (https://queer-augsburg.de)",
        );

    let meetings = match state
        .db
        .get_meetings(crate::types::MeetingTypeQuery::Active)
        .await
    {
        Ok((meetings, _)) => meetings,
        Err(e) => {
            return (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()).into_response();
        }
    };

    for meeting in meetings {
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
                    .status(match meeting.cancelled {
                        Some(true) => EventStatus::Cancelled,
                        _ => EventStatus::Confirmed,
                    })
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
                    .append_property(Property::new("REFRESH-INTERVAL", "PT1H"))
                    .append_property(Property::new("X-PUBLISHED-TTL", "PT1H"))
                    .summary(&meeting.title)
                    .location(&location_string)
                    .description(&meeting.description)
                    .starts(time_start)
                    .ends(time_end),
            );
        }
    }

    let calendar_string = calender.done().to_string();

    (
        StatusCode::OK,
        [
            (header::CONTENT_TYPE, "text/calendar"),
            (
                header::CONTENT_DISPOSITION,
                "attachment; filename=\"Queer Augsburg.ics\"",
            ),
        ],
        calendar_string,
    )
        .into_response()
}
