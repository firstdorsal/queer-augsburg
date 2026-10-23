// Bulk creation of meetings from JSON that a member produced with their own AI model.
// The import format is deliberately simpler than `NewMeeting` (local time string, place
// name instead of a place id) because a language model writes it. Places are never
// created from the JSON: a name resolves to a stored place, or the member picks or creates
// one in the dialog.

import type { CommonMeetingTag } from "./apiTypes/CommonMeetingTag";
import type { Meeting } from "./apiTypes/Meeting";
import type { NewMeeting } from "./apiTypes/NewMeeting";
import type { NewOnlineMeeting } from "./apiTypes/NewOnlineMeeting";
import type { Place } from "./apiTypes/Place";
import type { QueerMeetingTag } from "./apiTypes/QueerMeetingTag";
import { DAY_MS, HOUR_MS, berlinOffsetMs, pad } from "./berlinTime";
import { defaultMeetingContent } from "./meetingDefaults";
import {
    MeetingCandidate,
    comparableMeetings,
    duplicateWarning,
    possibleDuplicates,
    similarMeetings
} from "./meetingDuplicates";
import {
    MEMBERS_ONLY_LINK_TEXT,
    PLACE_TO_BE_ANNOUNCED_TEXT,
    PlaceIndex,
    indexPlaces,
    isWhiteSpace,
    joinVenueParts,
    onlineProblem,
    placeNameKey,
    trimWhiteSpace
} from "./places";
import { commonTags, queerTags } from "./types";

// Limits, rule order and messages mirror server/src/meeting_validation.rs (content) and
// server/src/place_rules.rs (the venue: a place or "to be announced", online details, or
// both; online details via `onlineProblem` in places.ts).
// Both test suites run server/src/meeting_validation_cases.json, so drift between the two
// fails the tests.
export const MAX_MEETINGS_PER_BATCH = 50;
export const MAX_TITLE_LEN = 200;
const MAX_AUTHORITY_LEN = 200;
export const MAX_DESCRIPTION_LEN = 20_000;
const MAX_NOTE_LEN = 2_000;
export const MAX_FREEFORM_TAGS = 20;
export const MAX_FREEFORM_TAG_LEN = 50;
const MAX_PRICE = 10_000;
const MIN_TIME_MS = Date.UTC(2000, 0, 1);
const MAX_TIME_MS = Date.UTC(2100, 0, 1);

export const IMPORT_FIELDS: ReadonlySet<string> = new Set([
    "title",
    "start",
    "place",
    "online",
    "place_to_be_announced",
    "description",
    "authority",
    "common_tags",
    "queer_tags",
    "freeform_tags",
    "price",
    "age_restriction",
    "accessibility",
    "trigger_warning"
]);

export const ONLINE_FIELDS: ReadonlySet<string> = new Set(["platform", "link", "link_public"]);

/** A `NewMeeting` whose start and place may still be unknown. Valid drafts have a `place` or
 * `place_to_be_announced` (not both), `online` details, or online details and one of the two
 * (see `draftVenue`). */
export type DraftFields = Omit<NewMeeting, "time" | "place_id"> & {
    time: number | null;
    place: Place | null;
};

export interface BulkDraft {
    /** Stays the same while the JSON is edited, as long as title, start and venue do not
     * change; the member's "Nicht anlegen" is keyed by it. */
    readonly id: string;
    readonly fields: DraftFields;
    /** The place name as written in the JSON ("" if there is none), also the key for the
     * member's place pick. */
    readonly placeName: string;
    /** Problems that block creating this meeting. */
    readonly errors: readonly string[];
    /** Hints that do not block creating it. */
    readonly warnings: readonly string[];
}

export type BulkParseResult =
    | { readonly ok: true; readonly drafts: BulkDraft[] }
    | { readonly ok: false; readonly error: string };

/** Place ids the member chose, keyed by `placeNameKey` of the JSON place name. */
export type PlacePicks = Readonly<Record<string, string>>;

export interface BulkParseContext {
    readonly places: readonly Place[];
    readonly picks: PlacePicks;
    /** Stored meetings (active and planned) the drafts are checked against. */
    readonly existing: readonly Meeting[];
    /** Reference time for the past/future warnings. */
    readonly now: number;
}

