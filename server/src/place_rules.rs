//! Rules for places and for where a meeting takes place (a place, or online), and who
//! may read the join link of an online meeting. Messages are German because they are shown
//! to the member who saves.

use unicode_normalization::UnicodeNormalization;
use url::Url;

use crate::types::{Meeting, MeetingStatus, OnlineMeeting, Place, User};

const MAX_PLACE_NAME_LEN: usize = 200;
pub const MAX_PLATFORM_LEN: usize = 50;
pub const MAX_URL_LEN: usize = 2_000;

#[derive(Debug, PartialEq, Eq, Clone, thiserror::Error)]
pub enum PlaceError {
    #[error("Der Name des Ortes fehlt.")]
    MissingName,
    #[error("Der Name des Ortes ist zu lang (höchstens {MAX_PLACE_NAME_LEN} Zeichen).")]
    NameTooLong,
    #[error("Der Name des Ortes enthält unzulässige Steuerzeichen.")]
    ForbiddenCharacters,
    #[error("Der Ort hat keine gültigen Koordinaten.")]
    InvalidCoordinates,
}

#[derive(Debug, PartialEq, Eq, Clone, thiserror::Error)]
pub enum OnlineError {
    #[error("Die Plattform ist zu lang (höchstens {MAX_PLATFORM_LEN} Zeichen).")]
    PlatformTooLong,
    #[error("Die Plattform enthält unzulässige Steuerzeichen.")]
    PlatformForbiddenCharacters,
    #[error("Der Link ist zu lang (höchstens {MAX_URL_LEN} Zeichen).")]
    UrlTooLong,
    #[error("Der Link muss mit https:// oder http:// beginnen.")]
    InvalidUrl,
}

/// Key under which place names must be unique: "Henry‘s  Coffee" and "henry's coffee"
/// are the same place. Mirrored in web/src/places.ts and migrate.js; all three run
/// place_key_cases.json.
pub fn place_name_key(name: &str) -> String {
    name.nfc()
        .map(|c| match c {
            '\u{2018}' | '\u{2019}' | '\u{02BC}' | '\u{00B4}' | '`' => '\'',
            other => other,
        })
        .collect::<String>()
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
        .to_lowercase()
}

/// Control characters and invisible format characters (zero-width, BOM, direction
/// marks/overrides, line/paragraph separators): they make different names look identical
/// or break the iCal feed.
fn is_forbidden_char(c: char) -> bool {
    c.is_control()
        || matches!(
            c,
            '\u{00AD}'
                | '\u{061C}'
                | '\u{180E}'
                | '\u{200B}'..='\u{200F}'
                | '\u{2028}'..='\u{202E}'
                | '\u{2060}'..='\u{2064}'
                | '\u{2066}'..='\u{206F}'
                | '\u{FEFF}'
                | '\u{FFF9}'..='\u{FFFB}'
        )
}

/// Returns the name as it is stored: Unicode-normalized, whitespace collapsed.
pub fn validate_place(name: &str, lat: f64, lon: f64) -> Result<String, PlaceError> {
    let name = name.nfc().collect::<String>();
    if name.chars().any(is_forbidden_char) {
        return Err(PlaceError::ForbiddenCharacters);
    }
    let name = name.split_whitespace().collect::<Vec<_>>().join(" ");
    if name.is_empty() {
        return Err(PlaceError::MissingName);
    }
    if name.chars().count() > MAX_PLACE_NAME_LEN {
        return Err(PlaceError::NameTooLong);
    }
    if !(-90.0..=90.0).contains(&lat)
        || !(-180.0..=180.0).contains(&lon)
        || (lat == 0.0 && lon == 0.0)
    {
        return Err(PlaceError::InvalidCoordinates);
    }
    Ok(name)
}

