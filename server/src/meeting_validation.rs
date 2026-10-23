//! Validation of meetings created in bulk. Bulk imports are typically produced by
//! an AI model, so every author-supplied field of `NewMeeting` is checked instead of
//! trusting the client: the content fields here, the place or online details by
//! `place_rules` (see `prepare_meeting_batch`). All meetings pass the content checks
//! before any venue is checked, so the reported meeting is the first one with a
//! content error, or else the first one with a venue error.
//!
//! The rules and messages are mirrored client-side in `web/src/bulkImport.ts`
//! (`validateFields`, with `onlineProblem` from `web/src/places.ts`) for instant
//! feedback. Both implementations run the shared cases in
//! `meeting_validation_cases.json`, so a change to either side that is not made in
//! the other fails the tests.

use std::collections::{HashMap, HashSet};
use std::fmt;
use std::hash::Hash;

use crate::place_rules::{finish_venue, VenueError};
use crate::types::{Meeting, NewMeeting, Place};

pub const MAX_MEETINGS_PER_BATCH: usize = 50;

pub const MAX_TITLE_LEN: usize = 200;
pub const MAX_AUTHORITY_LEN: usize = 200;
pub const MAX_DESCRIPTION_LEN: usize = 20_000;
pub const MAX_NOTE_LEN: usize = 2_000;
pub const MAX_FREEFORM_TAGS: usize = 20;
pub const MAX_FREEFORM_TAG_LEN: usize = 50;
pub const MAX_PRICE: f32 = 10_000.0;

/// 2000-01-01T00:00:00Z in milliseconds (inclusive).
pub const MIN_TIME_MS: i64 = 946_684_800_000;
/// 2100-01-01T00:00:00Z in milliseconds (exclusive).
pub const MAX_TIME_MS: i64 = 4_102_444_800_000;

/// Upper bound for the request body: every meeting at its maximal field lengths with
/// 4-byte UTF-8 characters, plus headroom for JSON syntax. Axum's 2 MB default would
/// reject legitimate maximal batches with a plain 413.
pub const MAX_BATCH_BODY_BYTES: usize = 8 * 1024 * 1024;

/// Zero-width characters count as blank: a title consisting only of them looks empty.
const ZERO_WIDTH_CHARS: [char; 5] = ['\u{200B}', '\u{200C}', '\u{200D}', '\u{2060}', '\u{FEFF}'];

/// Bidirectional overrides/isolates can make displayed text differ from the stored text.
fn is_bidi_control(c: char) -> bool {
    matches!(c, '\u{202A}'..='\u{202E}' | '\u{2066}'..='\u{2069}')
}

#[derive(Debug, PartialEq, Eq, Clone, Copy)]
pub enum MeetingField {
    Title,
    Authority,
    Description,
    TriggerWarning,
    Accessibility,
    FreeformTag,
}

impl fmt::Display for MeetingField {
    fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
        f.write_str(match self {
            MeetingField::Title => "Titel",
            MeetingField::Authority => "Ansprechpersonen",
            MeetingField::Description => "Beschreibung",
            MeetingField::TriggerWarning => "Triggerwarnung",
            MeetingField::Accessibility => "Barrierefreiheit",
            MeetingField::FreeformTag => "Eigener Tag",
        })
    }
}

/// Why a bulk import was rejected. The messages are German because they are shown
/// to the member who submitted the import.
#[derive(Debug, PartialEq, Clone, thiserror::Error)]
pub enum MeetingBatchError {
    #[error("Es wurden keine Treffen übergeben.")]
    Empty,
    #[error("Es können höchstens {MAX_MEETINGS_PER_BATCH} Treffen auf einmal angelegt werden.")]
    TooMany,
    #[error("Treffen {}: {reason}", index + 1)]
    InvalidMeeting {
        index: usize,
        reason: MeetingValidationError,
    },
    #[error("Treffen {}: {reason}", index + 1)]
    InvalidVenue { index: usize, reason: VenueError },
}

impl MeetingBatchError {
    /// The meeting the error is about, if it is about one.
    pub fn index(&self) -> Option<usize> {
        match self {
            MeetingBatchError::InvalidMeeting { index, .. }
            | MeetingBatchError::InvalidVenue { index, .. } => Some(*index),
            MeetingBatchError::Empty | MeetingBatchError::TooMany => None,
        }
    }
}

