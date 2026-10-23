use axum::{
    extract::State,
    http::{header, StatusCode},
    response::{IntoResponse, Response},
};
use chrono::DateTime;
use chrono_tz::Europe::Berlin;
use icalendar::{Calendar, Component, Event, EventLike, EventStatus, Property};
use url::Url;

use crate::{
    config::SERVER_CONFIG,
    extractors::AuthExtractor,
    place_rules::PLACE_TO_BE_ANNOUNCED,
    state::AppState,
    types::{Meeting, Venue},
};

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
        .timezone(Berlin.name())
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
        if let Some(event) = ical_event(&meeting.without_private_link(), &SERVER_CONFIG.ui_origin) {
            calender.push(event);
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

/// The event of a meeting with a start time (others are not in the feed).
fn ical_event(meeting: &Meeting, ui_origin: &Url) -> Option<Event> {
    let time_start = DateTime::from_timestamp_millis(meeting.time?)?;
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
        .append_property(Property::new("URL", meeting.page_url(ui_origin).as_str()))
        .append_property(Property::new("REFRESH-INTERVAL", "PT1H"))
        .append_property(Property::new("X-PUBLISHED-TTL", "PT1H"))
        .summary(&ical_line(&meeting.title))
        .description(&ical_multiline(&meeting.description))
        .starts(time_start)
        .ends(time_end);
    // Lets calendar apps see that a meeting changed, e.g. when its place is announced.
    if let Some(changes) = meeting
        .changed
        .as_ref()
        .filter(|changes| !changes.is_empty())
    {
        // The first entry is the creation.
        event.append_property(Property::new("SEQUENCE", (changes.len() - 1).to_string()));
        if let Some(changed_at) = changes
            .iter()
            .map(|change| change.at)
            .max()
            .and_then(DateTime::from_timestamp_millis)
        {
            event.append_property(Property::new(
                "LAST-MODIFIED",
                changed_at.format("%Y%m%dT%H%M%SZ").to_string(),
            ));
        }
    }
    let location_text = ical_line(&ical_location(meeting));
    if !location_text.is_empty() {
        event.location(&location_text);
    }
    if let Venue::Place(location) = meeting.venue() {
        event.append_property(Property::new(
            "GEO",
            format!("{};{}", location.lat, location.lon),
        ));
    }
    Some(event.done())
}

/// LOCATION text: "Name: lat,lon" for places, "Online (Platform)" for online meetings plus
/// ": link" for public links (members-only links are removed before), "Ort wird noch
/// bekanntgegeben" for places to be announced. Same format as `meetingVenueText` in
/// web/src/places.ts. Empty for legacy meetings without a venue.
fn ical_location(meeting: &Meeting) -> String {
    match meeting.venue() {
        Venue::ToBeAnnounced => PLACE_TO_BE_ANNOUNCED.to_string(),
        Venue::Online(online) => {
            let label = if online.platform.is_empty() {
                "Online".to_string()
            } else {
                format!("Online ({})", online.platform)
            };
            match &online.url {
                Some(url) => format!("{label}: {url}"),
                None => label,
            }
        }
        Venue::Place(location) => format!("{}: {},{}", location.name, location.lat, location.lon),
        Venue::Unknown => String::new(),
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
    use crate::types::{
        stored_test_meeting as meeting, ChangedMeeting, MeetingLocation, OnlineMeeting,
    };

    fn neruda() -> MeetingLocation {
        MeetingLocation {
            name: "Café Neruda".to_string(),
            lat: 48.37,
            lon: 10.89,
        }
    }

    fn event_text(meeting: &Meeting) -> String {
        let mut calendar = Calendar::new();
        calendar
            .push(ical_event(meeting, &Url::parse("https://queer-augsburg.de").unwrap()).unwrap());
        calendar.done().to_string()
    }

    #[test]
    fn location_text_for_places_and_online_meetings() {
        let mut at_place = meeting();
        at_place.location = Some(neruda());
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

        let mut to_be_announced = meeting();
        to_be_announced.place_to_be_announced = true;
        assert_eq!(
            ical_location(&to_be_announced),
            "Ort wird noch bekanntgegeben"
        );
    }

    #[test]
    fn events_of_places_to_be_announced_have_no_coordinates() {
        let mut at_place = meeting();
        at_place.location = Some(neruda());
        let text = event_text(&at_place);
        assert!(
            text.contains("LOCATION:Café Neruda: 48.37\\,10.89"),
            "{text}"
        );
        assert!(text.contains("GEO:48.37;10.89"), "{text}");
        assert!(
            text.contains("URL:https://queer-augsburg.de/?m=abcde"),
            "{text}"
        );

        // A location left over from before cannot be shown.
        let mut to_be_announced = at_place;
        to_be_announced.place_to_be_announced = true;
        let text = event_text(&to_be_announced);
        assert!(
            text.contains("LOCATION:Ort wird noch bekanntgegeben"),
            "{text}"
        );
        assert!(!text.contains("GEO"), "{text}");
    }

    #[test]
    fn events_tell_when_they_changed() {
        assert!(!event_text(&meeting()).contains("SEQUENCE"));

        let mut changed = meeting();
        changed.changed = Some(vec![
            ChangedMeeting {
                by: "a".to_string(),
                at: 1_792_706_400_000,
            },
            ChangedMeeting {
                by: "b".to_string(),
                at: 1_792_879_200_000,
            },
        ]);
        let text = event_text(&changed);
        assert!(text.contains("SEQUENCE:1"), "{text}");
        assert!(text.contains("LAST-MODIFIED:20261024T220000Z"), "{text}");
    }

    #[test]
    fn meetings_without_a_start_are_not_in_the_feed() {
        let mut untimed = meeting();
        untimed.time = None;
        assert!(ical_event(&untimed, &Url::parse("https://queer-augsburg.de").unwrap()).is_none());
    }

    #[test]
    fn ical_text_cannot_break_out_of_its_line() {
        assert_eq!(ical_line("A\r\nATTACH:x"), "A  ATTACH:x");
        assert_eq!(ical_multiline("a\r\nb\rc\u{7}"), "a\nbc");
        assert_eq!(ical_parameter("Paul\"\r\nATTACH:x"), "Paul'  ATTACH:x");
    }
}