/// Normalizes and checks the online details of a meeting. An empty URL counts as no URL.
pub fn validate_online(online: &OnlineMeeting) -> Result<OnlineMeeting, OnlineError> {
    let platform = online.platform.trim();
    if platform.chars().count() > MAX_PLATFORM_LEN {
        return Err(OnlineError::PlatformTooLong);
    }
    if platform.chars().any(is_forbidden_char) {
        return Err(OnlineError::PlatformForbiddenCharacters);
    }
    let url = match online.url.as_deref().map(str::trim) {
        None | Some("") => None,
        Some(url) => {
            if url.chars().count() > MAX_URL_LEN {
                return Err(OnlineError::UrlTooLong);
            }
            let parsed = Url::parse(url).map_err(|_| OnlineError::InvalidUrl)?;
            // user:pass@ lets "https://zoom.us@evil.example" look like a Zoom link.
            if !matches!(parsed.scheme(), "https" | "http")
                || parsed.host_str().is_none()
                || !parsed.username().is_empty()
                || parsed.password().is_some()
            {
                return Err(OnlineError::InvalidUrl);
            }
            Some(parsed.to_string())
        }
    };
    Ok(OnlineMeeting {
        platform: platform.to_string(),
        url,
        members_only: online.members_only,
        url_hidden: online.url_hidden,
    })
}

/// Shown instead of a place (card, iCal feed, AI prompt). Mirrored by
/// `PLACE_TO_BE_ANNOUNCED_TEXT` in web/src/places.ts.
pub const PLACE_TO_BE_ANNOUNCED: &str = "Ort wird noch bekanntgegeben";