// Europe/Berlin is always UTC+1 (CET) or UTC+2 (CEST). Checking both candidates finds
// times that do not exist (spring gap) or exist twice (autumn overlap).
const BERLIN_OFFSETS_MS = [HOUR_MS, 2 * HOUR_MS];

export type StartParseResult =
    | { readonly ok: true; readonly time: number }
    | { readonly ok: false; readonly error: string };

const START_PATTERN = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::00)?$/;

/** Parses "YYYY-MM-DDTHH:MM" as Europe/Berlin time into a UTC timestamp. */
export const parseBerlinStart = (value: string): StartParseResult => {
    const match = START_PATTERN.exec(value.trim());
    if (!match) {
        return {
            ok: false,
            error: `"start" hat nicht das Format JJJJ-MM-TTTHH:MM (z. B. 2026-10-27T19:00): "${value}".`
        };
    }
    const [year, month, day, hour, minute] = match.slice(1).map(Number);
    // Date.UTC maps years 0–99 to 1900–1999 and rolls 2026-02-30 over into March.
    const date = new Date(Date.UTC(2000, month - 1, day));
    date.setUTCFullYear(year);
    if (
        year < 2000 ||
        year > 2099 ||
        hour > 23 ||
        minute > 59 ||
        date.getUTCMonth() !== month - 1 ||
        date.getUTCDate() !== day
    ) {
        return { ok: false, error: `"start" ist kein gültiger Zeitpunkt: "${value}".` };
    }

    const wallAsUtc = Date.UTC(year, month - 1, day, hour, minute);
    const candidates = BERLIN_OFFSETS_MS.map((offset) => wallAsUtc - offset).filter(
        (utc) => berlinOffsetMs(utc) === wallAsUtc - utc
    );
    const when = `${pad(hour)}:${pad(minute)} Uhr am ${pad(day)}.${pad(month)}.${year}`;
    if (candidates.length === 0) {
        return { ok: false, error: `${when} gibt es wegen der Zeitumstellung nicht.` };
    }
    if (candidates.length > 1) {
        return {
            ok: false,
            error: `${when} gibt es wegen der Zeitumstellung zweimal, bitte eine andere Uhrzeit wählen.`
        };
    }
    return { ok: true, time: candidates[0] };
};

// ---------------------------------------------------------------------------------------
// Validation (mirror of server/src/meeting_validation.rs)

/** A JSON value of the wrong type suppresses the messages that would follow from it:
 * "placeFields" (a wrong "place" or "place_to_be_announced") the messages about the place,
 * "anyVenueField" (also a wrong "online") the message that no venue was given. */
type InputField = "title" | "time" | "placeFields" | "anyVenueField";

interface ValidationProblem {
    readonly field: InputField | null;
    readonly message: string;
}

const ZERO_WIDTH_CHARS: ReadonlySet<string> = new Set([
    "\u{200B}",
    "\u{200C}",
    "\u{200D}",
    "\u{2060}",
    "\u{FEFF}"
]);
// Control characters, bidi overrides/isolates, and lone surrogates (which serde rejects).
const FORBIDDEN_IN_LINE = /[\0-\x1F\x7F-\x9F\u{202A}-\u{202E}\u{2066}-\u{2069}]|\p{Cs}/u;
const FORBIDDEN_IN_DESCRIPTION =
    /[\0-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F\u{202A}-\u{202E}\u{2066}-\u{2069}]|\p{Cs}/u;

const charCount = (value: string) => [...value].length;
const isBlank = (value: string) =>
    [...value].every((char) => isWhiteSpace(char) || ZERO_WIDTH_CHARS.has(char));

const lineProblem = (
    label: string,
    value: string,
    maxLen: number,
    required: boolean
): string | null => {
    if (required && isBlank(value)) return `${label} fehlt.`;
    if (charCount(value) > maxLen) return `${label} ist zu lang (höchstens ${maxLen} Zeichen).`;
    if (FORBIDDEN_IN_LINE.test(value)) return `${label} enthält unzulässige Steuerzeichen.`;
    return null;
};

const hasDuplicates = (items: readonly string[]) => new Set(items).size !== items.length;

/**
 * All rule violations, in the order the server checks them (batch validation, then the
 * venue), so the first entry equals the server's error. `time`/`place`
 * may be null for drafts; `placeName` is the unresolved name from the JSON.
 */
