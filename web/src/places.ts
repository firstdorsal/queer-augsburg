// Where a meeting takes place: at one of the stored places or a place not fixed yet, online,
// or both (hybrid).

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

/** The online row of the meeting card (below the place for hybrid meetings). */
export const onlineLabel = (online: Pick<OnlineMeeting, "platform">): string => {
    const platform = trimWhiteSpace(online.platform);
    return platform ? `Online · ${platform}` : "Online";
};

/** Mirrors `PLACE_TO_BE_ANNOUNCED` in server/src/place_rules.rs. */
export const PLACE_TO_BE_ANNOUNCED_TEXT = "Ort wird noch bekanntgegeben";

/** The in-person part of a meeting's venue (server: `InPerson`). */
export type InPerson =
    | { readonly kind: "place"; readonly location: MeetingLocation }
    /** A location left over from before is not shown. */
    | { readonly kind: "toBeAnnounced" }
    /** Online only, or an old meeting without a place. */
    | { readonly kind: "noPlace" };

/** Where a meeting takes place; online and in person (a place or one to be announced): a
 * hybrid meeting. Neither: a meeting imported before places and online meetings existed. */
export interface MeetingVenue {
    readonly inPerson: InPerson;
    readonly online: OnlineMeeting | null;
}

/** The stored fields allow combinations saving refuses; this is the one reading every
 * reader uses, as the server's `Meeting::venue`. */
export const meetingVenue = (
    meeting: Pick<Meeting, "place_to_be_announced" | "online" | "location">
): MeetingVenue => ({
    inPerson: meeting.place_to_be_announced
        ? { kind: "toBeAnnounced" }
        : meeting.location
          ? { kind: "place", location: meeting.location }
          : { kind: "noPlace" },
    online: meeting.online
});

/** Between the in-person and the online part of a hybrid meeting's text. Mirrors
 * `VENUE_PARTS_SEPARATOR` in server/src/methods/ical.rs. */
export const VENUE_PARTS_SEPARATOR = " und ";

/** The texts of the parts that exist, joined; "" if none does. */
export const joinVenueParts = (parts: readonly (string | null)[]): string =>
    parts.filter((part): part is string => part !== null).join(VENUE_PARTS_SEPARATOR);

/** The card's in-person row: the place name, the "to be announced" text, "Ort unbekannt"
 * for an old meeting without any venue, or null for online-only meetings. */
export const inPersonLabel = ({ inPerson, online }: MeetingVenue): string | null => {
    switch (inPerson.kind) {
        case "place":
            return inPerson.location.name;
        case "toBeAnnounced":
            return PLACE_TO_BE_ANNOUNCED_TEXT;
        case "noPlace":
            return online ? null : "Ort unbekannt";
    }
};

/** Calendar location, same format as the server's iCal feed (`ical_location`). */
export const meetingVenueText = (meeting: Meeting): string => {
    const { inPerson, online } = meetingVenue(meeting);
    return joinVenueParts([
        inPerson.kind === "place"
            ? `${inPerson.location.name}: ${inPerson.location.lat},${inPerson.location.lon}`
            : inPerson.kind === "toBeAnnounced"
              ? PLACE_TO_BE_ANNOUNCED_TEXT
              : null,
        online && onlineCalendarText(online)
    ]);
};

/** "Online (Zoom): link" as in the iCal feed (server: `online_location`). */
const onlineCalendarText = (online: OnlineMeeting): string => {
    const platform = trimWhiteSpace(online.platform);
    const label = platform ? `Online (${platform})` : "Online";
    const url = safeHttpUrl(online.url);
    return url ? `${label}: ${url}` : label;
};

export const newOnlineMeeting = (): OnlineMeeting => ({
    platform: "",
    url: null,
    members_only: true,
    url_hidden: false
});

export const MEETING_FORMATS = ["onSite", "hybrid", "online"] as const;

/** How a meeting takes place, as chosen in the editor. Not stored: it follows from the
 * venue fields, except that a hybrid meeting whose place is not chosen yet looks like an
 * online one, so the editor keeps the format itself. */
export type MeetingFormat = (typeof MEETING_FORMATS)[number];

export const isMeetingFormat = (value: unknown): value is MeetingFormat =>
    MEETING_FORMATS.some((format) => format === value);

export const MEETING_FORMAT_LABELS: Readonly<Record<MeetingFormat, string>> = {
    onSite: "Vor Ort",
    hybrid: "Hybrid (vor Ort und online)",
    online: "Nur online"
};

/** The format of a stored meeting. A `place_id` counts even without its copied location,
 * because saving keeps it. */
const meetingFormat = (meeting: Meeting): MeetingFormat => {
    const { inPerson, online } = meetingVenue(meeting);
    if (!online) return "onSite";
    return inPerson.kind === "noPlace" && meeting.place_id === null ? "online" : "hybrid";
};

type InPersonFields = Pick<Meeting, "place_id" | "location" | "place_to_be_announced">;

/** The editor's format next to the meeting it edits. The chosen place stays selected while
 * "to be announced" is ticked (the server drops it on save). */
export interface FormatState {
    readonly format: MeetingFormat;
    /** Online details while the meeting is on site only, restored with an online format. */
    readonly lastOnline: OnlineMeeting | null;
    /** The place (or "to be announced") while the meeting is online only, restored with an
     * on-site format. */
    readonly lastInPerson: InPersonFields | null;
}

export const initialFormatState = (meeting: Meeting): FormatState => ({
    format: meetingFormat(meeting),
    lastOnline: null,
    lastInPerson: null
});

const NO_IN_PERSON: InPersonFields = {
    place_id: null,
    location: null,
    place_to_be_announced: false
};

/** Switching to "online only" removes the place; it comes back when switching back. What
 * the current format shows is remembered as it is, also when it is empty. */
export const chooseFormat = (
    meeting: Meeting,
    state: FormatState,
    format: MeetingFormat
): { readonly meeting: Meeting; readonly state: FormatState } => {
    const lastOnline = state.format === "onSite" ? state.lastOnline : meeting.online;
    const lastInPerson: InPersonFields | null =
        state.format === "online"
            ? state.lastInPerson
            : {
                  place_id: meeting.place_id,
                  location: meeting.location,
                  place_to_be_announced: meeting.place_to_be_announced
              };
    return {
        state: { format, lastOnline, lastInPerson },
        meeting: {
            ...meeting,
            ...(format === "online" ? NO_IN_PERSON : (lastInPerson ?? NO_IN_PERSON)),
            online: format === "onSite" ? null : (lastOnline ?? newOnlineMeeting())
        }
    };
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

/** Why the meeting cannot be saved yet, or null. The server checks the same in the same
 * order (`finish_venue`), except that it cannot tell a hybrid meeting without a place from
 * an online one. */
export const venueProblem = (meeting: Meeting, format: MeetingFormat): string | null => {
    if (meeting.online) {
        if (keepsHiddenLink(meeting.online) && !meeting.online.members_only) {
            return "Bitte den gespeicherten Link zuerst anzeigen, bevor er öffentlich gemacht wird.";
        }
        const problem = onlineProblem(meeting.online);
        if (problem) return problem;
    }
    if (format === "online" || meeting.place_to_be_announced || meeting.place_id) return null;
    return `Bitte einen Ort auswählen oder „${PLACE_TO_BE_ANNOUNCED_TEXT}“ ankreuzen.`;
};