#[derive(Debug, PartialEq, Eq, Clone, thiserror::Error)]
pub enum MeetingValidationError {
    #[error("{0} fehlt.")]
    MissingText(MeetingField),
    #[error("{field} ist zu lang (höchstens {max_len} Zeichen).")]
    TextTooLong { field: MeetingField, max_len: usize },
    #[error("{0} enthält unzulässige Steuerzeichen.")]
    ForbiddenCharacters(MeetingField),
    #[error("Zeit liegt außerhalb des gültigen Bereichs.")]
    TimeOutOfRange,
    #[error("Preis muss aus einem oder zwei Werten bestehen.")]
    PriceLength,
    #[error("Preis ist ungültig.")]
    InvalidPrice,
    #[error("Preis: \"von\" ist größer als \"bis\".")]
    PriceRangeReversed,
    #[error("Altersbeschränkung darf höchstens zwei Werte haben.")]
    AgeRestrictionLength,
    #[error("Altersbeschränkung: \"von\" ist größer als \"bis\".")]
    AgeRestrictionReversed,
    #[error("Höchstens {MAX_FREEFORM_TAGS} eigene Tags erlaubt.")]
    TooManyFreeformTags,
    #[error("Tags dürfen nicht doppelt vorkommen.")]
    DuplicateTags,
}

pub fn validate_meeting_batch(meetings: &[NewMeeting]) -> Result<(), MeetingBatchError> {
    if meetings.is_empty() {
        return Err(MeetingBatchError::Empty);
    }
    if meetings.len() > MAX_MEETINGS_PER_BATCH {
        return Err(MeetingBatchError::TooMany);
    }
    for (index, meeting) in meetings.iter().enumerate() {
        validate_new_meeting(meeting)
            .map_err(|reason| MeetingBatchError::InvalidMeeting { index, reason })?;
    }
    Ok(())
}

/// Validates a whole batch and turns it into the meetings to store: content first (all
/// meetings), then each meeting's venue against the stored `places` (keyed by id),
/// whose name and coordinates are copied into the meeting.
pub fn prepare_meeting_batch(
    meetings: Vec<NewMeeting>,
    places: &HashMap<String, Place>,
) -> Result<Vec<Meeting>, MeetingBatchError> {
    validate_meeting_batch(&meetings)?;
    meetings
        .into_iter()
        .enumerate()
        .map(|(index, meeting)| {
            resolve_venue(meeting, places)
                .map_err(|reason| MeetingBatchError::InvalidVenue { index, reason })
        })
        .collect()
}

fn resolve_venue(
    meeting: NewMeeting,
    places: &HashMap<String, Place>,
) -> Result<Meeting, VenueError> {
    // Before the place lookup, so a place next to online details or "to be announced" is
    // reported as such, not as an unknown place. Saving an existing meeting may keep the
    // place (see `VenueError::SeveralVenues`), a new one may not.
    let venues = [
        meeting.place_id.is_some(),
        meeting.online.is_some(),
        meeting.place_to_be_announced,
    ];
    if venues.into_iter().filter(|&set| set).count() > 1 {
        return Err(VenueError::SeveralVenues);
    }
    let place = meeting
        .place_id
        .as_ref()
        .and_then(|place_id| places.get(place_id))
        .cloned();
    // A new meeting has no stored link to keep.
    finish_venue(meeting.into_meeting(), place, None)
}