export const validateFields = (fields: DraftFields, placeName: string): ValidationProblem[] => {
    const problems: ValidationProblem[] = [];
    const add = (field: InputField | null, message: string | null) => {
        if (message !== null) problems.push({ field, message });
    };

    add("title", lineProblem("Titel", fields.title, MAX_TITLE_LEN, true));
    add(null, lineProblem("Ansprechpersonen", fields.authority, MAX_AUTHORITY_LEN, false));
    if (charCount(fields.description) > MAX_DESCRIPTION_LEN) {
        add(null, `Beschreibung ist zu lang (höchstens ${MAX_DESCRIPTION_LEN} Zeichen).`);
    } else if (FORBIDDEN_IN_DESCRIPTION.test(fields.description)) {
        add(null, "Beschreibung enthält unzulässige Steuerzeichen.");
    }

    if (fields.time === null) add("time", "Zeit fehlt.");
    else if (!(fields.time >= MIN_TIME_MS && fields.time < MAX_TIME_MS)) {
        add(null, "Zeit liegt außerhalb des gültigen Bereichs.");
    }

    const price = fields.price;
    if (price.length < 1 || price.length > 2) {
        add(null, "Preis muss aus einem oder zwei Werten bestehen.");
    } else if (price.some((value) => !(value >= 0 && value <= MAX_PRICE))) {
        add(null, "Preis ist ungültig.");
    } else if (price.length === 2 && price[0] > price[1]) {
        add(null, 'Preis: "von" ist größer als "bis".');
    }

    const age = fields.age_restriction;
    if (age.length > 2) add(null, "Altersbeschränkung darf höchstens zwei Werte haben.");
    else if (age.length === 2 && age[0] > age[1]) {
        add(null, 'Altersbeschränkung: "von" ist größer als "bis".');
    }

    if (fields.trigger_warning !== null) {
        add(null, lineProblem("Triggerwarnung", fields.trigger_warning, MAX_NOTE_LEN, false));
    }
    if (fields.accessibility !== null) {
        add(null, lineProblem("Barrierefreiheit", fields.accessibility, MAX_NOTE_LEN, false));
    }

    const tags = fields.tags;
    if (tags.freeform.length > MAX_FREEFORM_TAGS) {
        add(null, `Höchstens ${MAX_FREEFORM_TAGS} eigene Tags erlaubt.`);
    }
    for (const tag of tags.freeform) {
        add(null, lineProblem("Eigener Tag", tag, MAX_FREEFORM_TAG_LEN, true));
    }
    if (hasDuplicates(tags.freeform) || hasDuplicates(tags.common) || hasDuplicates(tags.queer)) {
        add(null, "Tags dürfen nicht doppelt vorkommen.");
    }

    // The server's order: a place next to "to be announced", the online details, the place.
    const { inPerson, online } = draftVenue(fields, placeName);
    if (inPerson.kind === "placeAndToBeAnnounced") {
        add("placeFields", 'Nur eins angeben: "place" oder "place_to_be_announced".');
    }
    if (online) add(null, onlineProblem(online));
    if (inPerson.kind === "place" && inPerson.place === null) {
        if (isBlank(placeName)) add("anyVenueField", "Ort fehlt.");
        else {
            add(
                "placeFields",
                `Den Ort „${placeName}“ gibt es noch nicht: bestehenden Ort auswählen oder neu anlegen.`
            );
        }
    }

    return problems;
};

/** The in-person part of a draft's venue. */
export type DraftInPerson =
    /** `place` is null while the name is unknown or missing. */
    | { readonly kind: "place"; readonly place: Place | null; readonly placeName: string }
    | { readonly kind: "toBeAnnounced" }
    /** Online only. */
    | { readonly kind: "noPlace" }
    /** An error (meeting_validation.rs `resolve_venue`). */
    | { readonly kind: "placeAndToBeAnnounced" };

/** Online details and the in-person part: both for a hybrid meeting. */
export interface DraftVenue {
    readonly inPerson: DraftInPerson;
    readonly online: NewOnlineMeeting | null;
}

/** A draft without any venue counts as a place still missing. */
export const draftVenue = (fields: DraftFields, placeName: string): DraftVenue => ({
    inPerson: draftInPerson(fields, placeName),
    online: fields.online
});

