// Where a meeting takes place: one of the stored places, online, or not fixed yet.

import type { Meeting } from "./apiTypes/Meeting";
import type { MeetingLocation } from "./apiTypes/MeetingLocation";
import type { OnlineMeeting } from "./apiTypes/OnlineMeeting";
import type { Place } from "./apiTypes/Place";
import type { User } from "./apiTypes/User";

// Unicode White_Space, the set Rust's `char::is_whitespace`, `trim` and `split_whitespace`
// use (JavaScript's `\s` and `String.prototype.trim` also include U+FEFF, which the server
// rejects as a format character).
const WHITE_SPACE_RUN = /\p{White_Space}+/u;
const WHITE_SPACE_CHAR = /^\p{White_Space}$/u;
const APOSTROPHES = /[\u{2018}\u{2019}\u{2BC}\u{B4}`]/gu;
// Control and invisible format characters, as server/src/place_rules.rs `is_forbidden_char`,
// plus lone surrogates (which the server's JSON parser rejects).
const FORBIDDEN_CHARS =
    /[\p{Cc}\u{AD}\u{61C}\u{180E}\u{200B}-\u{200F}\u{2028}-\u{202E}\u{2060}-\u{2064}\u{2066}-\u{206F}\u{FEFF}\u{FFF9}-\u{FFFB}]|\p{Cs}/u;

// Limits of server/src/place_rules.rs.
export const MAX_PLACE_NAME_LEN = 200;
export const MAX_PLATFORM_LEN = 50;
export const MAX_URL_LEN = 2_000;

export const MEMBERS_ONLY_LINK_TEXT = "Link nur für verifizierte Mitglieder";

/** Whether `char` (one UTF-16 unit; all White_Space characters are in the BMP) is white space. */
export const isWhiteSpace = (char: string): boolean => WHITE_SPACE_CHAR.test(char);

/** Like Rust's `str::trim`. A loop, because a `\s+$` style regex backtracks quadratically
 * on long runs of spaces inside the text. */
export const trimWhiteSpace = (value: string): string => {
    let start = 0;
    let end = value.length;
    while (start < end && isWhiteSpace(value[start])) start++;
    while (end > start && isWhiteSpace(value[end - 1])) end--;
    return value.slice(start, end);
};

/** Same normalization as server/src/place_rules.rs `place_name_key` (shared test cases). */
export const placeNameKey = (name: string): string =>
    name
        .normalize("NFC")
        .replace(APOSTROPHES, "'")
        .split(WHITE_SPACE_RUN)
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

/** Without accents and with ss for ß, because AI models often drop or change them. */
export const foldAccents = (text: string): string =>
    text.normalize("NFKD").replace(/\p{M}/gu, "").replace(/ß/g, "ss");

const foldPlaceName = (name: string): string => foldAccents(placeNameKey(name));

/** The stored place with the same name (ignoring case, spacing and apostrophe style). */
export const findPlaceByName = (places: readonly Place[], name: string): Place | null => {
    const key = placeNameKey(name);
    if (!key) return null;
    return places.find((place) => placeNameKey(place.name) === key) ?? null;
};

/** Places indexed once for many lookups (the bulk import resolves up to 50 names on every
 * keystroke). */
export interface PlaceIndex {
    readonly byId: (id: string) => Place | null;
    /** Same name key first; an accent-insensitive match only if it is unambiguous. */
    readonly byName: (name: string) => Place | null;
}

export const indexPlaces = (places: readonly Place[]): PlaceIndex => {
    const byId = new Map(places.map((place) => [place._id, place]));
    const byKey = new Map<string, Place>();
    const byFolded = new Map<string, Place[]>();
    for (const place of places) {
        const key = placeNameKey(place.name);
        if (!byKey.has(key)) byKey.set(key, place);
        const folded = foldPlaceName(place.name);
        byFolded.set(folded, [...(byFolded.get(folded) ?? []), place]);
    }
    return {
        byId: (id) => byId.get(id) ?? null,
        byName: (name) => {
            const key = placeNameKey(name);
            if (!key) return null;
            const exact = byKey.get(key);
            if (exact) return exact;
            const similar = byFolded.get(foldPlaceName(name)) ?? [];
            return similar.length === 1 ? similar[0] : null;
        }
    };
};

/** Code point order of the name keys, the order of the server's place list (MongoDB sorts
 * strings by their UTF-8 bytes, which is code point order). */
export const comparePlaceNames = (a: Place, b: Place): number => {
    const left = [...placeNameKey(a.name)];
    const right = [...placeNameKey(b.name)];
    for (let i = 0; i < Math.min(left.length, right.length); i++) {
        const difference = left[i].codePointAt(0)! - right[i].codePointAt(0)!;
        if (difference !== 0) return difference;
    }
    return left.length - right.length;
};

/** The list with `place` added (unless a place with its id is in it), in server order. */
export const withPlace = (places: readonly Place[], place: Place): Place[] =>
    places.some((known) => known._id === place._id)
        ? [...places]
        : [...places, place].sort(comparePlaceNames);

/** Toast after "Neuen Ort anlegen"; the server returns an existing place of the same name. */
export const placeChosenText = (place: Place, existed: boolean): string =>
    existed ? `Bestehenden Ort „${place.name}“ ausgewählt.` : `Ort „${place.name}“ angelegt.`;

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
export const onlineLabel = (online: Pick<OnlineMeeting, "platform">): string => {
    const platform = trimWhiteSpace(online.platform);
    return platform ? `Online · ${platform}` : "Online";
};

/** Mirrors `PLACE_TO_BE_ANNOUNCED` in server/src/place_rules.rs. */
export const PLACE_TO_BE_ANNOUNCED_TEXT = "Ort wird noch bekanntgegeben";

/** Where a meeting takes place. */
export type MeetingVenue =
    | { readonly kind: "toBeAnnounced" }
    | { readonly kind: "online"; readonly online: OnlineMeeting }
    | { readonly kind: "place"; readonly location: MeetingLocation }
    /** Meetings imported before places and online meetings existed may have neither. */
    | { readonly kind: "unknown" };

/** The stored fields allow combinations saving refuses; this is the one precedence every
 * reader uses, as the server's `Meeting::venue`. */
export const meetingVenue = (
    meeting: Pick<Meeting, "place_to_be_announced" | "online" | "location">
): MeetingVenue => {
    if (meeting.place_to_be_announced) return { kind: "toBeAnnounced" };
    if (meeting.online) return { kind: "online", online: meeting.online };
    if (meeting.location) return { kind: "place", location: meeting.location };
    return { kind: "unknown" };
};

/** Calendar location, same format as the server's iCal feed (`ical_location`). */
export const meetingVenueText = (meeting: Meeting): string => {
    const venue = meetingVenue(meeting);
    switch (venue.kind) {
        case "toBeAnnounced":
            return PLACE_TO_BE_ANNOUNCED_TEXT;
        case "online": {
            const platform = trimWhiteSpace(venue.online.platform);
            const label = platform ? `Online (${platform})` : "Online";
            const url = safeHttpUrl(venue.online.url);
            return url ? `${label}: ${url}` : label;
        }
        case "place":
            return `${venue.location.name}: ${venue.location.lat},${venue.location.lon}`;
        case "unknown":
            return "";
    }
};

export const newOnlineMeeting = (): OnlineMeeting => ({
    platform: "",
    url: null,
    members_only: true,
    url_hidden: false
});

/** The editor's venue boxes. The chosen place stays selected while "online" or "to be
 * announced" is ticked (the server drops it on save). */
export interface VenueChoice {
    readonly meeting: Meeting;
    /** Online details while "online" is unticked, restored when it is ticked again. */
    readonly lastOnline: OnlineMeeting | null;
}

/** Ticking "online" unticks "to be announced". */
export const chooseOnline = (
    { meeting, lastOnline }: VenueChoice,
    online: boolean
): VenueChoice => ({
    lastOnline: meeting.online ?? lastOnline,
    meeting: {
        ...meeting,
        online: online ? (lastOnline ?? newOnlineMeeting()) : null,
        place_to_be_announced: online ? false : meeting.place_to_be_announced
    }
});

/** Ticking "to be announced" unticks "online". */
export const choosePlaceToBeAnnounced = (
    choice: VenueChoice,
    toBeAnnounced: boolean
): VenueChoice => {
    const { meeting, lastOnline } = toBeAnnounced ? chooseOnline(choice, false) : choice;
    return { lastOnline, meeting: { ...meeting, place_to_be_announced: toBeAnnounced } };
};

/** The meeting came with its members-only link withheld and the editor has not loaded or
 * changed it: saving keeps the stored link (server: `keeps_stored_link`). */
export const keepsHiddenLink = (online: OnlineMeeting): boolean =>
    online.url_hidden && online.url === null;

/** Mirror of server/src/place_rules.rs `validate_online` (shared cases in
 * server/src/meeting_validation_cases.json). An empty link counts as no link. */
export const onlineProblem = (online: Pick<OnlineMeeting, "platform" | "url">): string | null => {
    const platform = trimWhiteSpace(online.platform);
    if ([...platform].length > MAX_PLATFORM_LEN) {
        return `Die Plattform ist zu lang (höchstens ${MAX_PLATFORM_LEN} Zeichen).`;
    }
    if (FORBIDDEN_CHARS.test(platform)) return "Die Plattform enthält unzulässige Steuerzeichen.";
    const url = trimWhiteSpace(online.url ?? "");
    if (!url) return null;
    if ([...url].length > MAX_URL_LEN) {
        return `Der Link ist zu lang (höchstens ${MAX_URL_LEN} Zeichen).`;
    }
    const invalid = "Der Link muss mit https:// oder http:// beginnen.";
    let parsed: URL;
    try {
        parsed = new URL(url);
    } catch {
        return invalid;
    }
    // user:pass@ lets "https://zoom.us@evil.example" look like a Zoom link.
    if (
        (parsed.protocol !== "https:" && parsed.protocol !== "http:") ||
        !parsed.hostname ||
        parsed.username ||
        parsed.password
    ) {
        return invalid;
    }
    return null;
};

/** Why the meeting cannot be saved yet, or null. The server checks the same. */
export const venueProblem = (meeting: Meeting): string | null => {
    if (meeting.online && meeting.place_to_be_announced) {
        return `Bitte nur eins angeben: einen Ort, Online-Angaben oder „${PLACE_TO_BE_ANNOUNCED_TEXT}“.`;
    }
    if (meeting.place_to_be_announced) return null;
    if (meeting.online) {
        if (keepsHiddenLink(meeting.online) && !meeting.online.members_only) {
            return "Bitte den gespeicherten Link zuerst anzeigen, bevor er öffentlich gemacht wird.";
        }
        return onlineProblem(meeting.online);
    }
    return meeting.place_id
        ? null
        : `Bitte einen Ort auswählen, „Online-Treffen“ oder „${PLACE_TO_BE_ANNOUNCED_TEXT}“ ankreuzen.`;
};
