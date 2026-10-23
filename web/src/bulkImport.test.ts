import { describe, expect, it } from "vitest";
import validationCases from "../../server/src/meeting_validation_cases.json";
import type { Meeting } from "./apiTypes/Meeting";
import type { NewMeeting } from "./apiTypes/NewMeeting";
import type { NewOnlineMeeting } from "./apiTypes/NewOnlineMeeting";
import type { Place } from "./apiTypes/Place";
import {
    BulkParseContext,
    DraftFields,
    MAX_MEETINGS_PER_BATCH,
    draftVenueText,
    includedDrafts,
    parseBerlinStart,
    parseBulkJson,
    toNewMeeting,
    validateFields
} from "./bulkImport";
import { testPlaces as places, storedMeeting as stored, zoom } from "./testFixtures";

// 2026-10-21T10:00:00Z, a Wednesday.
const NOW = Date.UTC(2026, 9, 21, 10, 0);

const context = (overrides: Partial<BulkParseContext> = {}): BulkParseContext => ({
    places,
    picks: {},
    existing: [],
    now: NOW,
    ...overrides
});

const parseOk = (text: string, overrides: Partial<BulkParseContext> = {}) => {
    const result = parseBulkJson(text, context(overrides));
    if (!result.ok) throw new Error(`expected ok, got: ${result.error}`);
    return result.drafts;
};

const entry = (fields: Record<string, unknown>) =>
    JSON.stringify([{ title: "A", start: "2026-10-27T19:00", place: "Café Neruda", ...fields }]);

describe("test environment", () => {
    it("runs in a time zone other than Europe/Berlin", () => {
        // Set in vitest.config.ts so the Berlin conversion is proven browser-independent.
        expect(Intl.DateTimeFormat().resolvedOptions().timeZone).toBe("America/Los_Angeles");
    });
});

describe("shared validation cases (server/src/meeting_validation_cases.json)", () => {
    interface Fill {
        path: string;
        text: string;
        count: number;
    }

    const mergePatch = (target: unknown, patch: unknown): unknown => {
        if (typeof patch !== "object" || patch === null || Array.isArray(patch)) return patch;
        const result: Record<string, unknown> =
            typeof target === "object" && target !== null && !Array.isArray(target)
                ? { ...(target as Record<string, unknown>) }
                : {};
        for (const [key, value] of Object.entries(patch)) {
            if (value === null) delete result[key];
            else result[key] = mergePatch(result[key], value);
        }
        return result;
    };

    const applyFill = (value: Record<string, unknown>, fill: Fill) => {
        const keys = fill.path.split(".");
        let target = value;
        for (const key of keys.slice(0, -1)) target = target[key] as Record<string, unknown>;
        target[keys[keys.length - 1]] = fill.text.repeat(fill.count);
    };

    it("has cases", () => {
        expect(validationCases.cases.length).toBeGreaterThan(20);
    });

    for (const testCase of validationCases.cases) {
        it(testCase.name, () => {
            const meeting = mergePatch(validationCases.base, testCase.patch) as Record<
                string,
                unknown
            >;
            if ("fill" in testCase) applyFill(meeting, testCase.fill as Fill);
            // The import resolves names, not ids: a place_id that is not in the list stands
            // for a JSON place name without a stored place. A merge patch deletes keys set to
            // null, so a missing url means none.
            const { place_id, online, ...rest } = meeting as unknown as Omit<
                NewMeeting,
                "place_id" | "online"
            > & {
                place_id?: string;
                online?: Omit<NewOnlineMeeting, "url"> & { url?: string };
            };
            const place = places.find((candidate) => candidate._id === place_id) ?? null;
            const fields: DraftFields = {
                ...rest,
                online: online ? { ...online, url: online.url ?? null } : null,
                place
            };
            const placeName = place === null ? (place_id ?? "") : place.name;
            const messages = validateFields(fields, placeName).map((problem) => problem.message);
            const expected = "client_error" in testCase ? testCase.client_error : testCase.error;
            expect(messages[0] ?? null).toBe(expected);
        });
    }
});