/// Returns the first rule the meeting violates. The order of the checks is part of
/// the contract with the client mirror, which reports the same error first.
fn validate_new_meeting(meeting: &NewMeeting) -> Result<(), MeetingValidationError> {
    use MeetingValidationError::*;

    check_required_line(MeetingField::Title, &meeting.title, MAX_TITLE_LEN)?;
    check_optional_line(
        MeetingField::Authority,
        &meeting.authority,
        MAX_AUTHORITY_LEN,
    )?;
    check_description(&meeting.description)?;

    if !(MIN_TIME_MS..MAX_TIME_MS).contains(&meeting.time) {
        return Err(TimeOutOfRange);
    }

    // Place or online details are checked by `place_rules::finish_venue`.

    if meeting.price.is_empty() || meeting.price.len() > 2 {
        return Err(PriceLength);
    }
    if meeting
        .price
        .iter()
        .any(|price| !(0.0..=MAX_PRICE).contains(price))
    {
        return Err(InvalidPrice);
    }
    if meeting.price.len() == 2 && meeting.price[0] > meeting.price[1] {
        return Err(PriceRangeReversed);
    }

    if meeting.age_restriction.len() > 2 {
        return Err(AgeRestrictionLength);
    }
    if meeting.age_restriction.len() == 2 && meeting.age_restriction[0] > meeting.age_restriction[1]
    {
        return Err(AgeRestrictionReversed);
    }

    if let Some(text) = &meeting.trigger_warning {
        check_optional_line(MeetingField::TriggerWarning, text, MAX_NOTE_LEN)?;
    }
    if let Some(text) = &meeting.accessibility {
        check_optional_line(MeetingField::Accessibility, text, MAX_NOTE_LEN)?;
    }

    let tags = &meeting.tags;
    if tags.freeform.len() > MAX_FREEFORM_TAGS {
        return Err(TooManyFreeformTags);
    }
    for tag in &tags.freeform {
        check_required_line(MeetingField::FreeformTag, tag, MAX_FREEFORM_TAG_LEN)?;
    }
    if has_duplicates(&tags.freeform) || has_duplicates(&tags.common) || has_duplicates(&tags.queer)
    {
        return Err(DuplicateTags);
    }

    Ok(())
}

fn is_blank(value: &str) -> bool {
    value
        .chars()
        .all(|c| c.is_whitespace() || ZERO_WIDTH_CHARS.contains(&c))
}

fn check_required_line(
    field: MeetingField,
    value: &str,
    max_len: usize,
) -> Result<(), MeetingValidationError> {
    if is_blank(value) {
        return Err(MeetingValidationError::MissingText(field));
    }
    check_optional_line(field, value, max_len)
}

/// Single-line text: no control characters at all (they would also break the iCal feed).
fn check_optional_line(
    field: MeetingField,
    value: &str,
    max_len: usize,
) -> Result<(), MeetingValidationError> {
    check_max_len(field, value, max_len)?;
    if value.chars().any(|c| c.is_control() || is_bidi_control(c)) {
        return Err(MeetingValidationError::ForbiddenCharacters(field));
    }
    Ok(())
}

/// Markdown text: line breaks and tabs are fine, other control characters are not.
fn check_description(value: &str) -> Result<(), MeetingValidationError> {
    let field = MeetingField::Description;
    check_max_len(field, value, MAX_DESCRIPTION_LEN)?;
    if value
        .chars()
        .any(|c| (c.is_control() && !matches!(c, '\n' | '\r' | '\t')) || is_bidi_control(c))
    {
        return Err(MeetingValidationError::ForbiddenCharacters(field));
    }
    Ok(())
}

fn check_max_len(
    field: MeetingField,
    value: &str,
    max_len: usize,
) -> Result<(), MeetingValidationError> {
    if value.chars().count() > max_len {
        return Err(MeetingValidationError::TextTooLong { field, max_len });
    }
    Ok(())
}

