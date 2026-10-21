// Bulk creation of meetings from JSON that a member produced with their own AI model.
// The import format is deliberately simpler than `NewMeeting` (local time string, place
// name instead of coordinates) because a language model writes it. Coordinates are never
// taken from the JSON: they come from known places or from the member's own pick.

import type { CommonMeetingTag } from "./apiTypes/CommonMeetingTag";
import type { MeetingLocation } from "./apiTypes/MeetingLocation";
import type { MeetingStatus } from "./apiTypes/MeetingStatus";
import type { NewMeeting } from "./apiTypes/NewMeeting";
import type { QueerMeetingTag } from "./apiTypes/QueerMeetingTag";
import { defaultMeetingContent } from "./meetingDefaults";
import { commonTags, queerTags } from "./types";
import type { Place } from "./utils";

// Limits, rule order and messages mirror server/src/meeting_validation.rs. Both test suites
// run server/src/meeting_validation_cases.json, so drift between the two fails the tests.
export const MAX_MEETINGS_PER_BATCH = 50;
const MAX_TITLE_LEN = 200;
const MAX_AUTHORITY_LEN = 200;
const MAX_DESCRIPTION_LEN = 20_000;
const MAX_LOCATION_NAME_LEN = 200;
const MAX_NOTE_LEN = 2_000;
const MAX_FREEFORM_TAGS = 20;
const MAX_FREEFORM_TAG_LEN = 50;
const MAX_PRICE = 10_000;
const MIN_TIME_MS = Date.UTC(2000, 0, 1);
const MAX_TIME_MS = Date.UTC(2100, 0, 1);

export const TIME_ZONE = "Europe/Berlin";
const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;