describe("parseBerlinStart", () => {
    const time = (value: string) => {
        const result = parseBerlinStart(value);
        if (!result.ok) throw new Error(result.error);
        return result.time;
    };
    const error = (value: string) => {
        const result = parseBerlinStart(value);
        if (result.ok) throw new Error(`expected an error for ${value}`);
        return result.error;
    };

    it("uses UTC+2 in summer and UTC+1 in winter", () => {
        expect(time("2026-07-01T19:00")).toBe(Date.UTC(2026, 6, 1, 17, 0));
        expect(time("2026-12-24T18:00")).toBe(Date.UTC(2026, 11, 24, 17, 0));
    });

    it("accepts T or space and optional :00 seconds", () => {
        const expected = Date.UTC(2026, 9, 27, 18, 0);
        expect(time("2026-10-27T19:00")).toBe(expected);
        expect(time("2026-10-27 19:00")).toBe(expected);
        expect(time(" 2026-10-27T19:00:00 ")).toBe(expected);
    });

    it("handles the spring transition (2026-03-29)", () => {
        expect(time("2026-03-29T01:59")).toBe(Date.UTC(2026, 2, 29, 0, 59));
        expect(error("2026-03-29T02:00")).toBe(
            "02:00 Uhr am 29.03.2026 gibt es wegen der Zeitumstellung nicht."
        );
        expect(error("2026-03-29T02:30")).toContain("gibt es wegen der Zeitumstellung nicht");
        expect(time("2026-03-29T03:00")).toBe(Date.UTC(2026, 2, 29, 1, 0));
    });

    it("handles the autumn transition (2026-10-25)", () => {
        expect(time("2026-10-25T01:59")).toBe(Date.UTC(2026, 9, 24, 23, 59));
        expect(error("2026-10-25T02:00")).toContain("gibt es wegen der Zeitumstellung zweimal");
        expect(error("2026-10-25T02:30")).toContain("gibt es wegen der Zeitumstellung zweimal");
        expect(time("2026-10-25T03:00")).toBe(Date.UTC(2026, 9, 25, 2, 0));
        expect(time("2026-10-25T19:00")).toBe(Date.UTC(2026, 9, 25, 18, 0));
    });

    it("crosses the year boundary", () => {
        expect(time("2026-12-31T23:30")).toBe(Date.UTC(2026, 11, 31, 22, 30));
        expect(time("2027-01-01T00:30")).toBe(Date.UTC(2026, 11, 31, 23, 30));
    });

    it("rejects impossible dates and years outside 2000–2099", () => {
        for (const value of [
            "2026-02-30T19:00",
            "2026-13-01T19:00",
            "2026-00-10T19:00",
            "2026-10-27T24:00",
            "2026-10-27T19:60",
            "0026-10-27T19:00",
            "1999-12-31T19:00",
            "2100-01-01T19:00"
        ]) {
            expect(error(value), value).toBe(`"start" ist kein gültiger Zeitpunkt: "${value}".`);
        }
    });

    it("rejects other formats, including time zone suffixes", () => {
        for (const value of [
            "27.10.2026 19:00",
            "2026-10-27",
            "2026-10-27T19:00Z",
            "2026-10-27T19:00+02:00",
            "2026-10-27T19:00:30",
            "2026-10-27T7:00",
            ""
        ]) {
            expect(error(value), value).toContain("hat nicht das Format");
        }
    });
});