const draftInPerson = (fields: DraftFields, placeName: string): DraftInPerson => {
    const hasPlaceName = fields.place !== null || !isBlank(placeName);
    if (hasPlaceName && fields.place_to_be_announced) return { kind: "placeAndToBeAnnounced" };
    if (fields.place_to_be_announced) return { kind: "toBeAnnounced" };
    if (!hasPlaceName && fields.online !== null) return { kind: "noPlace" };
    return { kind: "place", place: fields.place, placeName };
};

/** Where the draft takes place, for the review list. */
export const draftVenueText = (fields: DraftFields, placeName: string): string => {
    const { inPerson, online } = draftVenue(fields, placeName);
    return joinVenueParts([
        draftInPersonText(inPerson),
        online && draftOnlineText(online, inPerson.kind === "noPlace")
    ]);
};

const draftInPersonText = (inPerson: DraftInPerson): string | null => {
    switch (inPerson.kind) {
        case "place":
            return inPerson.place?.name || inPerson.placeName || "Ort fehlt";
        case "toBeAnnounced":
            return PLACE_TO_BE_ANNOUNCED_TEXT;
        case "noPlace":
            return null;
        case "placeAndToBeAnnounced":
            // The error below the draft says what to fix.
            return "Mehrere Angaben zum Ort";
    }
};

/** "Nur online" makes a forgotten place of a hybrid meeting visible. */
const draftOnlineText = (online: NewOnlineMeeting, onlineOnly: boolean): string => {
    const label = onlineOnly ? "Nur online" : "Online";
    const platform = trimWhiteSpace(online.platform);
    const link =
        online.url === null
            ? "noch ohne Link"
            : online.members_only
              ? MEMBERS_ONLY_LINK_TEXT
              : "Link öffentlich";
    return [label, ...(platform ? [platform] : []), link].join(" · ");
};

/** The meeting ready to send, or null while the draft has errors. */
export const toNewMeeting = (draft: BulkDraft): NewMeeting | null => {
    const { time, place: _place, ...fields } = draft.fields;
    if (draft.errors.length > 0 || time === null) return null;
    const { inPerson } = draftVenue(draft.fields, draft.placeName);
    switch (inPerson.kind) {
        case "placeAndToBeAnnounced":
            return null;
        case "place":
            return inPerson.place === null
                ? null
                : { ...fields, time, place_id: inPerson.place._id };
        case "toBeAnnounced":
        case "noPlace":
            return { ...fields, time, place_id: null };
    }
};

// ---------------------------------------------------------------------------------------
// Reading the JSON

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === "object" && value !== null && !Array.isArray(value);
const isStringArray = (value: unknown): value is string[] =>
    Array.isArray(value) && value.every((item) => typeof item === "string");
const isNumberArray = (value: unknown): value is number[] =>
    Array.isArray(value) && value.every((item) => typeof item === "number");

const INVALID = Symbol("invalid");
type Read<T> = T | undefined | typeof INVALID;

/** `undefined` for absent/null, `INVALID` (with an error pushed) for a wrong type. */
const readString = (
    entry: Record<string, unknown>,
    key: string,
    errors: string[],
    label = key
): Read<string> => {
    const value = entry[key];
    if (value === undefined || value === null) return undefined;
    if (typeof value === "string") return value;
    errors.push(`"${label}" muss ein Text sein.`);
    return INVALID;
};

const readBoolean = (
    entry: Record<string, unknown>,
    key: string,
    errors: string[],
    label = key
): Read<boolean> => {
    const value = entry[key];
    if (value === undefined || value === null) return undefined;
    if (typeof value === "boolean") return value;
    errors.push(`"${label}" muss true oder false sein.`);
    return INVALID;
};

const readStringArray = (
    entry: Record<string, unknown>,
    key: string,
    errors: string[]
): string[] | undefined => {
    const value = entry[key];
    if (value === undefined || value === null) return undefined;
    if (isStringArray(value)) return value;
    errors.push(`"${key}" muss eine Liste von Texten sein.`);
    return undefined;
};

const readNumberArray = (
    entry: Record<string, unknown>,
    key: string,
    errors: string[],
    isAllowed: (value: number) => boolean,
    description: string
): number[] | undefined => {
    const value = entry[key];
    if (value === undefined || value === null) return undefined;
    if (isNumberArray(value) && value.every(isAllowed)) return value;
    errors.push(`"${key}" muss eine Liste ${description} sein.`);
    return undefined;
};