const IMPORT_FIELDS: ReadonlySet<string> = new Set([
    "title",
    "start",
    "place",
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

/** A `NewMeeting` whose start and location may still be unknown. */
export type DraftFields = Omit<NewMeeting, "time" | "location"> & {
    time: number | null;
    location: MeetingLocation | null;
};

export interface BulkDraft {
    readonly fields: DraftFields;
    /** The place name as written in the JSON, also the key for the member's place pick. */
    readonly placeName: string;
    /** Problems that block creating this meeting. */
    readonly errors: readonly string[];
    /** Hints that do not block creating it. */
    readonly warnings: readonly string[];
}

export type BulkParseResult =
    | { readonly ok: true; readonly drafts: BulkDraft[] }
    | { readonly ok: false; readonly error: string };

/** Locations the member chose, keyed by `normalizePlaceName` of the JSON place name. */
export type PlacePicks = Readonly<Record<string, MeetingLocation>>;

export interface BulkParseContext {
    readonly places: readonly Place[];
    readonly picks: PlacePicks;
    readonly status: MeetingStatus;
    /** Reference time for the past/future warnings. */
    readonly now: number;
}

// ---------------------------------------------------------------------------------------
// Europe/Berlin wall-clock time, independent of the browser's time zone

const berlinParts = new Intl.DateTimeFormat("en-US", {
    timeZone: TIME_ZONE,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
});

interface WallClock {
    readonly year: number;
    readonly month: number;
    readonly day: number;
    readonly hour: number;
    readonly minute: number;
    readonly second: number;
}

const berlinWallClock = (utcMs: number): WallClock => {
    const parts = berlinParts.formatToParts(new Date(utcMs));
    const part = (type: Intl.DateTimeFormatPartTypes) => {
        const value = parts.find((candidate) => candidate.type === type)?.value;
        if (value === undefined) throw new Error(`Intl.DateTimeFormat returned no ${type}`);
        return Number(value);
    };
    return {
        year: part("year"),
        month: part("month"),
        day: part("day"),
        hour: part("hour"),
        minute: part("minute"),
        second: part("second")
    };
};

const berlinOffsetMs = (utcMs: number): number => {
    const wall = berlinWallClock(utcMs);
    const wallAsUtc = Date.UTC(
        wall.year,
        wall.month - 1,
        wall.day,
        wall.hour,
        wall.minute,
        wall.second
    );
    return wallAsUtc - Math.floor(utcMs / 1000) * 1000;
};

// Europe/Berlin is always UTC+1 (CET) or UTC+2 (CEST). Checking both candidates finds
// times that do not exist (spring gap) or exist twice (autumn overlap).
const BERLIN_OFFSETS_MS = [HOUR_MS, 2 * HOUR_MS];

const pad = (value: number) => String(value).padStart(2, "0");

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
// Places

/** Key for comparing place names: Unicode-normalized, whitespace-collapsed, lower case. */
export const normalizePlaceName = (name: string): string =>
    name.normalize("NFC").trim().replace(/\s+/g, " ").toLocaleLowerCase("de");

/** Additionally ignores accents and ß/ss, because AI models often drop or change them. */
const foldPlaceName = (name: string): string =>
    normalizePlaceName(name).normalize("NFD").replace(/\p{M}/gu, "").replace(/ß/g, "ss");

/** Exact (normalized) match first; an accent-insensitive match only if it is unambiguous. */
export const findPlace = (name: string, places: readonly Place[]): Place | null => {
    const wanted = normalizePlaceName(name);
    if (!wanted) return null;
    const exact = places.find((place) => normalizePlaceName(place.name) === wanted);
    if (exact) return exact;
    const folded = foldPlaceName(name);
    const similar = places.filter((place) => foldPlaceName(place.name) === folded);
    return similar.length === 1 ? similar[0] : null;
};

/** Places from past meetings first, then builtin places not already covered. */
export const mergeKnownPlaces = (fromMeetings: readonly Place[], builtin: readonly Place[]) => {
    const seen = new Set(fromMeetings.map((place) => normalizePlaceName(place.name)));
    return [
        ...fromMeetings,
        ...builtin.filter((place) => !seen.has(normalizePlaceName(place.name)))
    ];
};

// ---------------------------------------------------------------------------------------
// Validation (mirror of server/src/meeting_validation.rs)

/** Fields whose "missing" message is suppressed when the JSON value had the wrong type. */
type InputField = "title" | "time" | "place";

interface ValidationProblem {
    readonly field: InputField | null;
    readonly message: string;
}

// Rust's char::is_whitespace includes U+0085, JavaScript's \s does not.
const WHITESPACE = /[\s\u0085]/u;
const ZERO_WIDTH_CHARS: ReadonlySet<string> = new Set(["​", "‌", "‍", "⁠", "﻿"]);
// Control characters, bidi overrides/isolates, and lone surrogates (which serde rejects).
const FORBIDDEN_IN_LINE = /[\0-\x1F\x7F-\x9F‪-‮⁦-⁩]|\p{Cs}/u;
const FORBIDDEN_IN_DESCRIPTION = /[\0-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F‪-‮⁦-⁩]|\p{Cs}/u;

const charCount = (value: string) => [...value].length;
const isBlank = (value: string) =>
    [...value].every((char) => WHITESPACE.test(char) || ZERO_WIDTH_CHARS.has(char));

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
 * All rule violations, in the order the server checks them, so the first entry equals
 * the server's error. `time`/`location` may be null for drafts; `placeName` is checked
 * while the location is unresolved.
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

    const location = fields.location;
    const nameProblem = lineProblem(
        "Ort",
        location?.name ?? placeName,
        MAX_LOCATION_NAME_LEN,
        true
    );
    if (nameProblem !== null) add("place", nameProblem);
    else if (location === null) {
        add(null, "Ort hat keine Koordinaten: bekannten Ort auswählen oder auf der Karte setzen.");
    } else if (
        !(location.lat >= -90 && location.lat <= 90) ||
        !(location.lon >= -180 && location.lon <= 180) ||
        (location.lat === 0 && location.lon === 0)
    ) {
        add(null, "Ort hat keine gültigen Koordinaten.");
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

    return problems;
};

/** The meeting ready to send, or null while the draft has errors. */
export const toNewMeeting = (draft: BulkDraft): NewMeeting | null => {
    const { time, location } = draft.fields;
    if (draft.errors.length > 0 || time === null || location === null) return null;
    return { ...draft.fields, time, location };
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
    errors: string[]
): Read<string> => {
    const value = entry[key];
    if (value === undefined || value === null) return undefined;
    if (typeof value === "string") return value;
    errors.push(`"${key}" muss ein Text sein.`);
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

const emptyFields = (status: MeetingStatus): DraftFields => ({
    ...defaultMeetingContent(),
    title: "",
    time: null,
    location: null,
    status
});

const resolveLocation = (placeName: string, context: BulkParseContext): MeetingLocation | null => {
    if (!placeName) return null;
    const picked = context.picks[normalizePlaceName(placeName)];
    if (picked) return picked;
    const place = findPlace(placeName, context.places);
    return place ? { name: place.name, lat: place.lat, lon: place.lon } : null;
};

const convertEntry = (entry: unknown, context: BulkParseContext): BulkDraft => {
    const fields = emptyFields(context.status);
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
    if (place === INVALID) invalidInputs.add("place");
    const placeName = typeof place === "string" ? place.trim() : "";
    fields.location = resolveLocation(placeName, context);

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

    const drafts = entries.map((entry) => convertEntry(entry, context));
    const firstIndexByKey = new Map<string, number>();
    return {
        ok: true,
        drafts: drafts.map((draft, index) => {
            const location = draft.fields.location?.name ?? draft.placeName;
            const key = `${draft.fields.title.toLowerCase()}|${draft.fields.time}|${normalizePlaceName(location)}`;
            const first = firstIndexByKey.get(key);
            if (first === undefined) {
                firstIndexByKey.set(key, index);
                return draft;
            }
            return {
                ...draft,
                warnings: [...draft.warnings, `Gleiches Treffen wie Treffen ${first + 1}.`]
            };
        })
    };
};

// ---------------------------------------------------------------------------------------
// The prompt a member copies into their own AI model

const promptDateFormat = new Intl.DateTimeFormat("de-DE", {
    timeZone: TIME_ZONE,
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
});

/** Place names come from past meetings (written by any member), so they are flattened to
 * one line and quoted to keep them from acting as instructions inside the prompt. */
const promptPlaceNames = (places: readonly Place[]): string[] => {
    const seen = new Set<string>();
    return places.flatMap((place) => {
        const name = [...place.name.replace(/[\p{Cc}\p{Cf}\s]+/gu, " ").trim()]
            .slice(0, MAX_LOCATION_NAME_LEN)
            .join("");
        const key = normalizePlaceName(name);
        if (!name || seen.has(key)) return [];
        seen.add(key);
        return [name];
    });
};

export const buildBulkPrompt = (now: Date, places: readonly Place[]): string => {
    const wall = berlinWallClock(now.getTime());
    const exampleStart = `${wall.year}-${pad(wall.month)}-${pad(wall.day)}T19:00`;
    const placeNames = promptPlaceNames(places);
    const placeSection = placeNames.length
        ? `Verwende wenn möglich exakt einen dieser bekannten Orte:\n${placeNames
              .map((name) => `  - ${JSON.stringify(name)}`)
              .join("\n")}\n  Ist der Ort neu, schreib nur seinen Namen.`
        : "Schreib den Namen des Ortes.";
    const example = [
        {
            title: "Stammtisch",
            start: exampleStart,
            place: placeNames[0] ?? "Name des Ortes",
            description: "Gemütliches Kennenlernen bei Getränken.",
            common_tags: ["Meet"],
            queer_tags: ["Everyone"]
        }
    ];

    return `Du hilfst mir, Termine für die Website von Queer Augsburg als JSON vorzubereiten.

Heute ist ${promptDateFormat.format(now)}. Alle Uhrzeiten sind deutsche Ortszeit (Europe/Berlin).

So gehst du vor:
1. Ich beschreibe dir gleich einen oder mehrere Termine (als Text, Stichpunkte oder diktiert).
2. Prüfe für jeden Termin, ob Titel, Datum, Uhrzeit und Ort klar sind. Fehlt etwas oder ist etwas mehrdeutig, frag mich zuerst nach. Rate nichts und erfinde nichts.
3. Wiederkehrende Termine (z. B. "die nächsten drei Dienstage") schreibst du als einzelne Einträge mit konkretem Datum aus und nennst mir die berechneten Daten zur Kontrolle.
4. Erst wenn alles geklärt ist, antwortest du mit genau einem JSON-Codeblock im folgenden Format, ohne Kommentare im JSON.

Format: ein JSON-Array mit einem Objekt pro Termin, höchstens ${MAX_MEETINGS_PER_BATCH} Termine pro Antwort (bei mehr bitte auf mehrere Antworten aufteilen). Erlaubte Felder (keine anderen):
- "title" (Pflicht): kurzer Titel, höchstens ${MAX_TITLE_LEN} Zeichen
- "start" (Pflicht): Beginn als Datum, Buchstabe T, Uhrzeit im 24-Stunden-Format, ohne Zeitzone, z. B. "${exampleStart}"
- "place" (Pflicht): Name des Ortes. ${placeSection} Gib keine Koordinaten an, die werden auf der Website gewählt.
- "description": Beschreibung, Markdown erlaubt, höchstens ${MAX_DESCRIPTION_LEN} Zeichen
- "authority": Ansprechperson(en) bzw. Verantwortliche
- "common_tags": Art der Veranstaltung, nur aus: ${commonTags.join(", ")}
- "queer_tags": für welche Gruppen, nur aus: ${queerTags.join(", ")} (Standard: ["Everyone"])
- "freeform_tags": eigene Tags als Liste von Texten, höchstens ${MAX_FREEFORM_TAGS} mit je höchstens ${MAX_FREEFORM_TAG_LEN} Zeichen
- "price": ungefährer Preis in Euro als [von] oder [von, bis], Zahlen ab 0 (Standard: [0])
- "age_restriction": Altersgrenze als [ab] oder [ab, bis], ganze Zahlen (Standard: [0])
- "accessibility": Hinweise zur Barrierefreiheit als einzeiliger Text
- "trigger_warning": Triggerwarnungen als einzeiliger Text

Jeder Tag darf pro Termin nur einmal vorkommen. Lass optionale Felder weg, wenn du sie nicht kennst.

Beispiel:
\`\`\`json
${JSON.stringify(example, null, 2)}
\`\`\``;
};