describe("parseBulkJson", () => {
    it("converts a full entry", () => {
        const [draft] = parseOk(
            JSON.stringify([
                {
                    title: " Queer Party ",
                    start: "2026-11-14T22:00",
                    place: "kulturpark west",
                    description: "**Tanzen**\nbis spät",
                    authority: " Paul ",
                    common_tags: ["party", "Kultur"],
                    queer_tags: ["Queer"],
                    freeform_tags: [" Tanz "],
                    price: [8, 10],
                    age_restriction: [18],
                    accessibility: "Rollstuhlgerecht",
                    trigger_warning: "Laute Musik"
                }
            ])
        );
        expect(draft.errors).toEqual([]);
        expect(draft.warnings).toEqual([]);
        expect(draft.placeName).toBe("kulturpark west");
        expect(draft.fields).toEqual({
            title: "Queer Party",
            time: Date.UTC(2026, 10, 14, 21, 0),
            place: places[1],
            online: null,
            place_to_be_announced: false,
            description: "**Tanzen**\nbis spät",
            authority: "Paul",
            tags: { common: ["Party", "Kultur"], queer: ["Queer"], freeform: ["Tanz"] },
            price: [8, 10],
            age_restriction: [18],
            accessibility: "Rollstuhlgerecht",
            trigger_warning: "Laute Musik"
        });
    });

    it("applies defaults for omitted optional fields", () => {
        const [draft] = parseOk(entry({}));
        expect(draft.errors).toEqual([]);
        expect(draft.fields).toMatchObject({
            price: [0],
            age_restriction: [0],
            authority: "",
            description: "",
            accessibility: null,
            trigger_warning: null,
            tags: { freeform: [], common: [], queer: ["Everyone"] }
        });
    });

    it("extracts JSON from a fenced block with chat text around it", () => {
        const drafts = parseOk(
            'Hier sind deine Termine:\n```json\n[{"title":"A","start":"2026-10-27T19:00","place":"Café Neruda"},' +
                '{"title":"B","start":"2026-11-03T19:00","place":"Café Neruda"}]\n```\nViel Spaß [1]!'
        );
        expect(drafts.map((draft) => draft.fields.title)).toEqual(["A", "B"]);
    });

    it("skips a leading non-JSON code block and accepts an uppercase fence label", () => {
        const drafts = parseOk(
            "Berechnete Daten:\n```\n27.10., 03.11.\n```\nJSON:\n```JSON\n" + entry({}) + "\n```"
        );
        expect(drafts).toHaveLength(1);
    });

    it("finds unfenced JSON between prose that contains brackets", () => {
        const drafts = parseOk(
            `Laut [Plan] sind das (siehe [1]): ${entry({ title: "X [Y]" })} Fertig {ok}`
        );
        expect(drafts.map((draft) => draft.fields.title)).toEqual(["X [Y]"]);
    });

    it("keeps a description containing a code fence", () => {
        const text = entry({ description: "Mitbringen:\n```\nGute Laune\n```" });
        const [draft] = parseOk(text);
        expect(draft.fields.description).toBe("Mitbringen:\n```\nGute Laune\n```");
    });

    it("accepts a single object and a {meetings: [...]} wrapper", () => {
        expect(
            parseOk('{"title":"A","start":"2026-10-27T19:00","place":"Café Neruda"}')
        ).toHaveLength(1);
        expect(parseOk(`{"meetings": ${entry({})}}`)).toHaveLength(1);
    });

    it("reports invalid JSON in German with a hint", () => {
        const result = parseBulkJson('[{"title": "A",}]', context());
        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error).toContain("Kein gültiges JSON gefunden");
            expect(result.error).toContain("JSON-Codeblock");
        }
    });

    it("fails on empty input, empty lists and too many entries", () => {
        expect(parseBulkJson("  ", context())).toEqual({
            ok: false,
            error: "Bitte JSON einfügen."
        });
        expect(parseBulkJson("[]", context())).toEqual({
            ok: false,
            error: "Die Liste enthält keine Treffen."
        });
        const one = { title: "A", start: "2026-10-27T19:00", place: "Café Neruda" };
        const tooMany = parseBulkJson(
            JSON.stringify(Array(MAX_MEETINGS_PER_BATCH + 1).fill(one)),
            context()
        );
        expect(tooMany.ok).toBe(false);
        if (!tooMany.ok)
            expect(tooMany.error).toContain(`eingefügt: ${MAX_MEETINGS_PER_BATCH + 1}`);
        expect(parseOk(JSON.stringify(Array(MAX_MEETINGS_PER_BATCH).fill(one)))).toHaveLength(
            MAX_MEETINGS_PER_BATCH
        );
    });

    it("flags an unknown place instead of creating it", () => {
        const [draft] = parseOk(entry({ place: "Neuer Ort" }));
        expect(draft.fields.place).toBeNull();
        expect(draft.placeName).toBe("Neuer Ort");
        expect(draft.errors).toEqual([
            "Den Ort „Neuer Ort“ gibt es noch nicht: bestehenden Ort auswählen oder neu anlegen."
        ]);
        expect(toNewMeeting(draft)).toBeNull();
    });

    it("resolves places from the member's picks, keyed by the JSON name's key", () => {
        const created: Place = { _id: "new", name: "Neuer Ort", lat: 48.1, lon: 10.1 };
        const drafts = parseOk(
            JSON.stringify([
                { title: "A", start: "2026-10-27T19:00", place: "Neuer  Ort" },
                { title: "B", start: "2026-10-28T19:00", place: "neuer ort" }
            ]),
            { places: [...places, created], picks: { "neuer ort": "new" } }
        );
        expect(drafts.map((draft) => draft.errors)).toEqual([[], []]);
        expect(drafts[1].fields.place).toEqual(created);
        expect(toNewMeeting(drafts[1])?.place_id).toBe("new");
    });

    it("lets a pick override an automatically matched place", () => {
        const [draft] = parseOk(entry({}), { picks: { "café neruda": "p2" } });
        expect(draft.fields.place).toEqual(places[1]);
    });

    it("asks again when the picked place is no longer in the list", () => {
        const [known] = parseOk(entry({}), { picks: { "café neruda": "gone" } });
        expect(known.fields.place).toBeNull();
        expect(known.errors).toEqual([
            "Den Ort „Café Neruda“ gibt es noch nicht: bestehenden Ort auswählen oder neu anlegen."
        ]);
        const [unknown] = parseOk(entry({ place: "Neuer Ort" }), {
            picks: { "neuer ort": "gone" }
        });
        expect(unknown.fields.place).toBeNull();
        expect(toNewMeeting(unknown)).toBeNull();
    });

    it("reads online meetings; links are members-only unless link_public is true", () => {
        const drafts = parseOk(
            JSON.stringify([
                {
                    title: "A",
                    start: "2026-10-27T19:00",
                    online: { platform: " Zoom ", link: " https://zoom.us/j/1 " }
                },
                {
                    title: "B",
                    start: "2026-10-27T19:00",
                    online: { link: "https://meet.jit.si/qa", link_public: true }
                },
                { title: "C", start: "2026-10-27T19:00", online: true },
                { title: "D", start: "2026-10-27T19:00", place: "Café Neruda", online: false }
            ])
        );
        expect(drafts.map((draft) => draft.errors)).toEqual([[], [], [], []]);
        expect(drafts.map((draft) => draft.fields.online)).toEqual([
            { platform: "Zoom", url: "https://zoom.us/j/1", members_only: true },
            { platform: "", url: "https://meet.jit.si/qa", members_only: false },
            { platform: "", url: null, members_only: true },
            null
        ]);
        expect(drafts[0].placeName).toBe("");
        expect(toNewMeeting(drafts[0])).toEqual({
            title: "A",
            authority: "",
            age_restriction: [0],
            time: Date.UTC(2026, 9, 27, 18, 0),
            place_id: null,
            online: { platform: "Zoom", url: "https://zoom.us/j/1", members_only: true },
            place_to_be_announced: false,
            description: "",
            price: [0],
            trigger_warning: null,
            accessibility: null,
            tags: { freeform: [], common: [], queer: ["Everyone"] }
        });
        expect(toNewMeeting(drafts[3])).toMatchObject({ place_id: "p1", online: null });
    });

    it("rejects invalid online details", () => {
        const errors = (online: unknown) =>
            parseOk(JSON.stringify([{ title: "A", start: "2026-10-27T19:00", online }]))[0].errors;
        expect(errors({ link: "zoom.us/j/1" })).toEqual([
            "Der Link muss mit https:// oder http:// beginnen."
        ]);
        expect(errors({ link: "https://zoom.us@evil.example/" })).toEqual([
            "Der Link muss mit https:// oder http:// beginnen."
        ]);
        expect(errors("Zoom")).toEqual([
            '"online" muss ein Objekt sein, z. B. {"platform": "Zoom"}.'
        ]);
        expect(errors({ platform: 1, link_public: "ja" })).toEqual([
            '"online.platform" muss ein Text sein.',
            '"online.link_public" muss true oder false sein.'
        ]);
    });

    it("warns about unknown online fields", () => {
        const [draft] = parseOk(
            JSON.stringify([
                {
                    title: "A",
                    start: "2026-10-27T19:00",
                    online: { platform: "Zoom", password: "x" }
                }
            ])
        );
        expect(draft.errors).toEqual([]);
        expect(draft.warnings).toEqual([
            'Feld "online.password" wird nicht unterstützt und ignoriert.'
        ]);
    });

    it("reads hybrid meetings: a place and online details", () => {
        const atPlace = toNewMeeting(parseOk(entry({}))[0]);
        expect(atPlace?.place_id).toBe("p1");
        for (const online of [{ platform: "Zoom" }, true]) {
            const [draft] = parseOk(entry({ online }));
            expect(draft.errors, JSON.stringify(online)).toEqual([]);
            expect(toNewMeeting(draft)).toEqual({
                ...atPlace,
                online: { platform: online === true ? "" : "Zoom", url: null, members_only: true }
            });
        }
        const [unknown] = parseOk(entry({ online: {}, place: "Unbekannter Ort" }));
        expect(unknown.errors).toEqual([
            "Den Ort „Unbekannter Ort“ gibt es noch nicht: bestehenden Ort auswählen oder neu anlegen."
        ]);
        expect(toNewMeeting(unknown)).toBeNull();
        // A wrong type of "online" does not hide an unknown place.
        const [both] = parseOk(entry({ online: "Zoom", place: "Unbekannter Ort" }));
        expect(both.errors).toEqual([
            '"online" muss ein Objekt sein, z. B. {"platform": "Zoom"}.',
            "Den Ort „Unbekannter Ort“ gibt es noch nicht: bestehenden Ort auswählen oder neu anlegen."
        ]);
    });

    it("reads a place that is to be announced", () => {
        const parse = (fields: Record<string, unknown>) =>
            parseOk(JSON.stringify([{ title: "A", start: "2026-10-27T19:00", ...fields }]))[0];
        const announced = parse({ place_to_be_announced: true });
        expect(announced.errors).toEqual([]);
        expect(toNewMeeting(announced)).toMatchObject({
            place_id: null,
            online: null,
            place_to_be_announced: true
        });
        const both = 'Nur eins angeben: "place" oder "place_to_be_announced".';
        expect(parse({ place_to_be_announced: true, place: "Café Neruda" }).errors).toEqual([both]);
        // Hybrid, with the place still to be announced.
        const hybrid = parse({ place_to_be_announced: true, online: {} });
        expect(hybrid.errors).toEqual([]);
        expect(toNewMeeting(hybrid)).toMatchObject({
            place_id: null,
            online: { platform: "" },
            place_to_be_announced: true
        });
        // Only real booleans; a wrong type is not also reported as a missing place.
        for (const value of ["ja", "true", 1, 0, [], {}]) {
            expect(parse({ place_to_be_announced: value }).errors, JSON.stringify(value)).toEqual([
                '"place_to_be_announced" muss true oder false sein.'
            ]);
        }
        // false and null mean: there is a place, which is then missing.
        expect(parse({ place_to_be_announced: false }).errors).toEqual(["Ort fehlt."]);
        expect(parse({ place_to_be_announced: null }).errors).toEqual(["Ort fehlt."]);
        // A blank place and "no online meeting" are no venue.
        expect(parse({ place_to_be_announced: true, place: "  " }).errors).toEqual([]);
        expect(parse({ place_to_be_announced: true, online: false }).errors).toEqual([]);
    });

    it("reads the shapes models write for online details", () => {
        const parse = (fields: Record<string, unknown>) =>
            parseOk(JSON.stringify([{ title: "A", start: "2026-10-27T19:00", ...fields }]))[0];
        const notAnObject = '"online" muss ein Objekt sein, z. B. {"platform": "Zoom"}.';
        for (const online of [[], 0, "", "Zoom"]) {
            expect(parse({ online }).errors, JSON.stringify(online)).toEqual([notAnObject]);
        }
        // A blank place next to online details is no place.
        expect(parse({ online: {}, place: "  " }).errors).toEqual([]);
        expect(
            parse({ online: { platform: null, link: null, link_public: null } }).fields.online
        ).toEqual({ platform: "", url: null, members_only: true });
        // A public flag without a link is allowed; the link can be added in the editor.
        expect(parse({ online: { link_public: true } }).fields.online).toEqual({
            platform: "",
            url: null,
            members_only: false
        });
        expect(parse({ online: { platform: "Zoom\u{FEFF}" } }).errors).toEqual([
            "Die Plattform enthält unzulässige Steuerzeichen."
        ]);
        expect(parse({ online: { link: "\u{FEFF}https://zoom.us/j/1" } }).errors).toEqual([
            "Der Link muss mit https:// oder http:// beginnen."
        ]);
        expect(parse({ online: { platform: "x".repeat(51) } }).errors).toEqual([
            "Die Plattform ist zu lang (höchstens 50 Zeichen)."
        ]);
    });

    it("warns when a members-only link is also in the public text", () => {
        const warning =
            "Der Link steht auch im Titel oder in der Beschreibung und wäre dort öffentlich sichtbar.";
        const parse = (online: Record<string, unknown>, description: string) =>
            parseOk(
                JSON.stringify([{ title: "A", start: "2026-10-27T19:00", online, description }])
            )[0].warnings;
        expect(parse({ link: "https://zoom.us/j/1?pwd=x" }, "Link: zoom.us/j/1?pwd=x")).toEqual([
            warning
        ]);
        expect(
            parse({ link: "https://zoom.us/j/1", link_public: true }, "https://zoom.us/j/1")
        ).toEqual([]);
        expect(parse({ link: "https://zoom.us/j/1" }, "Wir treffen uns online.")).toEqual([]);
    });

    it("reports missing required fields", () => {
        const [draft] = parseOk("[{}]");
        expect(draft.errors).toEqual(["Titel fehlt.", "Zeit fehlt.", "Ort fehlt."]);
    });

    it("treats whitespace-only and zero-width titles as missing", () => {
        expect(parseOk(entry({ title: "   " }))[0].errors).toEqual(["Titel fehlt."]);
        expect(parseOk(entry({ title: "\u{200B}\u{FEFF}" }))[0].errors).toEqual(["Titel fehlt."]);
    });

    it("rejects control characters and lone surrogates", () => {
        expect(parseOk(entry({ title: "A\u0007" }))[0].errors).toEqual([
            "Titel enthält unzulässige Steuerzeichen."
        ]);
        expect(
            parseOk('[{"title":"A\\ud800","start":"2026-10-27T19:00","place":"Café Neruda"}]')[0]
                .errors
        ).toEqual(["Titel enthält unzulässige Steuerzeichen."]);
    });

    it("reports wrong types once, without an extra 'missing' message", () => {
        const [draft] = parseOk(
            JSON.stringify([
                {
                    title: 5,
                    start: "27.10.2026 19:00",
                    place: ["Café Neruda"],
                    common_tags: ["Picknick"],
                    queer_tags: "Everyone",
                    price: ["8"],
                    age_restriction: [18.5],
                    description: 5
                }
            ])
        );
        expect(draft.errors).toEqual([
            '"title" muss ein Text sein.',
            '"description" muss ein Text sein.',
            '"start" hat nicht das Format JJJJ-MM-TTTHH:MM (z. B. 2026-10-27T19:00): "27.10.2026 19:00".',
            '"place" muss ein Text sein.',
            'Unbekannte Art der Veranstaltung "Picknick".',
            '"queer_tags" muss eine Liste von Texten sein.',
            '"price" muss eine Liste von Zahlen sein.',
            '"age_restriction" muss eine Liste ganzer Zahlen (0–255) sein.'
        ]);
    });

    it("lets a wrong venue type hide only the messages that follow from it", () => {
        const errors = (fields: Record<string, unknown>) =>
            parseOk(JSON.stringify([{ title: "A", start: "2026-10-27T19:00", ...fields }]))[0]
                .errors;
        const notAnObject = '"online" muss ein Objekt sein, z. B. {"platform": "Zoom"}.';
        const notABoolean = '"place_to_be_announced" muss true oder false sein.';
        expect(errors({ online: "Zoom", place: "Café Neruda" })).toEqual([notAnObject]);
        expect(errors({ online: "Zoom", place_to_be_announced: true })).toEqual([notAnObject]);
        expect(errors({ online: "Zoom" })).toEqual([notAnObject]);
        expect(errors({ place: 5, online: {} })).toEqual(['"place" muss ein Text sein.']);
        expect(errors({ place_to_be_announced: "ja", online: {} })).toEqual([notABoolean]);
        expect(errors({ place: "  ", online: {} })).toEqual([]);
        expect(errors({ online: { link: "zoom.us" }, place_to_be_announced: true })).toEqual([
            "Der Link muss mit https:// oder http:// beginnen."
        ]);
    });

    it("describes where a draft takes place", () => {
        const text = (fields: Record<string, unknown>) => {
            const [draft] = parseOk(entry(fields));
            return draftVenueText(draft.fields, draft.placeName);
        };
        expect(text({})).toBe("Café Neruda");
        expect(text({ online: { platform: "Zoom" } })).toBe(
            "Café Neruda und Online · Zoom · noch ohne Link"
        );
        expect(text({ place: "Neu", online: { link: "https://zoom.us/j/1" } })).toBe(
            "Neu und Online · Link nur für verifizierte Mitglieder"
        );
        // Online only says so, so a forgotten place of a hybrid meeting shows.
        expect(text({ place: undefined, online: { platform: "Zoom", link_public: true } })).toBe(
            "Nur online · Zoom · noch ohne Link"
        );
        expect(
            text({
                place: undefined,
                online: { link: "https://zoom.us/j/1", link_public: true }
            })
        ).toBe("Nur online · Link öffentlich");
        expect(text({ place: undefined, place_to_be_announced: true, online: {} })).toBe(
            "Ort wird noch bekanntgegeben und Online · noch ohne Link"
        );
        expect(text({ place_to_be_announced: true })).toBe("Mehrere Angaben zum Ort");
        expect(text({ place: undefined })).toBe("Ort fehlt");
    });

    it("rejects out-of-range ages and null prices", () => {
        const ageError = '"age_restriction" muss eine Liste ganzer Zahlen (0–255) sein.';
        expect(parseOk(entry({ age_restriction: [256] }))[0].errors).toEqual([ageError]);
        expect(parseOk(entry({ age_restriction: [-1] }))[0].errors).toEqual([ageError]);
        expect(parseOk(entry({ price: [null] }))[0].errors).toEqual([
            '"price" muss eine Liste von Zahlen sein.'
        ]);
        expect(parseOk(entry({ price: [] }))[0].errors).toEqual([
            "Preis muss aus einem oder zwei Werten bestehen."
        ]);
    });

    it("rejects entries that are not objects", () => {
        expect(
            parseOk('[{"title":"A","start":"2026-10-27T19:00","place":"Café Neruda"}, "x"]')[1]
                .errors
        ).toEqual(["Eintrag ist kein JSON-Objekt."]);
    });

    it("ignores unknown fields with a non-blocking warning", () => {
        const [draft] = parseOk(entry({ end: "2026-10-27T22:00", lat: 1 }));
        expect(draft.errors).toEqual([]);
        expect(draft.warnings).toEqual([
            'Feld "end" wird nicht unterstützt und ignoriert.',
            'Feld "lat" wird nicht unterstützt und ignoriert.'
        ]);
        expect(toNewMeeting(draft)).not.toBeNull();
    });

    it("warns about past dates, far-future dates and duplicates", () => {
        const drafts = parseOk(
            JSON.stringify([
                { title: "Alt", start: "2026-10-01T19:00", place: "Café Neruda" },
                { title: "Fern", start: "2028-01-01T19:00", place: "Café Neruda" },
                { title: "Doppelt", start: "2026-11-01T19:00", place: "Café Neruda" },
                { title: "doppelt", start: "2026-11-01T19:00", place: "cafe neruda" }
            ])
        );
        expect(drafts.map((draft) => draft.warnings)).toEqual([
            ["Beginn liegt in der Vergangenheit."],
            ["Beginn liegt mehr als ein Jahr in der Zukunft."],
            [],
            ["Gleiches Treffen wie Treffen 3."]
        ]);
        expect(drafts.every((draft) => draft.errors.length === 0)).toBe(true);
    });

    it("flags duplicates by title, start and place or online details", () => {
        const at = (fields: Record<string, unknown>) => ({
            title: "Treffen",
            start: "2026-11-01T19:00",
            ...fields
        });
        const warnings = (entries: Record<string, unknown>[], picks = {}) =>
            parseOk(JSON.stringify(entries), { picks }).map((draft) => draft.warnings);
        const duplicate = ["Gleiches Treffen wie Treffen 1."];
        const similar = ["Ähnlich wie Treffen 1."];
        expect(
            warnings([at({ online: { platform: "Zoom" } }), at({ online: { platform: "Zoom" } })])
        ).toEqual([[], duplicate]);
        // Same title and day elsewhere: similar, not the same.
        expect(
            warnings([at({ online: { platform: "Zoom" } }), at({ online: { platform: "Jitsi" } })])
        ).toEqual([[], similar]);
        expect(warnings([at({ online: {} }), at({ place: "Café Neruda" })])).toEqual([[], similar]);
        expect(
            warnings([
                at({ title: "Lesekreis", online: { platform: "Zoom" } }),
                at({ title: "Brunch", online: { platform: "Jitsi" } })
            ])
        ).toEqual([[], []]);
        expect(
            warnings([
                at({ title: "Lesekreis", place: "Ort A" }),
                at({ title: "Brunch", place: "Ort B" })
            ])
        ).toEqual([[], []]);
        expect(warnings([at({ place: "Ort A" }), at({ place: " ort  a" })])).toEqual([
            [],
            duplicate
        ]);
        // Two names pointed at the same stored place.
        expect(
            warnings([at({ place: "Ort A" }), at({ place: "Café Neruda" })], { "ort a": "p1" })
        ).toEqual([[], duplicate]);
        // A place to be announced is no venue: only the title counts.
        const announced = { place_to_be_announced: true };
        expect(warnings([at(announced), at(announced)])).toEqual([[], duplicate]);
        expect(
            warnings([
                at({ title: "Lesekreis", ...announced }),
                at({ title: "Brunch", ...announced })
            ])
        ).toEqual([[], []]);
        expect(warnings([at(announced), at({ place: "Ort A" })])).toEqual([[], similar]);
        // Hybrid drafts.
        const hybrid = { place: "Ort A", online: { platform: "Zoom" } };
        expect(warnings([at(hybrid), at(hybrid)])).toEqual([[], duplicate]);
        expect(warnings([at(hybrid), at({ place: "Ort A" })])).toEqual([[], similar]);
        const other = (fields: Record<string, unknown>) => at({ title: "Brunch", ...fields });
        // Same place, or same platform: the same slot even with another title.
        expect(warnings([at(hybrid), other({ place: "Ort A" })])).toEqual([[], similar]);
        expect(warnings([at(hybrid), other({ online: { platform: "Zoom" } })])).toEqual([
            [],
            similar
        ]);
        expect(
            warnings([at({ ...announced, online: { platform: "Zoom" } }), other({ online: {} })])
        ).toEqual([[], similar]);
        expect(
            warnings([at(hybrid), other({ place: "Ort B", online: { platform: "Jitsi" } })])
        ).toEqual([[], []]);
    });

    it("sends exactly the fields of NewMeeting", () => {
        const drafts = parseOk(
            JSON.stringify([
                { title: "A", start: "2026-10-27T19:00", place: "Café Neruda" },
                { title: "B", start: "2026-10-27T19:00", online: { platform: "Zoom" } },
                { title: "C", start: "2026-10-27T19:00", place_to_be_announced: true }
            ])
        );
        // The server rejects unknown fields; the fixture's base is a valid NewMeeting.
        const contract = Object.keys(validationCases.base).sort();
        for (const draft of drafts) {
            expect(Object.keys(toNewMeeting(draft) ?? {}).sort()).toEqual(contract);
        }
    });

    it("produces the NewMeeting that is sent to the server", () => {
        const [draft] = parseOk(entry({ common_tags: ["Meet"] }));
        expect(toNewMeeting(draft)).toEqual({
            title: "A",
            authority: "",
            age_restriction: [0],
            time: Date.UTC(2026, 9, 27, 18, 0),
            place_id: "p1",
            online: null,
            place_to_be_announced: false,
            description: "",
            price: [0],
            trigger_warning: null,
            accessibility: null,
            tags: { freeform: [], common: ["Meet"], queer: ["Everyone"] }
        });
    });

    it("ignores a status in the JSON: the server creates every meeting as planned", () => {
        const [draft] = parseOk(entry({ status: "Active" }));
        expect(draft.warnings).toEqual(['Feld "status" wird nicht unterstützt und ignoriert.']);
        expect(toNewMeeting(draft)).not.toHaveProperty("status");
    });
});