#[derive(Debug, PartialEq, Eq, Clone, thiserror::Error)]
pub enum VenueError {
    #[error("Bitte einen Ort auswählen, „Online-Treffen“ oder „{tba}“ ankreuzen.", tba = PLACE_TO_BE_ANNOUNCED)]
    MissingPlace,
    #[error("Der gewählte Ort existiert nicht mehr, bitte neu auswählen.")]
    UnknownPlace,
    /// Online details and "to be announced" together; for new meetings also a place with
    /// either of them. A saved meeting may keep its place (the editor keeps it while a box
    /// is ticked): `finish_venue` drops it.
    #[error("Bitte nur eins angeben: einen Ort, Online-Angaben oder „{tba}“.", tba = PLACE_TO_BE_ANNOUNCED)]
    SeveralVenues,
    #[error("Bitte den gespeicherten Link zuerst anzeigen, bevor er öffentlich gemacht wird.")]
    HiddenLinkMadePublic,
    #[error(transparent)]
    Online(#[from] OnlineError),
}

/// The client received the meeting with its members-only link withheld (`url_hidden`)
/// and sends `url: null`: keep the stored link. An empty string instead removes it.
fn keeps_stored_link(online: &OnlineMeeting) -> bool {
    online.url_hidden && online.url.is_none()
}

/// Whether saving `meeting` needs the currently stored link (see `finish_venue`).
pub fn needs_stored_link(meeting: &Meeting) -> bool {
    meeting.online.as_ref().is_some_and(keeps_stored_link)
}

/// Decides where a meeting takes place before it is stored: online meetings and meetings
/// whose place is to be announced lose their place, all others get name and coordinates
/// copied from their place (coordinates sent by the client are ignored). `place` is the
/// place `meeting.place_id` refers to; `stored_link` the link currently stored for this
/// meeting (see `needs_stored_link`). Online plus "to be announced" is refused here, as
/// saving goes through this function only; new meetings are checked further before
/// (`meeting_validation::resolve_venue`).
pub fn finish_venue(
    mut meeting: Meeting,
    place: Option<Place>,
    stored_link: Option<String>,
) -> Result<Meeting, VenueError> {
    match meeting.online.take() {
        Some(_) if meeting.place_to_be_announced => return Err(VenueError::SeveralVenues),
        Some(online) => {
            let keep = keeps_stored_link(&online);
            if keep && stored_link.is_some() && !online.members_only {
                // The editor never saw this link; publishing it needs a deliberate look.
                return Err(VenueError::HiddenLinkMadePublic);
            }
            let mut online = validate_online(&online)?;
            if keep {
                online.url = stored_link;
            }
            online.url_hidden = false;
            meeting.online = Some(online);
            meeting.location = None;
            meeting.place_id = None;
        }
        // The editor keeps the chosen place while the box is ticked, as for online.
        None if meeting.place_to_be_announced => {
            meeting.location = None;
            meeting.place_id = None;
        }
        None => {
            if meeting.place_id.is_none() {
                return Err(VenueError::MissingPlace);
            }
            let place = place.ok_or(VenueError::UnknownPlace)?;
            meeting.location = Some(place.as_location());
            meeting.place_id = Some(place._id);
        }
    }
    Ok(meeting)
}

/// Outcome of a request for the join link of a meeting.
#[derive(Debug, PartialEq, Eq)]
pub enum LinkAccess {
    /// The link (`None` if none is set yet).
    Granted(Option<String>),
    /// No such meeting for this viewer (also hides unpublished meetings from non-editors).
    NotFound,
    LoginRequired,
    Forbidden,
}

/// Who may read the join link: anyone for public links, verified members and editors for
/// members-only links, editors only while the meeting is not published (`Planned`).
/// `user` is the viewer's user record, `logged_in` whether there is a session at all.
pub fn link_access(meeting: Option<&Meeting>, logged_in: bool, user: Option<&User>) -> LinkAccess {
    let Some(meeting) = meeting.filter(|meeting| meeting.deleted_at.is_none()) else {
        return LinkAccess::NotFound;
    };
    let is_editor = user
        .is_some_and(|user| user.has_capability(&crate::types::UserCapabilities::UpdateMeetings));
    if meeting.status == MeetingStatus::Planned && !is_editor {
        return LinkAccess::NotFound;
    }
    let Some(online) = &meeting.online else {
        return LinkAccess::NotFound;
    };
    if !online.members_only {
        return LinkAccess::Granted(online.url.clone());
    }
    match user {
        Some(user) if user.may_see_members_only_links() => LinkAccess::Granted(online.url.clone()),
        _ if !logged_in => LinkAccess::LoginRequired,
        _ => LinkAccess::Forbidden,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::types::{stored_test_meeting, MeetingLocation};

    #[test]
    fn place_name_key_unifies_spelling_variants() {
        assert_eq!(place_name_key("Henry‘s  Coffee"), "henry's coffee");
        assert_eq!(place_name_key(" Henry's Coffee "), "henry's coffee");
        assert_eq!(place_name_key("Mo CLub"), place_name_key("Mo Club"));
        // Decomposed é (e + U+0301) equals the composed one.
        assert_eq!(place_name_key("Cafe\u{301} 13"), place_name_key("Café 13"));
    }

    #[test]
    fn validate_place_accepts_and_normalizes() {
        assert_eq!(
            validate_place("  Café   Neruda ", 48.37, 10.89),
            Ok("Café Neruda".to_string())
        );
        assert_eq!(
            validate_place("Cafe\u{301} 13", 48.37, 10.89),
            Ok("Café 13".to_string())
        );
        assert_eq!(validate_place("A", -90.0, 180.0), Ok("A".to_string()));
        assert_eq!(validate_place("A", 0.0, 10.9), Ok("A".to_string()));
    }

    #[test]
    fn validate_place_rejects_bad_input() {
        assert_eq!(
            validate_place("  ", 48.0, 10.0),
            Err(PlaceError::MissingName)
        );
        assert_eq!(
            validate_place(&"x".repeat(MAX_PLACE_NAME_LEN + 1), 48.0, 10.0),
            Err(PlaceError::NameTooLong)
        );
        assert_eq!(
            validate_place("A\nB", 48.0, 10.0),
            Err(PlaceError::ForbiddenCharacters)
        );
        for name in [
            "\u{202E}A",
            "A\u{200B}",
            "\u{FEFF}A",
            "A\u{200E}",
            "A\u{2028}B",
            "A\u{00AD}B",
        ] {
            assert_eq!(
                validate_place(name, 48.0, 10.0),
                Err(PlaceError::ForbiddenCharacters),
                "{name:?}"
            );
        }
        for (lat, lon) in [
            (0.0, 0.0),
            (90.1, 10.0),
            (48.0, -180.1),
            (f64::NAN, 10.0),
            (48.0, f64::INFINITY),
        ] {
            assert_eq!(
                validate_place("A", lat, lon),
                Err(PlaceError::InvalidCoordinates),
                "{lat} {lon}"
            );
        }
    }

    fn online(platform: &str, url: Option<&str>) -> OnlineMeeting {
        OnlineMeeting {
            platform: platform.to_string(),
            url: url.map(str::to_string),
            members_only: true,
            url_hidden: false,
        }
    }

    #[test]
    fn validate_online_normalizes() {
        let result =
            validate_online(&online(" Zoom ", Some(" https://zoom.us/j/123?pwd=x "))).unwrap();
        assert_eq!(result.platform, "Zoom");
        assert_eq!(result.url.as_deref(), Some("https://zoom.us/j/123?pwd=x"));
        assert_eq!(validate_online(&online("", Some(""))).unwrap().url, None);
        assert_eq!(validate_online(&online("", None)).unwrap().url, None);
    }

    #[test]
    fn validate_online_rejects_bad_links_and_platforms() {
        for url in [
            "zoom.us/j/123",
            "https://zoom.us@evil.example/j/1",
            "https://user:pass@zoom.us/j/1",
            "javascript:alert(1)",
            "ftp://example.com",
            "https://",
            "mailto:a@b.de",
        ] {
            assert_eq!(
                validate_online(&online("Zoom", Some(url))),
                Err(OnlineError::InvalidUrl),
                "{url}"
            );
        }
        assert_eq!(
            validate_online(&online(
                "Zoom",
                Some(&format!("https://a.de/{}", "x".repeat(MAX_URL_LEN)))
            )),
            Err(OnlineError::UrlTooLong)
        );
        assert_eq!(
            validate_online(&online(&"x".repeat(MAX_PLATFORM_LEN + 1), None)),
            Err(OnlineError::PlatformTooLong)
        );
        for platform in ["Zo\nom", "Zoom\u{200B}"] {
            assert_eq!(
                validate_online(&online(platform, None)),
                Err(OnlineError::PlatformForbiddenCharacters)
            );
        }
    }

    /// A legacy meeting with only a location.
    fn meeting() -> Meeting {
        let mut meeting = stored_test_meeting();
        meeting.location = Some(MeetingLocation {
            name: "Alt".to_string(),
            lat: 1.0,
            lon: 2.0,
        });
        meeting
    }

    fn place() -> Place {
        Place {
            _id: "p1".to_string(),
            name: "Café Neruda".to_string(),
            lat: 48.37,
            lon: 10.89,
        }
    }

    #[test]
    fn legacy_meeting_without_new_fields_deserializes() {
        let meeting = meeting();
        assert_eq!(meeting.place_id, None);
        assert_eq!(meeting.online, None);
        assert!(!meeting.place_to_be_announced);
        assert_eq!(meeting.location.unwrap().name, "Alt");
    }

    #[test]
    fn place_is_copied_from_the_place_not_the_client() {
        let mut input = meeting();
        input.place_id = Some("p1".to_string());
        let result = finish_venue(input, Some(place()), None).unwrap();
        assert_eq!(
            result.location,
            Some(MeetingLocation {
                name: "Café Neruda".to_string(),
                lat: 48.37,
                lon: 10.89
            })
        );
        assert_eq!(result.place_id.as_deref(), Some("p1"));
    }

    #[test]
    fn meeting_without_place_or_online_is_rejected() {
        assert_eq!(
            finish_venue(meeting(), None, None),
            Err(VenueError::MissingPlace)
        );
        assert_eq!(
            VenueError::MissingPlace.to_string(),
            "Bitte einen Ort auswählen, „Online-Treffen“ oder „Ort wird noch bekanntgegeben“ ankreuzen."
        );
        let mut input = meeting();
        input.place_id = Some("gone".to_string());
        assert_eq!(
            finish_venue(input, None, None),
            Err(VenueError::UnknownPlace)
        );
    }

    #[test]
    fn online_meeting_drops_place_and_validates_link() {
        let mut input = meeting();
        input.place_id = Some("p1".to_string());
        input.online = Some(online("Zoom", Some("https://zoom.us/j/1")));
        let result = finish_venue(input, None, None).unwrap();
        assert_eq!(result.location, None);
        assert_eq!(result.place_id, None);
        assert_eq!(
            result.online.unwrap().url.as_deref(),
            Some("https://zoom.us/j/1")
        );

        let mut input = meeting();
        input.online = Some(online("Zoom", Some("zoom.us")));
        assert_eq!(
            finish_venue(input, None, None),
            Err(VenueError::Online(OnlineError::InvalidUrl))
        );
    }

    #[test]
    fn place_to_be_announced_drops_a_kept_place() {
        let mut input = meeting();
        input.place_id = Some("p1".to_string());
        input.place_to_be_announced = true;
        let result = finish_venue(input, Some(place()), None).unwrap();
        assert_eq!(result.place_id, None);
        assert_eq!(result.location, None);
        assert_eq!(result.online, None);
        assert!(result.place_to_be_announced);

        // The kept place may have been deleted meanwhile: nothing to look up.
        let mut input = meeting();
        input.place_id = Some("gone".to_string());
        input.place_to_be_announced = true;
        assert!(finish_venue(input, None, None).is_ok());
    }

    #[test]
    fn place_to_be_announced_and_online_are_refused() {
        let mut input = meeting();
        input.place_to_be_announced = true;
        input.online = Some(online("Zoom", None));
        assert_eq!(
            finish_venue(input, None, None),
            Err(VenueError::SeveralVenues)
        );
        assert_eq!(
            VenueError::SeveralVenues.to_string(),
            "Bitte nur eins angeben: einen Ort, Online-Angaben oder „Ort wird noch bekanntgegeben“."
        );
    }

    fn hidden(url: Option<&str>, members_only: bool) -> Meeting {
        let mut details = online("Zoom", url);
        details.url_hidden = true;
        details.members_only = members_only;
        let mut input = meeting();
        input.online = Some(details);
        input
    }

    const OLD: &str = "https://zoom.us/j/old";

    #[test]
    fn withheld_link_is_kept_when_untouched() {
        let input = hidden(None, true);
        assert!(needs_stored_link(&input));
        let stored = finish_venue(input, None, Some(OLD.to_string()))
            .unwrap()
            .online
            .unwrap();
        assert_eq!(stored.url.as_deref(), Some(OLD));
        assert!(!stored.url_hidden, "url_hidden is never stored");
    }

    #[test]
    fn withheld_link_is_replaced_or_removed_on_request() {
        let input = hidden(Some("https://zoom.us/j/new"), true);
        assert!(!needs_stored_link(&input));
        let replaced = finish_venue(input, None, Some(OLD.to_string())).unwrap();
        assert_eq!(
            replaced.online.unwrap().url.as_deref(),
            Some("https://zoom.us/j/new")
        );

        // An empty field means "no link", even though the link had been withheld.
        let input = hidden(Some(""), true);
        assert!(!needs_stored_link(&input));
        let removed = finish_venue(input, None, Some(OLD.to_string())).unwrap();
        assert_eq!(removed.online.unwrap().url, None);
    }

    #[test]
    fn withheld_link_cannot_be_published_unseen() {
        assert_eq!(
            finish_venue(hidden(None, false), None, Some(OLD.to_string())),
            Err(VenueError::HiddenLinkMadePublic)
        );
        // Once the editor has the link in the form, publishing it is fine.
        let published = finish_venue(hidden(Some(OLD), false), None, Some(OLD.to_string()))
            .unwrap()
            .online
            .unwrap();
        assert!(!published.members_only);
        assert_eq!(published.url.as_deref(), Some(OLD));
        // Nothing stored: nothing can leak.
        assert!(finish_venue(hidden(None, false), None, None).is_ok());
    }

    #[test]
    fn without_private_link_hides_only_members_only_links() {
        let mut members = meeting();
        members.online = Some(online("Zoom", Some("https://zoom.us/j/1")));
        let redacted = members.without_private_link().online.unwrap();
        assert_eq!(redacted.url, None);
        assert!(redacted.url_hidden);

        let mut public = meeting();
        let mut public_online = online("YouTube", Some("https://youtube.com/live"));
        public_online.members_only = false;
        public.online = Some(public_online);
        let kept = public.without_private_link().online.unwrap();
        assert_eq!(kept.url.as_deref(), Some("https://youtube.com/live"));
        assert!(!kept.url_hidden);

        let mut no_link = meeting();
        no_link.online = Some(online("Zoom", None));
        assert!(!no_link.without_private_link().online.unwrap().url_hidden);
    }

    #[test]
    fn migration_places_use_the_server_name_key() {
        let places: serde_json::Value =
            serde_json::from_str(include_str!("../migrations/2026-10-21-places/places.json"))
                .unwrap();
        let places = places["places"].as_array().unwrap();
        assert!(places.len() > 50);
        let mut keys = std::collections::HashSet::new();
        for place in places {
            let name = place["name"].as_str().unwrap();
            assert_eq!(
                place["name_key"].as_str().unwrap(),
                place_name_key(name),
                "{name}"
            );
            assert!(keys.insert(place_name_key(name)), "duplicate place {name}");
            let (lat, lon) = (
                place["lat"].as_f64().unwrap(),
                place["lon"].as_f64().unwrap(),
            );
            assert!(validate_place(name, lat, lon).is_ok(), "{name}");
        }

        let assignments: serde_json::Value = serde_json::from_str(include_str!(
            "../migrations/2026-10-21-places/meeting-assignments.json"
        ))
        .unwrap();
        let ids: std::collections::HashSet<_> = places
            .iter()
            .map(|place| place["_id"].as_str().unwrap())
            .collect();
        for (meeting, assignment) in assignments["meetings"].as_object().unwrap() {
            if let Some(place) = assignment.get("place") {
                assert!(ids.contains(place.as_str().unwrap()), "meeting {meeting}");
            }
        }
    }

    #[test]
    fn place_name_key_matches_shared_cases() {
        let cases: serde_json::Value =
            serde_json::from_str(include_str!("place_key_cases.json")).unwrap();
        for case in cases["cases"].as_array().unwrap() {
            let (input, expected) = (case[0].as_str().unwrap(), case[1].as_str().unwrap());
            assert_eq!(place_name_key(input), expected, "{input:?}");
        }
    }

    fn user(status: Option<crate::types::MembershipStatus>, editor: bool) -> User {
        let member = status.map(|status| {
            serde_json::from_value::<crate::types::InternalMember>(serde_json::json!({
                "type": "Active", "natural_person": true, "name": null, "institution": null,
                "pronouns": null,
                "address": {"street": "S", "number": "1", "addition": null, "zip": "86150",
                            "city": "Augsburg", "country": "DE"},
                "email": "a@b.de", "phone": null, "start_time_ms": 1, "end_time_ms": null,
                "status": status, "user_notes": null, "admin_notes": null, "reference": null,
                "approved_charter": true, "approved_privacy": true, "above_18": true,
                "honorary": false
            }))
            .unwrap()
        });
        User {
            id: "u".to_string(),
            member,
            capabilities: Some(if editor {
                vec![crate::types::UserCapabilities::UpdateMeetings]
            } else {
                vec![]
            }),
        }
    }

    #[test]
    fn link_access_matrix() {
        use crate::types::MembershipStatus::*;
        let link = Some("https://zoom.us/j/1".to_string());
        let mut members_only = meeting();
        members_only.online = Some(online("Zoom", Some("https://zoom.us/j/1")));
        let mut public = members_only.clone();
        public.online.as_mut().unwrap().members_only = false;
        let mut planned = members_only.clone();
        planned.status = MeetingStatus::Planned;
        let mut deleted = members_only.clone();
        deleted.deleted_at = Some(1);
        let at_place = meeting();

        let approved = user(Some(Approved), false);
        let editor = user(None, true);
        let anonymous: Option<&User> = None;

        // Public links: everyone, logged in or not.
        assert_eq!(
            link_access(Some(&public), false, anonymous),
            LinkAccess::Granted(link.clone())
        );
        // Members-only links.
        assert_eq!(
            link_access(Some(&members_only), false, anonymous),
            LinkAccess::LoginRequired
        );
        for status in [Pending, Rejected, Left, Expelled] {
            let other = user(Some(status.clone()), false);
            assert_eq!(
                link_access(Some(&members_only), true, Some(&other)),
                LinkAccess::Forbidden,
                "{status:?}"
            );
        }
        assert_eq!(
            link_access(Some(&members_only), true, Some(&user(None, false))),
            LinkAccess::Forbidden
        );
        // Logged in, but no user record yet.
        assert_eq!(
            link_access(Some(&members_only), true, None),
            LinkAccess::Forbidden
        );
        assert_eq!(
            link_access(Some(&members_only), true, Some(&approved)),
            LinkAccess::Granted(link.clone())
        );
        assert_eq!(
            link_access(Some(&members_only), true, Some(&editor)),
            LinkAccess::Granted(link.clone())
        );
        // Unpublished meetings exist only for editors, even with a public link.
        let mut planned_public = public.clone();
        planned_public.status = MeetingStatus::Planned;
        for planned in [&planned, &planned_public] {
            assert_eq!(
                link_access(Some(planned), false, anonymous),
                LinkAccess::NotFound
            );
            assert_eq!(
                link_access(Some(planned), true, Some(&approved)),
                LinkAccess::NotFound
            );
            assert!(matches!(
                link_access(Some(planned), true, Some(&editor)),
                LinkAccess::Granted(_)
            ));
        }
        // Deleted, missing and non-online meetings.
        assert_eq!(
            link_access(Some(&deleted), true, Some(&editor)),
            LinkAccess::NotFound
        );
        assert_eq!(link_access(None, true, Some(&editor)), LinkAccess::NotFound);
        assert_eq!(
            link_access(Some(&at_place), true, Some(&editor)),
            LinkAccess::NotFound
        );
    }
}
