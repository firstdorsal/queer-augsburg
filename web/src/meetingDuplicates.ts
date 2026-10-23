// Finding meetings that may describe the same event: an imported draft against the stored
// meetings and against the other drafts. Only hints: the member decides.

import type { Meeting } from "./apiTypes/Meeting";
import type { MeetingStatus } from "./apiTypes/MeetingStatus";
import { HOUR_MS, berlinDay, formatBerlinTime } from "./berlinTime";
import { foldAccents, meetingVenue, placeNameKey, trimWhiteSpace } from "./places";

/** What two meetings are compared by. */
export interface MeetingCandidate {
    readonly title: string;
    /** UTC timestamp in milliseconds. */
    readonly time: number;
    /** The stored place, if known. */
    readonly placeId: string | null;
    /** The place name (stored meetings from before places only have this); null online. */
    readonly placeName: string | null;
    /** The platform of an online meeting ("" if unknown); null if it is not online. */
    readonly onlinePlatform: string | null;
}

/** A stored meeting that can be compared: it has a start time and is not deleted. */
export type TimedMeeting = Meeting & { readonly time: number };

export const comparableMeetings = (meetings: readonly Meeting[]): TimedMeeting[] =>
    meetings.filter(
        (meeting): meeting is TimedMeeting => meeting.time !== null && !meeting.deleted_at
    );

export const candidateOfMeeting = (meeting: TimedMeeting): MeetingCandidate => {
    const venue = meetingVenue(meeting);
    // Online meetings and places to be announced have no place to compare.
    const hasPlace = venue.kind === "place" || venue.kind === "unknown";
    return {
        title: meeting.title,
        time: meeting.time,
        placeId: hasPlace ? (meeting.place_id ?? null) : null,
        placeName: venue.kind === "place" ? venue.location.name : null,
        onlinePlatform: venue.kind === "online" ? venue.online.platform : null
    };
};

// Words that do not tell meetings apart: German and English function words, and the
// group's own name, which is part of many titles. Folded like the title words.
const STOP_WORDS: ReadonlySet<string> = new Set([
    "am",
    "an",
    "auf",
    "bei",
    "beim",
    "das",
    "dem",
    "den",
    "der",
    "des",
    "die",
    "ein",
    "eine",
    "fur",
    "im",
    "in",
    "mit",
    "und",
    "vom",
    "von",
    "zu",
    "zum",
    "zur",
    "and",
    "of",
    "the",
    "augsburg",
    "queer",
    "queere",
    "queeren",
    "queerer",
    "queeres"
]);
const MIN_WORD_LENGTH = 2;
/** Mostly the same words: Dice coefficient of the word sets. */
const DICE_THRESHOLD = 0.6;
/** One short shared word ("Bar") is no evidence. */
const MIN_SHARED_LETTERS = 4;
/** Two meetings at the same place (or online platform) this close count as the same slot. */
const SAME_VENUE_WINDOW_MS = HOUR_MS;
/** Instants on the same Berlin day are less than 25 hours apart (DST days have 25). */
const MAX_SAME_DAY_DISTANCE_MS = 25 * HOUR_MS;

/** Words without accents, emoji, punctuation, pure numbers ("2026", "19:00") and stop words. */
const titleWords = (title: string): Set<string> =>
    new Set(
        foldAccents(title)
            .toLowerCase()
            .split(/[^\p{L}\p{N}]+/u)
            .filter(
                (word) =>
                    word.length >= MIN_WORD_LENGTH &&
                    !/^\p{N}+$/u.test(word) &&
                    !STOP_WORDS.has(word)
            )
    );

/**
 * Mostly the same words (Dice coefficient), or all words of the shorter title in the longer
 * one ("Stammtisch" / "Queerer Stammtisch im Oktober"); either way the shared words need at
 * least four letters. Titles without any such words ("🎃") are compared as a whole.
 */
export const similarTitles = (a: string, b: string): boolean => {
    const left = titleWords(a);
    const right = titleWords(b);
    if (left.size === 0 || right.size === 0) {
        const whole = trimWhiteSpace(a).toLowerCase();
        return whole !== "" && whole === trimWhiteSpace(b).toLowerCase();
    }
    const shared = [...left].filter((word) => right.has(word));
    if (shared.join("").length < MIN_SHARED_LETTERS) return false;
    const shorter = left.size <= right.size ? left : right;
    return (
        (2 * shared.length) / (left.size + right.size) >= DICE_THRESHOLD ||
        shared.length === shorter.size
    );
};

/** Same stored place (or place name), or both online on the same platform; an unknown
 * platform could be any. */
const sameVenue = (a: MeetingCandidate, b: MeetingCandidate): boolean => {
    if (a.onlinePlatform !== null || b.onlinePlatform !== null) {
        if (a.onlinePlatform === null || b.onlinePlatform === null) return false;
        const left = trimWhiteSpace(a.onlinePlatform).toLowerCase();
        const right = trimWhiteSpace(b.onlinePlatform).toLowerCase();
        return left === "" || right === "" || left === right;
    }
    if (a.placeId !== null && b.placeId !== null) return a.placeId === b.placeId;
    return (
        a.placeName !== null &&
        b.placeName !== null &&
        placeNameKey(a.placeName) === placeNameKey(b.placeName)
    );
};

/** At the same venue within an hour, or on the same Berlin day with a similar title. */
export const similarMeetings = (a: MeetingCandidate, b: MeetingCandidate): boolean => {
    const apart = Math.abs(a.time - b.time);
    if (apart <= SAME_VENUE_WINDOW_MS && sameVenue(a, b)) return true;
    return (
        apart < MAX_SAME_DAY_DISTANCE_MS &&
        berlinDay(a.time) === berlinDay(b.time) &&
        similarTitles(a.title, b.title)
    );
};

/** Stored meetings the candidate may duplicate. */
export const possibleDuplicates = (
    candidate: MeetingCandidate,
    stored: readonly TimedMeeting[]
): TimedMeeting[] =>
    stored.filter((meeting) => similarMeetings(candidate, candidateOfMeeting(meeting)));

// Lower case, for running text ("(geplant)").
const STATUS_TEXT: Record<MeetingStatus, string> = { Active: "aktiv", Planned: "geplant" };

export const meetingStateText = (meeting: Meeting): string =>
    meeting.cancelled ? "abgesagt" : STATUS_TEXT[meeting.status];

export const duplicateWarning = (meeting: TimedMeeting): string =>
    `Gibt es vielleicht schon: „${meeting.title}“, ${formatBerlinTime(meeting.time)} (${meetingStateText(meeting)}).`;