describe("duplicates of stored meetings", () => {
    const warnings = (fields: Record<string, unknown>, existing: Meeting[]) =>
        parseOk(entry(fields), { existing })[0].warnings;
    const hint = (title: string, status = "aktiv") =>
        `Gibt es vielleicht schon: „${title}“, Di., 27.10.2026, 19:00 (${status}).`;

    it("finds a stored meeting with a similar title on the same day", () => {
        const existing = [
            stored({ title: "Queerer Stammtisch", time: Date.UTC(2026, 9, 27, 16, 0) })
        ];
        expect(warnings({ title: "Stammtisch" }, existing)).toEqual([
            "Gibt es vielleicht schon: „Queerer Stammtisch“, Di., 27.10.2026, 17:00 (aktiv)."
        ]);
    });

    it("finds a meeting at the same place within an hour, whatever its title", () => {
        const existing = [stored({ title: "Spieleabend", time: Date.UTC(2026, 9, 27, 18, 45) })];
        expect(warnings({ title: "Brettspiele" }, existing)).toEqual([
            "Gibt es vielleicht schon: „Spieleabend“, Di., 27.10.2026, 19:45 (aktiv)."
        ]);
        // Same place, but more than an hour apart and a different title.
        const later = [stored({ title: "Spieleabend", time: Date.UTC(2026, 9, 27, 20, 0) })];
        expect(warnings({ title: "Brettspiele" }, later)).toEqual([]);
    });

    it("compares online meetings on the same platform (or an unknown one)", () => {
        const onZoom = stored({ title: "Lesekreis", place_id: null, location: null, online: zoom });
        const online = (platform: string) => ({
            place: undefined,
            title: "Bücher",
            online: { platform }
        });
        expect(warnings(online("zoom "), [onZoom])).toEqual([hint("Lesekreis")]);
        expect(warnings(online(""), [onZoom])).toEqual([hint("Lesekreis")]);
        expect(warnings(online("Jitsi"), [onZoom])).toEqual([]);
        expect(warnings({ title: "Bücher" }, [onZoom])).toEqual([]);
    });

    it("compares hybrid meetings by their place and by their platform", () => {
        const onZoom = stored({ title: "Lesekreis", place_id: null, location: null, online: zoom });
        const hybridDraft = { title: "Bücher", online: { platform: "Zoom" } };
        expect(warnings(hybridDraft, [onZoom])).toEqual([hint("Lesekreis")]);
        // A stored hybrid meeting at the same place, on another platform.
        const storedHybrid = stored({ title: "Lesekreis", online: { ...zoom, platform: "Jitsi" } });
        expect(warnings({ title: "Bücher" }, [storedHybrid])).toEqual([hint("Lesekreis")]);
        // Another place and another platform.
        const elsewhere = stored({
            title: "Lesekreis",
            place_id: "p2",
            location: { name: "Kulturpark West", lat: 48.36, lon: 10.87 },
            online: { ...zoom, platform: "Jitsi" }
        });
        expect(warnings(hybridDraft, [elsewhere])).toEqual([]);
    });

    it("compares an unknown JSON place by its name", () => {
        const atBar = stored({
            title: "Treff",
            place_id: "x",
            location: { name: "Neue Bar", lat: 1, lon: 1 }
        });
        // An unknown name has no place id, so the place name is compared.
        expect(warnings({ title: "Anders", place: "neue bar" }, [atBar])).toEqual([hint("Treff")]);
        expect(warnings({ title: "Anders", place: "Alte Bar" }, [atBar])).toEqual([]);
        const legacy = stored({
            title: "Treff",
            place_id: null,
            location: { name: "Neue Bar", lat: 1, lon: 1 }
        });
        expect(warnings({ title: "Anders", place: "neue  bar" }, [legacy])).toEqual([
            hint("Treff")
        ]);
    });

    it("compares a stored place to be announced only by its title", () => {
        // A location left over from before the box was ticked is not compared.
        const announced = stored({
            title: "Sommerfest",
            place_id: null,
            place_to_be_announced: true
        });
        expect(warnings({ title: "Brettspiele" }, [announced])).toEqual([]);
        expect(warnings({ title: "Sommerfest" }, [announced])).toEqual([hint("Sommerfest")]);
        expect(
            warnings({ title: "Sommerfest", place: undefined, place_to_be_announced: true }, [
                announced
            ])
        ).toEqual([hint("Sommerfest")]);
    });

    it("marks cancelled meetings", () => {
        expect(warnings({}, [stored({ cancelled: true })])).toEqual([
            hint("Stammtisch", "abgesagt")
        ]);
    });

    it("finds the same place within an hour across midnight", () => {
        const late = stored({ title: "Party", time: Date.UTC(2026, 9, 27, 22, 30) });
        expect(warnings({ title: "Afterparty", start: "2026-10-28T00:15" }, [late])).toEqual([
            "Gibt es vielleicht schon: „Party“, Di., 27.10.2026, 23:30 (aktiv)."
        ]);
    });

    it("matches stored meetings from before places by their place name", () => {
        const legacy = stored({
            title: "Treff",
            place_id: null,
            location: { name: "café  neruda", lat: 1, lon: 1 }
        });
        expect(warnings({ title: "Anderer Titel" }, [legacy])).toEqual([hint("Treff")]);
    });

    it("names planned meetings and ignores other days and deleted meetings", () => {
        expect(warnings({}, [stored({ status: "Planned" })])).toEqual([
            hint("Stammtisch", "geplant")
        ]);
        expect(warnings({}, [stored({ time: Date.UTC(2026, 9, 28, 18, 0) })])).toEqual([]);
        expect(warnings({}, [stored({ deleted_at: 1 })])).toEqual([]);
        expect(warnings({}, [stored({ time: null })])).toEqual([]);
    });

    it("uses the Berlin day, not the UTC day", () => {
        // 23:30 Berlin on the 27th is the 27th, although it is the 27th 21:30 UTC.
        const lateNight = stored({ title: "Party", time: Date.UTC(2026, 9, 27, 22, 30) });
        expect(warnings({ title: "Party", start: "2026-10-27T19:00" }, [lateNight])).toEqual([
            "Gibt es vielleicht schon: „Party“, Di., 27.10.2026, 23:30 (aktiv)."
        ]);
        // 00:30 Berlin on the 28th is the 27th in UTC, but another day here.
        const afterMidnight = stored({ title: "Party", time: Date.UTC(2026, 9, 27, 23, 30) });
        expect(warnings({ title: "Party", start: "2026-10-27T19:00" }, [afterMidnight])).toEqual(
            []
        );
    });

    it("does not block creating the meeting", () => {
        const [draft] = parseOk(entry({}), { existing: [stored({})] });
        expect(draft.errors).toEqual([]);
        expect(toNewMeeting(draft)).not.toBeNull();
    });
});

