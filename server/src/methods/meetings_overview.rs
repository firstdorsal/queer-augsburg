//! A small public overview of the published meetings, for AI assistants and other tools
//! (the bulk import's prompt names it): start in Berlin time, title, venue, a link to the
//! meeting. No descriptions and no links to online meetings.

use axum::{
    extract::{Query, State},
    http::{header, StatusCode},
    response::{IntoResponse, Response},
    Json,
};
use chrono::{DateTime, NaiveDate, NaiveTime};
use chrono_tz::Europe::Berlin;
use url::Url;

use crate::{
    config::SERVER_CONFIG,
    state::AppState,
    types::{Meeting, MeetingSummary, MeetingsOverview, MeetingsOverviewQuery, Venue},
};

/// More meetings than this are cut off (`truncated`); the prompt and the docs of
/// `MeetingsOverview` say 500 too.
const MAX_MEETINGS: usize = 500;
/// Meetings change rarely; a few minutes of caching spare the database.
const CACHE_MAX_AGE_SECONDS: u32 = 300;

/// Published meetings in a date range, for AI assistants (see the bulk import's prompt).
/// Public; answers are cached for 5 minutes.
#[utoipa::path(
    get,
    path = "/api/meetings_overview/",
    params(MeetingsOverviewQuery),
    responses(
        (status = 200, description = "Published (not planned) meetings starting in the range, sorted by start: the earliest 500, `truncated` if there are more", body = MeetingsOverview),
        (status = 400, description = "A date is not YYYY-MM-DD, outside 2000–2099, `to` is before `from`, or an unknown parameter (English text)", content_type = "text/plain"),
        (status = 500, description = "Database error (German text)", content_type = "text/plain")
    ),
    tag = "meetings"
)]
pub async fn meetings_overview(
    State(state): State<AppState>,
    Query(query): Query<MeetingsOverviewQuery>,
) -> Response {
    let today = chrono::Utc::now().with_timezone(&Berlin).date_naive();
    let range = match day_range(query.from.as_deref(), query.to.as_deref(), today) {
        Ok(range) => range,
        Err(e) => return error_response(StatusCode::BAD_REQUEST, e.to_string()),
    };
    // One more than shown tells whether there are more.
    let limit = MAX_MEETINGS as i64 + 1;
    match state
        .db
        .get_published_meetings_between(range.from_ms, range.until_ms, limit)
        .await
    {
        Ok(meetings) => overview_response(build_overview(meetings, &SERVER_CONFIG.ui_origin)),
        Err(e) => {
            eprintln!("meetings_overview: loading meetings failed: {e:#}");
            error_response(
                StatusCode::INTERNAL_SERVER_ERROR,
                "Datenbankfehler".to_string(),
            )
        }
    }
}

fn overview_response(overview: MeetingsOverview) -> Response {
    (
        [(
            header::CACHE_CONTROL,
            format!("public, max-age={CACHE_MAX_AGE_SECONDS}"),
        )],
        Json(overview),
    )
        .into_response()
}

fn error_response(status: StatusCode, message: String) -> Response {
    (status, [(header::CACHE_CONTROL, "no-store")], message).into_response()
}