fn has_duplicates<T: Eq + Hash>(items: &[T]) -> bool {
    let mut seen = HashSet::new();
    items.iter().any(|item| !seen.insert(item))
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde::Deserialize;
    use serde_json::Value;

    use crate::place_rules::{MAX_PLATFORM_LEN, MAX_URL_LEN};
    use crate::types::{MeetingLocation, MeetingStatus, NewOnlineMeeting};

    fn stored_place() -> Place {
        Place {
            _id: "p1".to_string(),
            name: "Café Neruda".to_string(),
            lat: 48.37,
            lon: 10.9,
        }
    }

    fn stored_places() -> HashMap<String, Place> {
        HashMap::from([("p1".to_string(), stored_place())])
    }

    #[derive(Deserialize)]
    struct ValidationCases {
        base: Value,
        cases: Vec<ValidationCase>,
    }

    #[derive(Deserialize)]
    struct ValidationCase {
        name: String,
        /// RFC 7396 merge patch applied to `base`.
        patch: Value,
        /// Expected message of the first violated rule; `null` means valid.
        error: Option<String>,
        fill: Option<Fill>,
    }

    /// Sets the string at a dotted path to `text` repeated `count` times, for
    /// length cases that would be unreadable inline.
    #[derive(Deserialize)]
    struct Fill {
        path: String,
        text: String,
        count: usize,
    }

    fn merge_patch(target: &mut Value, patch: &Value) {
        match (target, patch) {
            (Value::Object(target), Value::Object(patch)) => {
                for (key, value) in patch {
                    if value.is_null() {
                        target.remove(key);
                    } else {
                        merge_patch(target.entry(key.clone()).or_insert(Value::Null), value);
                    }
                }
            }
            (target, patch) => *target = patch.clone(),
        }
    }

    fn load_cases() -> ValidationCases {
        serde_json::from_str(include_str!("meeting_validation_cases.json"))
            .expect("meeting_validation_cases.json must be valid")
    }

    fn meeting_for(cases: &ValidationCases, case: &ValidationCase) -> NewMeeting {
        let mut value = cases.base.clone();
        merge_patch(&mut value, &case.patch);
        if let Some(fill) = &case.fill {
            let target = fill
                .path
                .split('.')
                .try_fold(&mut value, |current, key| current.get_mut(key))
                .unwrap_or_else(|| panic!("case {:?}: no field {}", case.name, fill.path));
            *target = Value::String(fill.text.repeat(fill.count));
        }
        serde_json::from_value(value)
            .unwrap_or_else(|e| panic!("case {:?} is not a NewMeeting: {e}", case.name))
    }

    #[test]
    fn shared_cases_match_expected_errors() {
        let cases = load_cases();
        assert!(cases.cases.len() > 20, "fixture lost its cases");
        // The handler's path, with "p1" as the only stored place.
        let places = stored_places();
        for case in &cases.cases {
            let meeting = meeting_for(&cases, case);
            let actual = match prepare_meeting_batch(vec![meeting], &places) {
                Ok(_) => None,
                Err(MeetingBatchError::InvalidMeeting { reason, .. }) => Some(reason.to_string()),
                Err(MeetingBatchError::InvalidVenue { reason, .. }) => Some(reason.to_string()),
                Err(e) => panic!("case {:?}: unexpected batch error {e}", case.name),
            };
            assert_eq!(actual, case.error, "case {:?}", case.name);
        }
    }

    #[test]
    fn non_finite_numbers_are_rejected() {
        // JSON cannot express NaN/Infinity, so these are not in the shared cases.
        let cases = load_cases();
        let base = meeting_for(&cases, &cases.cases[0]);

        for price in [f32::NAN, f32::INFINITY] {
            let mut meeting = base.clone();
            meeting.price = vec![price];
            assert_eq!(
                validate_new_meeting(&meeting),
                Err(MeetingValidationError::InvalidPrice)
            );
        }
    }

    #[test]
    fn batch_rejects_empty_and_oversized() {
        let cases = load_cases();
        let valid = meeting_for(&cases, &cases.cases[0]);
        assert_eq!(validate_meeting_batch(&[]), Err(MeetingBatchError::Empty));
        assert_eq!(
            validate_meeting_batch(&vec![valid.clone(); MAX_MEETINGS_PER_BATCH + 1]),
            Err(MeetingBatchError::TooMany)
        );
        assert_eq!(
            validate_meeting_batch(&vec![valid; MAX_MEETINGS_PER_BATCH]),
            Ok(())
        );
    }

    #[test]
    fn batch_reports_index_of_first_invalid_meeting() {
        let cases = load_cases();
        let valid = meeting_for(&cases, &cases.cases[0]);
        let mut invalid = valid.clone();
        invalid.title = String::new();

        let err = validate_meeting_batch(&[valid, invalid]).unwrap_err();
        assert_eq!(
            err,
            MeetingBatchError::InvalidMeeting {
                index: 1,
                reason: MeetingValidationError::MissingText(MeetingField::Title),
            }
        );
        assert_eq!(err.to_string(), "Treffen 2: Titel fehlt.");
    }

    #[test]
    fn maximal_batch_fits_into_body_limit() {
        let cases = load_cases();
        let mut meeting = meeting_for(&cases, &cases.cases[0]);
        // U+1F308 is 4 bytes in UTF-8 and 2 UTF-16 units, the worst case for the body size.
        meeting.description = "\u{1F308}".repeat(MAX_DESCRIPTION_LEN);
        meeting.title = "\u{1F308}".repeat(MAX_TITLE_LEN);
        meeting.authority = "\u{1F308}".repeat(MAX_AUTHORITY_LEN);
        meeting.place_id = None;
        meeting.online = Some(NewOnlineMeeting {
            platform: "\u{1F308}".repeat(MAX_PLATFORM_LEN),
            url: Some(format!(
                "https://a.de/{}",
                "\u{1F308}".repeat(MAX_URL_LEN - "https://a.de/".len())
            )),
            members_only: true,
        });
        meeting.trigger_warning = Some("\u{1F308}".repeat(MAX_NOTE_LEN));
        meeting.accessibility = Some("\u{1F308}".repeat(MAX_NOTE_LEN));
        meeting.tags.freeform = (0..MAX_FREEFORM_TAGS)
            .map(|i| format!("{i:02}{}", "\u{1F308}".repeat(MAX_FREEFORM_TAG_LEN - 2)))
            .collect();
        assert_eq!(validate_new_meeting(&meeting), Ok(()));

        let body = serde_json::to_vec(&crate::types::CreateMeetingsRequestBody {
            meetings: vec![meeting; MAX_MEETINGS_PER_BATCH],
        })
        .unwrap();
        assert!(
            body.len() < MAX_BATCH_BODY_BYTES,
            "{} bytes exceed the limit",
            body.len()
        );
    }

    #[test]
    fn prepared_batch_copies_places_and_keeps_online_details() {
        let cases = load_cases();
        let base = meeting_for(&cases, &cases.cases[0]);
        let mut to_be_announced = base.clone();
        to_be_announced.place_id = None;
        to_be_announced.place_to_be_announced = true;
        let mut online = base.clone();
        online.place_id = None;
        online.online = Some(NewOnlineMeeting {
            platform: " Zoom ".to_string(),
            url: Some("http://example.org".to_string()),
            members_only: true,
        });

        let meetings =
            prepare_meeting_batch(vec![base, online, to_be_announced], &stored_places()).unwrap();

        assert_eq!(meetings[0].place_id.as_deref(), Some("p1"));
        assert_eq!(
            meetings[0].location,
            Some(MeetingLocation {
                name: "Café Neruda".to_string(),
                lat: 48.37,
                lon: 10.9
            })
        );
        assert_eq!(meetings[0].online, None);
        assert!(meetings
            .iter()
            .all(|meeting| meeting.status == MeetingStatus::Planned));
        assert_eq!(meetings[1].place_id, None);
        assert_eq!(meetings[1].location, None);
        let stored = meetings[1].online.as_ref().unwrap();
        assert_eq!(stored.platform, "Zoom");
        assert_eq!(stored.url.as_deref(), Some("http://example.org/"));
        assert!(stored.members_only);
        assert!(!stored.url_hidden);
        assert!(!meetings[0].place_to_be_announced && !meetings[1].place_to_be_announced);
        assert!(meetings[2].place_to_be_announced);
        assert_eq!(
            (
                &meetings[2].place_id,
                &meetings[2].location,
                &meetings[2].online
            ),
            (&None, &None, &None)
        );
    }

    #[test]
    fn new_meetings_without_the_field_have_a_place() {
        let cases = load_cases();
        let mut value = cases.base.clone();
        value
            .as_object_mut()
            .unwrap()
            .remove("place_to_be_announced");
        let meeting: NewMeeting = serde_json::from_value(value).unwrap();
        assert!(!meeting.place_to_be_announced);
    }

    #[test]
    fn venue_errors_name_the_meeting() {
        let cases = load_cases();
        let base = meeting_for(&cases, &cases.cases[0]);
        let mut gone = base.clone();
        gone.place_id = Some("gone".to_string());

        let err = prepare_meeting_batch(vec![base.clone(), gone, base.clone()], &stored_places())
            .unwrap_err();
        assert_eq!(err.index(), Some(1));
        assert_eq!(
            err.to_string(),
            "Treffen 2: Der gewählte Ort existiert nicht mehr, bitte neu auswählen."
        );
    }

    #[test]
    fn content_errors_are_reported_before_venue_errors() {
        let cases = load_cases();
        let base = meeting_for(&cases, &cases.cases[0]);
        let mut no_place = base.clone();
        no_place.place_id = None;
        let mut no_title = base.clone();
        no_title.title = String::new();

        let err = prepare_meeting_batch(vec![no_place, no_title], &stored_places()).unwrap_err();
        assert_eq!(err.to_string(), "Treffen 2: Titel fehlt.");
    }
}