describe("drafts like each other", () => {
    it("names exact and similar drafts of the same batch", () => {
        const drafts = parseOk(
            JSON.stringify([
                { title: "Stammtisch", start: "2026-11-03T19:00", place: "Café Neruda" },
                { title: "Stammtisch", start: "2026-11-03T19:00", place: "Café Neruda" },
                { title: "Queerer Stammtisch", start: "2026-11-03T21:00", place: "Thalia" },
                { title: "Spieleabend", start: "2026-11-03T19:30", place: "Café Neruda" },
                { title: "Spieleabend", start: "2026-11-04T19:30", place: "Kulturpark West" }
            ])
        );
        expect(drafts.map((draft) => draft.warnings)).toEqual([
            [],
            ["Gleiches Treffen wie Treffen 1."],
            ["Ähnlich wie Treffen 1."],
            ["Ähnlich wie Treffen 1."],
            []
        ]);
    });
});

describe("draft ids and leaving drafts out", () => {
    const json = (titles: string[]) =>
        JSON.stringify(
            titles.map((title) => ({ title, start: "2026-11-03T19:00", place: "Café Neruda" }))
        );

    it("keeps the ids of unchanged drafts when the JSON changes around them", () => {
        const before = parseOk(json(["A", "B", "C"]));
        const after = parseOk(json(["Neu", "A", "B", "C"]));
        expect(after.slice(1).map((draft) => draft.id)).toEqual(before.map((draft) => draft.id));
        // Changing a draft changes its id.
        const edited = parseOk(json(["A", "B2", "C"]));
        expect(edited[1].id).not.toBe(before[1].id);
    });

    it("gives hybrid drafts their own ids", () => {
        const id = (fields: Record<string, unknown>) => parseOk(entry(fields))[0].id;
        const atPlace = id({});
        const hybrid = id({ online: { platform: "Zoom" } });
        expect(hybrid).not.toBe(atPlace);
        expect(id({ online: { platform: "Jitsi" } })).not.toBe(hybrid);
        expect(id({ online: { platform: "Zoom", link: "https://zoom.us/j/1" } })).not.toBe(hybrid);
        expect(id({ place: undefined, place_to_be_announced: true, online: {} })).not.toBe(
            id({ place: undefined, place_to_be_announced: true })
        );
        // A place named like a venue kind is still a place.
        expect(id({ place: "noPlace", online: {} })).not.toBe(id({ place: undefined, online: {} }));
    });

    it("tells identical drafts apart", () => {
        const [first, second] = parseOk(json(["A", "A"]));
        expect(first.id).not.toBe(second.id);
    });

    it("leaves out exactly the chosen drafts", () => {
        const drafts = parseOk(json(["A", "B", "C"]));
        expect(includedDrafts(drafts, new Set([drafts[1].id])).map((d) => d.fields.title)).toEqual([
            "A",
            "C"
        ]);
        expect(includedDrafts(drafts, new Set(["gone"]))).toHaveLength(3);
    });
});
