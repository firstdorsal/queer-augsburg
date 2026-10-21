// Where a meeting takes place: one of the stored places, or online.

import type { Meeting } from "./apiTypes/Meeting";
import type { OnlineMeeting } from "./apiTypes/OnlineMeeting";
import type { Place } from "./apiTypes/Place";
import type { User } from "./apiTypes/User";

// Unicode White_Space, which Rust's split_whitespace uses (JavaScript's \s differs).
const WHITESPACE = new RegExp(
    "[\\t-\\r \\u0085\\u00A0\\u1680\\u2000-\\u200A\\u2028\\u2029\\u202F\\u205F\\u3000]+"
);
const APOSTROPHES = new RegExp("[\\u2018\\u2019\\u02BC\\u00B4`]", "g");

/** Same normalization as server/src/place_rules.rs `place_name_key` (shared test cases). */
export const placeNameKey = (name: string): string =>
    name
        .normalize("NFC")
        .replace(APOSTROPHES, "'")
        .split(WHITESPACE)
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

/** The stored place with the same name (ignoring case, spacing and apostrophe style). */
export const findPlaceByName = (places: readonly Place[], name: string): Place | null => {
    const key = placeNameKey(name);
    if (!key) return null;
    return places.find((place) => placeNameKey(place.name) === key) ?? null;
};

/** The link if it is a plain http(s) URL; anything else (e.g. `javascript:`) is never rendered. */
export const safeHttpUrl = (url: string | null | undefined): string | null => {
    if (!url) return null;
    try {
        const parsed = new URL(url);
        return parsed.protocol === "https:" || parsed.protocol === "http:" ? parsed.href : null;
    } catch {
        return null;
    }
};

/** Mirrors the server's `User::may_see_members_only_links`. */
export const maySeeMembersOnlyLinks = (user: User | null | undefined): boolean =>
    !!user &&
    (user.capabilities?.includes("UpdateMeetings") === true || user.member?.status === "Approved");

/** Shown on the meeting card instead of the place. */
export const onlineLabel = (online: OnlineMeeting): string =>
    online.platform.trim() ? `Online · ${online.platform.trim()}` : "Online";

/** Calendar location, same format as the server's iCal feed (`ical_location`). */
export const meetingVenueText = (meeting: Meeting): string => {
    if (meeting.online) {
        const platform = meeting.online.platform.trim();
        const label = platform ? `Online (${platform})` : "Online";
        const url = safeHttpUrl(meeting.online.url);
        return url ? `${label}: ${url}` : label;
    }
    if (meeting.location) {
        return `${meeting.location.name}: ${meeting.location.lat},${meeting.location.lon}`;
    }
    return "";
};

export const newOnlineMeeting = (): OnlineMeeting => ({
    platform: "",
    url: null,
    members_only: true,
    url_hidden: false
});

/** The meeting came with its members-only link withheld and the editor has not loaded or
 * changed it: saving keeps the stored link (server: `keeps_stored_link`). */
export const keepsHiddenLink = (online: OnlineMeeting): boolean =>
    online.url_hidden && online.url === null;

/** Why the meeting cannot be saved yet, or null. The server checks the same. */
export const venueProblem = (meeting: Meeting): string | null => {
    if (meeting.online) {
        const url = meeting.online.url?.trim();
        if (url && safeHttpUrl(url) === null) {
            return "Der Link muss mit https:// oder http:// beginnen.";
        }
        if (keepsHiddenLink(meeting.online) && !meeting.online.members_only) {
            return "Bitte den gespeicherten Link zuerst anzeigen, bevor er öffentlich gemacht wird.";
        }
        return null;
    }
    return meeting.place_id ? null : "Bitte einen Ort auswählen oder „Online-Treffen“ ankreuzen.";
};