#[derive(Debug, PartialEq, thiserror::Error)]
enum RangeError {
    #[error("'{name}' must be a date like 2026-10-27, not '{value}'")]
    NotADate { name: &'static str, value: String },
    #[error("'{name}' must be between 2000-01-01 and 2099-12-31")]
    OutOfRange { name: &'static str },
    #[error("'to' ({to}) is before 'from' ({from})")]
    ToBeforeFrom { from: NaiveDate, to: NaiveDate },
    #[error("'to' ({to}) is before today ({today}), where the range starts without 'from'")]
    ToBeforeToday { today: NaiveDate, to: NaiveDate },
    #[error("{0} has no midnight in Berlin")]
    NoMidnight(NaiveDate),
}

#[derive(Debug, PartialEq)]
struct DayRange {
    /// Start of the first day (ms).
    from_ms: i64,
    /// Start of the day after the last one (ms).
    until_ms: i64,
}

/// The days meetings can have (`meeting_validation::MIN_TIME_MS`..`MAX_TIME_MS`).
const FIRST_DAY: NaiveDate = date(2000, 1, 1);
const LAST_DAY: NaiveDate = date(2099, 12, 31);
const DAY_AFTER_LAST: NaiveDate = date(2100, 1, 1);

/// Evaluated at compile time: an invalid date fails the build.
const fn date(year: i32, month: u32, day: u32) -> NaiveDate {
    match NaiveDate::from_ymd_opt(year, month, day) {
        Some(date) => date,
        None => panic!("invalid date"),
    }
}

fn parse_day(value: &str, name: &'static str) -> Result<NaiveDate, RangeError> {
    let not_a_date = || RangeError::NotADate {
        name,
        value: value.to_string(),
    };
    let day = NaiveDate::parse_from_str(value, "%Y-%m-%d").map_err(|_| not_a_date())?;
    // chrono also accepts "2026-1-5" and signed years.
    if day.format("%Y-%m-%d").to_string() != value {
        return Err(not_a_date());
    }
    if !(FIRST_DAY..=LAST_DAY).contains(&day) {
        return Err(RangeError::OutOfRange { name });
    }
    Ok(day)
}

/// Midnight in Berlin. The clocks change at 2 and 3 o'clock, so it is never skipped or
/// repeated; the error only guards against changed time zone rules.
fn berlin_day_start_ms(day: NaiveDate) -> Result<i64, RangeError> {
    day.and_time(NaiveTime::MIN)
        .and_local_timezone(Berlin)
        .earliest()
        .map(|start| start.timestamp_millis())
        .ok_or(RangeError::NoMidnight(day))
}

/// `from` defaults to `today`, `to` to the last day meetings can have.
fn day_range(
    from: Option<&str>,
    to: Option<&str>,
    today: NaiveDate,
) -> Result<DayRange, RangeError> {
    let first = from.map(|value| parse_day(value, "from")).transpose()?;
    let last = to.map(|value| parse_day(value, "to")).transpose()?;
    match (first, last) {
        (Some(from), Some(to)) if to < from => return Err(RangeError::ToBeforeFrom { from, to }),
        (None, Some(to)) if to < today => return Err(RangeError::ToBeforeToday { today, to }),
        _ => {}
    }
    let first = first.unwrap_or(today);
    // `LAST_DAY` is the latest `last`, so there is a next day.
    let after_last = last
        .and_then(|last| last.succ_opt())
        .unwrap_or(DAY_AFTER_LAST);
    Ok(DayRange {
        from_ms: berlin_day_start_ms(first)?,
        until_ms: berlin_day_start_ms(after_last)?,
    })
}

/// `meetings` as `get_published_meetings_between` returns them: sorted, at most one more
/// than `MAX_MEETINGS`.
fn build_overview(meetings: Vec<Meeting>, ui_origin: &Url) -> MeetingsOverview {
    let truncated = meetings.len() > MAX_MEETINGS;
    MeetingsOverview {
        time_zone: Berlin.name().to_string(),
        meetings: meetings
            .into_iter()
            .take(MAX_MEETINGS)
            .filter_map(|meeting| summarize(meeting, ui_origin))
            .collect(),
        truncated,
    }
}

fn summarize(meeting: Meeting, ui_origin: &Url) -> Option<MeetingSummary> {
    // The query only returns times within 2000–2099, which are all representable.
    let Some(start) = meeting.time.and_then(DateTime::from_timestamp_millis) else {
        eprintln!(
            "meetings_overview: meeting {} has no valid start time",
            meeting._id
        );
        return None;
    };
    let (place, online, platform) = match meeting.venue() {
        Venue::Place(location) => (Some(location.name.clone()), false, None),
        Venue::Online(details) => {
            let platform = details.platform.trim();
            (
                None,
                true,
                (!platform.is_empty()).then(|| platform.to_string()),
            )
        }
        Venue::ToBeAnnounced | Venue::Unknown => (None, false, None),
    };
    Some(MeetingSummary {
        start: start
            .with_timezone(&Berlin)
            .format("%Y-%m-%dT%H:%M")
            .to_string(),
        url: meeting.page_url(ui_origin).to_string(),
        place,
        online,
        platform,
        place_to_be_announced: meeting.place_to_be_announced,
        cancelled: meeting.cancelled == Some(true),
        title: meeting.title,
        id: meeting._id,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{
        db::published_between_filter,
        types::{stored_test_meeting, MeetingLocation, OnlineMeeting},
    };
    use axum::body::to_bytes;
    use chrono::TimeZone;

    fn day(year: i32, month: u32, day: u32) -> NaiveDate {
        NaiveDate::from_ymd_opt(year, month, day).unwrap()
    }

    /// A Berlin wall-clock time as stored (ms).
    fn berlin(year: i32, month: u32, day: u32, hour: u32, minute: u32) -> i64 {
        Berlin
            .with_ymd_and_hms(year, month, day, hour, minute, 0)
            .unwrap()
            .timestamp_millis()
    }

    fn origin() -> Url {
        Url::parse("https://queer-augsburg.de").unwrap()
    }

    fn meeting(id: &str, time: i64) -> Meeting {
        let mut meeting = stored_test_meeting();
        meeting._id = id.to_string();
        meeting.title = format!("Treffen {id}");
        meeting.time = Some(time);
        meeting.description = "Beschreibung".to_string();
        meeting.place_id = Some("p1".to_string());
        meeting.location = Some(MeetingLocation {
            name: "Café Neruda".to_string(),
            lat: 48.37,
            lon: 10.89,
        });
        meeting
    }

    #[test]
    fn days_are_berlin_days() {
        let today = day(2026, 10, 23);
        assert_eq!(
            day_range(None, Some("2026-10-24"), today),
            Ok(DayRange {
                from_ms: berlin(2026, 10, 23, 0, 0),
                until_ms: berlin(2026, 10, 25, 0, 0),
            })
        );
        // Summer time: midnight in Berlin is 22:00 UTC the day before.
        assert_eq!(berlin(2026, 10, 23, 0, 0), 1_792_706_400_000);
        // End of summer time: 25 hours; start of summer time: 23 hours.
        let autumn = day_range(Some("2026-10-25"), Some("2026-10-25"), today).unwrap();
        assert_eq!(autumn.until_ms - autumn.from_ms, 25 * 3_600_000);
        let spring = day_range(Some("2027-03-28"), Some("2027-03-28"), today).unwrap();
        assert_eq!(spring.until_ms - spring.from_ms, 23 * 3_600_000);
        // Without `to`: up to the last day meetings can have.
        assert_eq!(
            day_range(Some("2026-10-27"), None, today).unwrap().until_ms,
            berlin(2100, 1, 1, 0, 0)
        );
    }

    #[test]
    fn bad_dates_are_explained() {
        let today = day(2026, 10, 23);
        let message = |from: Option<&str>, to: Option<&str>| {
            day_range(from, to, today).unwrap_err().to_string()
        };
        assert_eq!(
            message(Some("23.10.2026"), None),
            "'from' must be a date like 2026-10-27, not '23.10.2026'"
        );
        for value in [
            "",
            "2026-1-5",
            "+2026-10-27",
            "2026-02-30",
            "2026-10-27T19:00",
        ] {
            assert_eq!(
                day_range(None, Some(value), today),
                Err(RangeError::NotADate {
                    name: "to",
                    value: value.to_string()
                }),
                "{value}"
            );
        }
        for value in ["1999-12-31", "2100-01-01", "9999-12-31"] {
            assert_eq!(
                message(Some(value), None),
                "'from' must be between 2000-01-01 and 2099-12-31"
            );
        }
        assert_eq!(
            message(Some("2026-10-24"), Some("2026-10-23")),
            "'to' (2026-10-23) is before 'from' (2026-10-24)"
        );
        assert_eq!(
            message(None, Some("2026-10-20")),
            "'to' (2026-10-20) is before today (2026-10-23), where the range starts without 'from'"
        );
        // A past range is fine with `from`.
        assert!(day_range(Some("2026-10-01"), Some("2026-10-20"), today).is_ok());
    }

    #[test]
    fn only_published_meetings_in_the_range_are_loaded() {
        let filter = published_between_filter(10, 20);
        assert_eq!(filter.get_str("status"), Ok("Active"));
        assert_eq!(filter.get("deleted_at"), Some(&mongodb::bson::Bson::Null));
        let time = filter.get_document("time").unwrap();
        assert_eq!(time.get_i64("$gte"), Ok(10));
        assert_eq!(time.get_i64("$lt"), Ok(20));
    }

    #[test]
    fn overview_summarizes_without_private_details() {
        let mut online = meeting("on", berlin(2026, 10, 28, 19, 0));
        online.location = None;
        online.place_id = None;
        online.online = Some(OnlineMeeting {
            platform: " Zoom ".to_string(),
            url: Some("https://zoom.us/j/SECRET".to_string()),
            members_only: true,
            url_hidden: false,
        });
        // A location left over from before is not shown.
        let mut announced = meeting("tba", berlin(2026, 10, 27, 17, 0));
        announced.place_id = None;
        announced.place_to_be_announced = true;
        let mut cancelled = meeting("x", berlin(2026, 10, 27, 19, 0));
        cancelled.cancelled = Some(true);
        let mut legacy = meeting("old", berlin(2026, 10, 29, 0, 0));
        legacy.place_id = None;
        legacy.location = None;

        let result = build_overview(vec![announced, cancelled, online, legacy], &origin());

        assert_eq!(result.time_zone, "Europe/Berlin");
        assert!(!result.truncated);
        let summary = |id: &str, start: &str, place: Option<&str>| MeetingSummary {
            id: id.to_string(),
            start: start.to_string(),
            title: format!("Treffen {id}"),
            place: place.map(str::to_string),
            online: false,
            platform: None,
            place_to_be_announced: false,
            cancelled: false,
            url: format!("https://queer-augsburg.de/?m={id}"),
        };
        assert_eq!(
            result.meetings,
            vec![
                MeetingSummary {
                    place_to_be_announced: true,
                    ..summary("tba", "2026-10-27T17:00", None)
                },
                MeetingSummary {
                    cancelled: true,
                    ..summary("x", "2026-10-27T19:00", Some("Café Neruda"))
                },
                MeetingSummary {
                    online: true,
                    platform: Some("Zoom".to_string()),
                    ..summary("on", "2026-10-28T19:00", None)
                },
                summary("old", "2026-10-29T00:00", None),
            ]
        );
        let json = serde_json::to_string(&result).unwrap();
        assert!(!json.contains("SECRET"), "no links to online meetings");
        assert!(!json.contains("Beschreibung"), "no descriptions");
    }

    #[test]
    fn overview_is_capped() {
        let meetings = |count: usize| {
            (0..count)
                .map(|i| {
                    meeting(
                        &i.to_string(),
                        berlin(2026, 10, 27, 19, 0) + i as i64 * 60_000,
                    )
                })
                .collect::<Vec<_>>()
        };
        let exactly = build_overview(meetings(MAX_MEETINGS), &origin());
        assert!(!exactly.truncated);
        assert_eq!(exactly.meetings.len(), MAX_MEETINGS);

        let more = build_overview(meetings(MAX_MEETINGS + 1), &origin());
        assert!(more.truncated);
        assert_eq!(more.meetings.len(), MAX_MEETINGS);
        assert_eq!(more.meetings[0].id, "0");
        assert_eq!(
            more.meetings[MAX_MEETINGS - 1].id,
            (MAX_MEETINGS - 1).to_string()
        );
    }

    #[tokio::test]
    async fn answers_are_cached_errors_are_not() {
        let ok = overview_response(build_overview(vec![], &origin()));
        assert_eq!(ok.status(), StatusCode::OK);
        assert_eq!(ok.headers()[header::CACHE_CONTROL], "public, max-age=300");

        let bad = error_response(
            StatusCode::BAD_REQUEST,
            RangeError::OutOfRange { name: "from" }.to_string(),
        );
        assert_eq!(bad.status(), StatusCode::BAD_REQUEST);
        assert_eq!(bad.headers()[header::CACHE_CONTROL], "no-store");
        let body = to_bytes(bad.into_body(), 1024).await.unwrap();
        assert_eq!(body, "'from' must be between 2000-01-01 and 2099-12-31");
    }
}