const mapTags = <T extends string>(
    values: readonly string[],
    allowed: readonly T[],
    label: string,
    errors: string[]
): T[] =>
    values.flatMap((value) => {
        const match = allowed.find((tag) => tag.toLowerCase() === value.trim().toLowerCase());
        if (match) return [match];
        errors.push(`Unbekannte ${label} "${value}".`);
        return [];
    });

const emptyFields = (): DraftFields => ({
    ...defaultMeetingContent(),
    title: "",
    time: null,
    place: null,
    online: null,
    place_to_be_announced: false
});

/** The member's pick for this name, else the stored place of that name. A pick whose place
 * is no longer in the list leaves the place unresolved, so the member chooses again. */
const resolvePlace = (placeName: string, picks: PlacePicks, places: PlaceIndex): Place | null => {
    if (!placeName) return null;
    const pickedId = picks[placeNameKey(placeName)];
    return pickedId === undefined ? places.byName(placeName) : places.byId(pickedId);
};

/**
 * `"online": {"platform", "link", "link_public"}`. Links are members-only unless
 * `link_public` is true. `true`/`false` are accepted too, because models write flags.
 */
const readOnline = (
    entry: Record<string, unknown>,
    errors: string[],
    warnings: string[]
): Read<NewOnlineMeeting> => {
    const value = entry.online;
    if (value === undefined || value === null || value === false) return undefined;
    const details = value === true ? {} : value;
    if (!isRecord(details)) {
        errors.push('"online" muss ein Objekt sein, z. B. {"platform": "Zoom"}.');
        return INVALID;
    }
    for (const key of Object.keys(details)) {
        if (!ONLINE_FIELDS.has(key)) {
            warnings.push(`Feld "online.${key}" wird nicht unterstützt und ignoriert.`);
        }
    }
    const problems: string[] = [];
    const platform = readString(details, "platform", problems, "online.platform");
    const link = readString(details, "link", problems, "online.link");
    const linkPublic = readBoolean(details, "link_public", problems, "online.link_public");
    if (problems.length > 0) {
        errors.push(...problems);
        return INVALID;
    }
    const url = typeof link === "string" ? trimWhiteSpace(link) : "";
    return {
        platform: typeof platform === "string" ? trimWhiteSpace(platform) : "",
        url: url || null,
        members_only: linkPublic !== true
    };
};

