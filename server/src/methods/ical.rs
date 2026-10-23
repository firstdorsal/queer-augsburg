use axum::{
    extract::State,
    http::{header, StatusCode},
    response::{IntoResponse, Response},
};
use chrono::DateTime;
use icalendar::{Calendar, Component, Event, EventLike, EventStatus, Property};

use crate::{extractors::AuthExtractor, state::AppState, types::Meeting};

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
        .get_meetings(crate::types::MeetingTypeQuery::Active, None, false, None)
        .await
    {
        Ok((meetings, _)) => meetings,
        Err(e) => {
            return (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()).into_response();
        }
    };

    for meeting in meetings {
        // The feed is public: members-only links must not appear in it.
        let meeting = meeting.without_private_link();
        if let Some(meeting_time) = meeting.time {
            let time_start = DateTime::from_timestamp(meeting_time / 1000, 0).unwrap();
            let time_end = time_start + chrono::Duration::hours(1);

            let categories_string = meeting
                .tags
                .common
                .iter()
                .map(|s| s.to_string())
                .collect::<Vec<String>>()
                .join(",");

            let mut event = Event::new();
            event
                .uid(&format!("{}@queer-augsburg.de", meeting._id))
                .status(match meeting.cancelled {
                    Some(true) => EventStatus::Cancelled,
                    _ => EventStatus::Confirmed,
                })
                .append_property(
                    Property::new("ORGANIZER", "mailto:mail@queer-augsburg.de")
                        .add_parameter("CN", &ical_parameter(&meeting.authority)),
                )
                .append_property(Property::new("CATEGORIES", categories_string))
                .append_property(Property::new(
                    "URL",
                    format!("https://queer-augsburg.de/?m={}", meeting._id),
                ))
                .append_property(Property::new("REFRESH-INTERVAL", "PT1H"))
                .append_property(Property::new("X-PUBLISHED-TTL", "PT1H"))
                .summary(&ical_line(&meeting.title))
                .description(&ical_multiline(&meeting.description))
                .starts(time_start)
                .ends(time_end);
            let location_text = ical_line(&ical_location(&meeting));
            if !location_text.is_empty() {
                event.location(&location_text);
            }
            if let Some(location) = &meeting.location {
                event.append_property(Property::new(
                    "GEO",
                    format!("{};{}", location.lat, location.lon),
                ));
            }
            calender.push(event.done());
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

/// LOCATION text: "Name: lat,lon" for places, "Online (Platform)" for online meetings plus
/// ": link" for public links (members-only links are removed before). Same format as
/// `meetingVenueText` in web/src/places.ts. Empty for legacy meetings without either.
fn ical_location(meeting: &Meeting) -> String {
    if let Some(online) = &meeting.online {
        let label = if online.platform.is_empty() {
            "Online".to_string()
        } else {
            format!("Online ({})", online.platform)
        };
        return match &online.url {
            Some(url) => format!("{label}: {url}"),
            None => label,
        };
    }
    match &meeting.location {
        Some(location) => format!("{}: {},{}", location.name, location.lat, location.lon),
        None => String::new(),
    }
}

// icalendar escapes `\n` in text values but neither bare `\r` nor parameter values,
// so stored text could otherwise inject extra lines/properties into the public feed.

/// Single-line text value: control characters become spaces.
fn ical_line(value: &str) -> String {
    value
        .chars()
        .map(|c| if c.is_control() { ' ' } else { c })
        .collect()
}

/// Multi-line text value: keeps `\n` (escaped by icalendar), drops other control characters.
fn ical_multiline(value: &str) -> String {
    value
        .replace("\r\n", "\n")
        .chars()
        .filter(|c| *c == '\n' || !c.is_control())
        .collect()
}

/// Parameter value (RFC 5545 3.1: no control characters and no DQUOTE).
fn ical_parameter(value: &str) -> String {
    ical_line(value).replace('"', "'")
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::types::{MeetingLocation, OnlineMeeting};

    fn meeting() -> Meeting {
        serde_json::from_value(serde_json::json!({
            "_id": "abcde", "title": "A", "authority": "", "age_restriction": [0],
            "time": 1_793_124_000_000_i64, "location": null,
            "description": "", "price": [0.0], "trigger_warning": null, "attendance": null,
            "rating": null, "accessibility": null,
            "tags": {"freeform": [], "common": [], "queer": []}, "status": "Active",
            "changed": null, "cancelled": false, "deleted_at": null
        }))
        .unwrap()
    }

    #[test]
    fn location_text_for_places_and_online_meetings() {
        let mut at_place = meeting();
        at_place.location = Some(MeetingLocation {
            name: "Café Neruda".to_string(),
            lat: 48.37,
            lon: 10.89,
        });
        assert_eq!(ical_location(&at_place), "Café Neruda: 48.37,10.89");

        let mut online = meeting();
        online.online = Some(OnlineMeeting {
            platform: "Zoom".to_string(),
            url: Some("https://zoom.us/j/1".to_string()),
            members_only: true,
            url_hidden: false,
        });
        // What the feed does: the members-only link is removed first.
        assert_eq!(
            ical_location(&online.clone().without_private_link()),
            "Online (Zoom)"
        );

        let mut public = online;
        if let Some(details) = &mut public.online {
            details.members_only = false;
            details.platform = String::new();
        }
        assert_eq!(
            ical_location(&public.without_private_link()),
            "Online: https://zoom.us/j/1"
        );
    }

    #[test]
    fn ical_text_cannot_break_out_of_its_line() {
        assert_eq!(ical_line("A\r\nATTACH:x"), "A  ATTACH:x");
        assert_eq!(ical_multiline("a\r\nb\rc\u{7}"), "a\nbc");
        assert_eq!(ical_parameter("Paul\"\r\nATTACH:x"), "Paul'  ATTACH:x");
    }
}