/** A members-only link that the AI also wrote into the public title or description. */
const linkInPublicText = (fields: DraftFields): boolean => {
    const url = fields.online?.members_only ? fields.online.url : null;
    if (!url) return false;
    const withoutScheme = url.replace(/^https?:\/\//i, "").toLowerCase();
    return [fields.title, fields.description].some((text) =>
        text.toLowerCase().includes(withoutScheme)
    );
};

type ParsedEntry = Omit<BulkDraft, "id">;

const convertEntry = (
    entry: unknown,
    context: BulkParseContext,
    places: PlaceIndex
): ParsedEntry => {
    const fields = emptyFields();
    if (!isRecord(entry)) {
        return { fields, placeName: "", errors: ["Eintrag ist kein JSON-Objekt."], warnings: [] };
    }

    const errors: string[] = [];
    const warnings: string[] = [];
    const invalidInputs = new Set<InputField>();

    for (const key of Object.keys(entry)) {
        if (!IMPORT_FIELDS.has(key))
            warnings.push(`Feld "${key}" wird nicht unterstützt und ignoriert.`);
    }

    // String.prototype.trim also strips U+FEFF (Rust's trim does not); harmless here, because
    // the trimmed text is what is sent.
    const title = readString(entry, "title", errors);
    if (title === INVALID) invalidInputs.add("title");
    else fields.title = title?.trim() ?? "";

    const description = readString(entry, "description", errors);
    if (typeof description === "string") fields.description = description;
    const authority = readString(entry, "authority", errors);
    if (typeof authority === "string") fields.authority = authority.trim();
    const accessibility = readString(entry, "accessibility", errors);
    if (typeof accessibility === "string") fields.accessibility = accessibility.trim() || null;
    const triggerWarning = readString(entry, "trigger_warning", errors);
    if (typeof triggerWarning === "string") fields.trigger_warning = triggerWarning.trim() || null;

    const start = readString(entry, "start", errors);
    if (start === INVALID) invalidInputs.add("time");
    else if (start !== undefined) {
        const parsed = parseBerlinStart(start);
        if (parsed.ok) fields.time = parsed.time;
        else {
            errors.push(parsed.error);
            invalidInputs.add("time");
        }
    }

    const place = readString(entry, "place", errors);
    const online = readOnline(entry, errors, warnings);
    const toBeAnnounced = readBoolean(entry, "place_to_be_announced", errors);
    const placeName = typeof place === "string" ? place.trim() : "";
    if (place === INVALID || toBeAnnounced === INVALID) invalidInputs.add("placeFields");
    if (place === INVALID || online === INVALID || toBeAnnounced === INVALID) {
        invalidInputs.add("anyVenueField");
    }
    if (online !== INVALID && online !== undefined) fields.online = online;
    fields.place_to_be_announced = toBeAnnounced === true;
    fields.place = resolvePlace(placeName, context.picks, places);

    const common = readStringArray(entry, "common_tags", errors);
    if (common) {
        fields.tags.common = mapTags<CommonMeetingTag>(
            common,
            commonTags,
            "Art der Veranstaltung",
            errors
        );
    }
    const queer = readStringArray(entry, "queer_tags", errors);
    if (queer) fields.tags.queer = mapTags<QueerMeetingTag>(queer, queerTags, "Gruppe", errors);
    const freeform = readStringArray(entry, "freeform_tags", errors);
    if (freeform) fields.tags.freeform = freeform.map((tag) => tag.trim());

    const price = readNumberArray(
        entry,
        "price",
        errors,
        (value) => Number.isFinite(value),
        "von Zahlen"
    );
    if (price) fields.price = price;
    const age = readNumberArray(
        entry,
        "age_restriction",
        errors,
        (value) => Number.isInteger(value) && value >= 0 && value <= 255,
        "ganzer Zahlen (0–255)"
    );
    if (age) fields.age_restriction = age;

    if (fields.time !== null && fields.time < context.now) {
        warnings.push("Beginn liegt in der Vergangenheit.");
    } else if (fields.time !== null && fields.time > context.now + 366 * DAY_MS) {
        warnings.push("Beginn liegt mehr als ein Jahr in der Zukunft.");
    }
    if (linkInPublicText(fields)) {
        warnings.push(
            "Der Link steht auch im Titel oder in der Beschreibung und wäre dort öffentlich sichtbar."
        );
    }

    const ruleErrors = validateFields(fields, placeName)
        .filter((problem) => problem.field === null || !invalidInputs.has(problem.field))
        .map((problem) => problem.message);

    return {
        fields,
        placeName,
        errors: [...new Set([...errors, ...ruleErrors])],
        warnings
    };
};

/** Candidate texts in the order an AI answer most likely contains the JSON. */
const jsonCandidates = (text: string): string[] => {
    const candidates = [text.trim()];
    const fences = [...text.matchAll(/```([^\n`]*)\n([\s\S]*?)```/g)];
    const isJsonFence = (label: string) => label.trim().toLowerCase() === "json";
    candidates.push(
        ...fences.filter((fence) => isJsonFence(fence[1])).map((fence) => fence[2]),
        ...fences.filter((fence) => !isJsonFence(fence[1])).map((fence) => fence[2])
    );
    // Balanced top-level [...] / {...} ranges in prose, respecting string literals.
    let depth = 0;
    let begin = -1;
    let inString = false;
    for (let i = 0; i < text.length; i++) {
        const char = text[i];
        if (inString) {
            if (char === "\\") i++;
            else if (char === '"') inString = false;
        } else if (char === '"' && depth > 0) inString = true;
        else if (char === "[" || char === "{") {
            if (depth === 0) begin = i;
            depth++;
        } else if ((char === "]" || char === "}") && depth > 0) {
            depth--;
            if (depth === 0) candidates.push(text.slice(begin, i + 1));
        }
    }
    return candidates;
};

type JsonExtraction =
    | { readonly ok: true; readonly entries: unknown[] }
    | { readonly ok: false; readonly error: string };

const extractEntries = (text: string): JsonExtraction => {
    let firstError: string | null = null;
    // Prose like "(siehe [1])" also parses; such lists are only used if nothing better exists.
    let withoutObjects: unknown[] | null = null;
    for (const candidate of jsonCandidates(text)) {
        let value: unknown;
        try {
            value = JSON.parse(candidate);
        } catch (error) {
            firstError ??= error instanceof Error ? error.message : String(error);
            continue;
        }
        // Models sometimes wrap the list: {"meetings": [...]}.
        const entries = isRecord(value)
            ? Array.isArray(value.meetings)
                ? value.meetings
                : [value]
            : Array.isArray(value)
              ? value
              : null;
        if (entries === null) continue;
        if (entries.length === 0 || entries.some(isRecord)) return { ok: true, entries };
        withoutObjects ??= entries;
    }
    if (withoutObjects !== null) return { ok: true, entries: withoutObjects };
    return {
        ok: false,
        error:
            "Kein gültiges JSON gefunden. Bitte die KI bitten, nur den JSON-Codeblock noch einmal zu senden." +
            (firstError ? ` (Fehler: ${firstError})` : "")
    };
};

export const parseBulkJson = (text: string, context: BulkParseContext): BulkParseResult => {
    if (!text.trim()) return { ok: false, error: "Bitte JSON einfügen." };

    const extraction = extractEntries(text);
    if (!extraction.ok) return extraction;
    const entries = extraction.entries;
    if (entries.length === 0) return { ok: false, error: "Die Liste enthält keine Treffen." };
    if (entries.length > MAX_MEETINGS_PER_BATCH) {
        return {
            ok: false,
            error: `Es können höchstens ${MAX_MEETINGS_PER_BATCH} Treffen auf einmal angelegt werden (eingefügt: ${entries.length}). Bitte in mehrere Teile aufteilen.`
        };
    }

    const places = indexPlaces(context.places);
    const stored = comparableMeetings(context.existing);
    const parsed = entries.map((entry) => convertEntry(entry, context, places));
    const occurrences = new Map<string, number>();
    const drafts: BulkDraft[] = [];
    for (const [index, draft] of parsed.entries()) {
        const key = draftKey(draft);
        const occurrence = occurrences.get(key) ?? 0;
        occurrences.set(key, occurrence + 1);
        const candidate = draftCandidate(draft);
        const earlier =
            candidate === null
                ? -1
                : parsed.findIndex((other, otherIndex) => {
                      const otherCandidate = otherIndex < index ? draftCandidate(other) : null;
                      return otherCandidate !== null && similarMeetings(candidate, otherCandidate);
                  });
        const warnings = [
            ...draft.warnings,
            ...(earlier === -1
                ? []
                : [
                      draftKey(parsed[earlier]) === key
                          ? `Gleiches Treffen wie Treffen ${earlier + 1}.`
                          : `Ähnlich wie Treffen ${earlier + 1}.`
                  ]),
            ...(candidate === null ? [] : possibleDuplicates(candidate, stored)).map(
                duplicateWarning
            )
        ];
        drafts.push({ ...draft, id: `${key}#${occurrence}`, warnings });
    }
    return { ok: true, drafts };
};

const venueKey = ({ inPerson, online }: DraftVenue): string =>
    JSON.stringify([
        inPerson.kind,
        inPerson.kind === "place"
            ? (inPerson.place?._id ?? placeNameKey(inPerson.placeName))
            : null,
        online && [online.platform, online.url]
    ]);

/** Title, start and venue: equal keys are the same meeting. */
const draftKey = ({ fields, placeName }: ParsedEntry): string =>
    `${fields.title.toLowerCase()}|${fields.time}|${venueKey(draftVenue(fields, placeName))}`;

const draftCandidate = ({ fields, placeName }: ParsedEntry): MeetingCandidate | null => {
    if (fields.time === null) return null;
    const { inPerson, online } = draftVenue(fields, placeName);
    // A place to be announced is no place to compare.
    const place = inPerson.kind === "place" ? inPerson : null;
    return {
        title: fields.title,
        time: fields.time,
        placeId: place?.place?._id ?? null,
        placeName: place ? (place.place?.name ?? (place.placeName || null)) : null,
        onlinePlatform: online?.platform ?? null
    };
};

/** The drafts to create: all except those the member left out ("Nicht anlegen"). */
export const includedDrafts = (
    drafts: readonly BulkDraft[],
    leftOut: ReadonlySet<string>
): BulkDraft[] => drafts.filter((draft) => !leftOut.has(draft.id));
