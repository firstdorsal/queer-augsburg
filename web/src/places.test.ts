import { describe, expect, it } from "vitest";
import { nameKey as migrationNameKey } from "../../server/migrations/2026-10-21-places/name_key.js";
import migrationPlaces from "../../server/migrations/2026-10-21-places/places.json";
import keyCases from "../../server/src/place_key_cases.json";
import type { InternalMember } from "./apiTypes/InternalMember";
import type { Meeting } from "./apiTypes/Meeting";
import type { MembershipStatus } from "./apiTypes/MembershipStatus";
import type { OnlineMeeting } from "./apiTypes/OnlineMeeting";
import type { Place } from "./apiTypes/Place";
import type { User } from "./apiTypes/User";
import {
    MEETING_FORMATS,
    MEETING_FORMAT_LABELS,
    MeetingFormat,
    chooseFormat,
    comparePlaceNames,
    findPlaceByName,
    inPersonLabel,
    indexPlaces,
    initialFormatState,
    isMeetingFormat,
    joinVenueParts,
    keepsHiddenLink,
    maySeeMembersOnlyLinks,
    meetingVenue,
    meetingVenueText,
    newOnlineMeeting,
    onlineLabel,
    onlineProblem,
    placeChosenText,
    placeNameKey,
    safeHttpUrl,
    trimWhiteSpace,
    venueProblem,
    withPlace
} from "./places";
import { defaultMeeting } from "./utils";

const places = [
    { _id: "a", name: "Henry's Coffee World", lat: 48.369, lon: 10.897 },
    { _id: "b", name: "Café Neruda", lat: 48.37, lon: 10.89 }
];

const online = (overrides: Partial<OnlineMeeting> = {}): OnlineMeeting => ({
    ...newOnlineMeeting(),
    ...overrides
});

const meeting = (overrides: Partial<Meeting>): Meeting => ({ ...defaultMeeting, ...overrides });

describe("placeNameKey", () => {
    it("matches the shared cases (same as the server and the migration)", () => {
        for (const [input, expected] of keyCases.cases) {
            expect(placeNameKey(input), JSON.stringify(input)).toBe(expected);
            expect(migrationNameKey(input), `migration ${JSON.stringify(input)}`).toBe(expected);
        }
    });

    it("matches the keys of the migration places", () => {
        for (const place of migrationPlaces.places) {
            expect(placeNameKey(place.name), place.name).toBe(place.name_key);
        }
    });
});

describe("findPlaceByName", () => {
    it("finds spelling variants of a stored place", () => {
        expect(findPlaceByName(places, "henry‘s coffee world")?._id).toBe("a");
        expect(findPlaceByName(places, "Neruda")).toBeNull();
        expect(findPlaceByName(places, "  ")).toBeNull();
    });
});

describe("indexPlaces", () => {
    const stored: Place[] = [
        { _id: "p1", name: "Café Neruda", lat: 48.3705, lon: 10.8978 },
        { _id: "p2", name: "Straßenfest Platz", lat: 48.37, lon: 10.9 },
        { _id: "h", name: "Henry's Coffee", lat: 1, lon: 1 }
    ];
    const index = indexPlaces(stored);

    it("matches case-, whitespace-, apostrophe- and Unicode-normalization-insensitively", () => {
        expect(index.byName("  café   NERUDA ")?._id).toBe("p1");
        expect(index.byName("Café Neruda".normalize("NFD"))?._id).toBe("p1");
        expect(index.byName("Henry\u{2018}s  coffee")?._id).toBe("h");
    });

    it("matches without accents or with ss for ß when unambiguous", () => {
        expect(index.byName("Cafe Neruda")?._id).toBe("p1");
        expect(index.byName("Strassenfest Platz")?._id).toBe("p2");
    });

    it("does not guess between places that differ only in accents", () => {
        const similar = indexPlaces([
            { _id: "a1", name: "Café A", lat: 1, lon: 1 },
            { _id: "a2", name: "Cafè A", lat: 2, lon: 2 }
        ]);
        expect(similar.byName("Cafe A")).toBeNull();
        expect(similar.byName("Café A")?._id).toBe("a1");
    });

    it("returns null for unknown or empty names and unknown ids", () => {
        expect(index.byName("Neruda")).toBeNull();
        expect(index.byName("   ")).toBeNull();
        expect(index.byId("p2")?.name).toBe("Straßenfest Platz");
        expect(index.byId("gone")).toBeNull();
    });
});

describe("trimWhiteSpace", () => {
    it("trims what Rust's str::trim trims, and not U+FEFF", () => {
        expect(trimWhiteSpace("\u{2028}\u{85}\u{A0} Zoom \u{3000}\t\n")).toBe("Zoom");
        expect(trimWhiteSpace("\u{FEFF}Zoom\u{FEFF}")).toBe("\u{FEFF}Zoom\u{FEFF}");
        expect(trimWhiteSpace("   ")).toBe("");
        expect(trimWhiteSpace("a  b")).toBe("a  b");
    });

    it("stays fast on long runs of spaces inside the text", () => {
        const text = `a${" ".repeat(200_000)}a`;
        const started = performance.now();
        expect(trimWhiteSpace(text)).toBe(text);
        expect(performance.now() - started).toBeLessThan(100);
    });
});

describe("comparePlaceNames / withPlace", () => {
    const place = (_id: string, name: string): Place => ({ _id, name, lat: 1, lon: 1 });

    it("sorts by code points of the name key, like the server", () => {
        const sorted = [
            place("1", "Zoo"),
            place("2", "Ärztehaus"),
            place("3", "café"),
            place("4", "Cafe")
        ].sort(comparePlaceNames);
        expect(sorted.map((p) => p.name)).toEqual(["Cafe", "café", "Zoo", "Ärztehaus"]);
    });

    it("adds a new place in order and never twice", () => {
        const list = [place("a", "Bar"), place("c", "Zoo")];
        expect(withPlace(list, place("b", "Kino")).map((p) => p._id)).toEqual(["a", "b", "c"]);
        expect(withPlace(list, place("c", "Zoo")).map((p) => p._id)).toEqual(["a", "c"]);
        expect(placeChosenText(place("c", "Zoo"), true)).toBe("Bestehenden Ort „Zoo“ ausgewählt.");
        expect(placeChosenText(place("b", "Kino"), false)).toBe("Ort „Kino“ angelegt.");
    });
});

describe("safeHttpUrl", () => {
    it("allows only http(s) links", () => {
        expect(safeHttpUrl("https://zoom.us/j/1?pwd=x")).toBe("https://zoom.us/j/1?pwd=x");
        expect(safeHttpUrl("http://example.org")).toBe("http://example.org/");
        for (const url of [
            "javascript:alert(1)",
            "zoom.us/j/1",
            "mailto:a@b.de",
            "",
            null,
            undefined
        ]) {
            expect(safeHttpUrl(url), String(url)).toBeNull();
        }
    });
});

describe("maySeeMembersOnlyLinks", () => {
    const user = (
        status: MembershipStatus | null,
        capabilities: User["capabilities"] = []
    ): User => ({
        _id: "u",
        capabilities,
        member:
            status === null
                ? null
                : ({ status } as Pick<InternalMember, "status"> as InternalMember)
    });

    it("allows approved members and editors only", () => {
        expect(maySeeMembersOnlyLinks(user("Approved"))).toBe(true);
        expect(maySeeMembersOnlyLinks(user(null, ["UpdateMeetings"]))).toBe(true);
        const others: (MembershipStatus | null)[] = [
            "Pending",
            "Rejected",
            "Left",
            "Expelled",
            null
        ];
        for (const status of others) {
            expect(maySeeMembersOnlyLinks(user(status)), String(status)).toBe(false);
        }
        expect(maySeeMembersOnlyLinks(null)).toBe(false);
    });
});

describe("meetingVenueText / onlineLabel", () => {
    it("formats like the server's iCal feed", () => {
        expect(
            meetingVenueText(meeting({ location: { name: "Café Neruda", lat: 48.37, lon: 10.89 } }))
        ).toBe("Café Neruda: 48.37,10.89");
        expect(meetingVenueText(meeting({ online: online({ platform: "Zoom" }) }))).toBe(
            "Online (Zoom)"
        );
        expect(
            meetingVenueText(
                meeting({
                    online: online({ url: "https://youtube.com/live", members_only: false })
                })
            )
        ).toBe("Online: https://youtube.com/live");
        expect(meetingVenueText(meeting({ online: online({ url: "javascript:x" }) }))).toBe(
            "Online"
        );
        expect(meetingVenueText(meeting({}))).toBe("");
        expect(
            meetingVenueText(
                meeting({ place_to_be_announced: true, location: { name: "Alt", lat: 1, lon: 2 } })
            )
        ).toBe("Ort wird noch bekanntgegeben");
    });

    it("joins both parts of hybrid meetings, as the iCal feed", () => {
        expect(
            meetingVenueText(
                meeting({
                    location: { name: "Café Neruda", lat: 48.37, lon: 10.89 },
                    online: online({ platform: "Zoom" })
                })
            )
        ).toBe("Café Neruda: 48.37,10.89 und Online (Zoom)");
        expect(
            meetingVenueText(
                meeting({
                    place_to_be_announced: true,
                    online: online({ url: "https://zoom.us/j/1", members_only: false })
                })
            )
        ).toBe("Ort wird noch bekanntgegeben und Online: https://zoom.us/j/1");
    });

    it("labels the meeting card", () => {
        expect(onlineLabel(online({ platform: " Zoom " }))).toBe("Online · Zoom");
        expect(onlineLabel(online({ platform: "  " }))).toBe("Online");
    });
});

describe("meetingVenue", () => {
    const neruda = { name: "Café Neruda", lat: 48.37, lon: 10.89 };
    const zoom = online({ platform: "Zoom" });

    it("reads the in-person part and the online part separately", () => {
        expect(meetingVenue(meeting({ online: zoom, location: neruda }))).toEqual({
            inPerson: { kind: "place", location: neruda },
            online: zoom
        });
        expect(meetingVenue(meeting({ location: neruda }))).toEqual({
            inPerson: { kind: "place", location: neruda },
            online: null
        });
        expect(meetingVenue(meeting({ online: zoom }))).toEqual({
            inPerson: { kind: "noPlace" },
            online: zoom
        });
        expect(meetingVenue(meeting({}))).toEqual({ inPerson: { kind: "noPlace" }, online: null });
    });

    it("ignores a location left over next to 'to be announced'", () => {
        // Same as the server's `Meeting::venue`.
        expect(
            meetingVenue(meeting({ place_to_be_announced: true, online: zoom, location: neruda }))
        ).toEqual({ inPerson: { kind: "toBeAnnounced" }, online: zoom });
    });

    it("labels the in-person row of the card", () => {
        const label = (overrides: Partial<Meeting>) =>
            inPersonLabel(meetingVenue(meeting(overrides)));
        expect(label({ location: neruda })).toBe("Café Neruda");
        expect(label({ location: neruda, online: zoom })).toBe("Café Neruda");
        expect(label({ place_to_be_announced: true, online: zoom })).toBe(
            "Ort wird noch bekanntgegeben"
        );
        expect(label({ online: zoom })).toBeNull();
        expect(label({})).toBe("Ort unbekannt");
    });

    it("joins only the parts that exist", () => {
        expect(joinVenueParts(["A", null, "B"])).toBe("A und B");
        expect(joinVenueParts([null, "B"])).toBe("B");
        expect(joinVenueParts([null, null])).toBe("");
    });

    it("tells the format of stored meetings", () => {
        const format = (overrides: Partial<Meeting>) =>
            initialFormatState(meeting(overrides)).format;
        expect(format({ location: neruda, place_id: "b" })).toBe("onSite");
        expect(format({ place_to_be_announced: true })).toBe("onSite");
        expect(format({})).toBe("onSite");
        expect(format({ online: zoom })).toBe("online");
        expect(format({ online: zoom, location: neruda, place_id: "b" })).toBe("hybrid");
        expect(format({ online: zoom, place_to_be_announced: true })).toBe("hybrid");
        // Saving keeps a place without its copied location, so it is hybrid too.
        expect(format({ online: zoom, place_id: "b" })).toBe("hybrid");
    });

    it("has a label for every format and nothing else", () => {
        expect(Object.keys(MEETING_FORMAT_LABELS).sort()).toEqual([...MEETING_FORMATS].sort());
        expect(MEETING_FORMATS.every(isMeetingFormat)).toBe(true);
        for (const value of ["inPerson", "", null, 1]) expect(isMeetingFormat(value)).toBe(false);
    });
});

describe("chooseFormat", () => {
    const atPlace = meeting({
        place_id: "b",
        location: { name: "Café Neruda", lat: 48.37, lon: 10.89 }
    });
    const typed = online({ platform: "Zoom", url: "https://zoom.us/j/1" });
    /** Starts editing `start` and switches through `formats`; returns the last step. */
    const switchFormats = (start: Meeting, ...formats: MeetingFormat[]) =>
        formats.reduce((step, format) => chooseFormat(step.meeting, step.state, format), {
            meeting: start,
            state: initialFormatState(start)
        });

    it("keeps the place for hybrid meetings", () => {
        const hybrid = switchFormats(atPlace, "hybrid");
        expect(hybrid.state.format).toBe("hybrid");
        expect(hybrid.meeting).toEqual({ ...atPlace, online: newOnlineMeeting() });
        expect(venueProblem(hybrid.meeting, "hybrid")).toBeNull();
    });

    it("removes the place for online-only meetings and brings it back", () => {
        const start = { ...atPlace, online: typed };
        const onlineOnly = switchFormats(start, "online");
        expect(onlineOnly.meeting).toEqual({
            ...start,
            place_id: null,
            location: null,
            place_to_be_announced: false
        });
        expect(venueProblem(onlineOnly.meeting, "online")).toBeNull();

        const back = switchFormats(start, "online", "onSite");
        expect(back.meeting).toEqual({ ...atPlace, online: null });
        // The online details come back too.
        expect(switchFormats(start, "online", "onSite", "hybrid").meeting).toEqual(start);
    });

    it("brings back 'to be announced' after online only", () => {
        const announced = { ...atPlace, place_to_be_announced: true, online: typed };
        expect(initialFormatState(announced).format).toBe("hybrid");
        expect(switchFormats(announced, "online").meeting.place_to_be_announced).toBe(false);
        expect(switchFormats(announced, "online", "hybrid").meeting).toEqual(announced);
    });

    it("remembers what the format showed, also an unticked box", () => {
        const fresh = meeting({});
        let step = switchFormats(fresh, "onSite");
        step = { ...step, meeting: { ...step.meeting, place_to_be_announced: true } };
        step = chooseFormat(step.meeting, step.state, "online");
        step = chooseFormat(step.meeting, step.state, "onSite");
        expect(step.meeting.place_to_be_announced).toBe(true);
        // Unticked by hand, then online and back: it stays unticked.
        step = { ...step, meeting: { ...step.meeting, place_to_be_announced: false } };
        step = chooseFormat(step.meeting, step.state, "online");
        step = chooseFormat(step.meeting, step.state, "onSite");
        expect(step.meeting.place_to_be_announced).toBe(false);
        expect(venueProblem(step.meeting, "onSite")).toBe(
            "Bitte einen Ort auswählen oder „Ort wird noch bekanntgegeben“ ankreuzen."
        );
    });

    it("keeps a withheld link through format changes", () => {
        const withheld = online({ platform: "Zoom", url_hidden: true, url: null });
        const start = { ...atPlace, online: withheld };
        expect(switchFormats(start, "onSite", "hybrid").meeting.online).toBe(withheld);
        expect(switchFormats(start, "online").meeting.online).toBe(withheld);
    });

    it("starts new online details the first time", () => {
        const fresh = switchFormats(meeting({}), "online");
        expect(fresh.meeting.online).toEqual(newOnlineMeeting());
        expect(switchFormats(meeting({}), "online", "hybrid").meeting).toMatchObject({
            place_id: null,
            place_to_be_announced: false
        });
    });
});

describe("onlineProblem", () => {
    it("rejects lone surrogates, which the server's JSON parser refuses", () => {
        // Not expressible in the shared JSON fixture.
        expect(onlineProblem({ platform: "Zo\uD800om", url: null })).toBe(
            "Die Plattform enthält unzulässige Steuerzeichen."
        );
    });
});

describe("venueProblem", () => {
    const check = (overrides: Partial<Meeting>, format?: MeetingFormat) => {
        const edited = meeting(overrides);
        return venueProblem(edited, format ?? initialFormatState(edited).format);
    };
    const missing = "Bitte einen Ort auswählen oder „Ort wird noch bekanntgegeben“ ankreuzen.";

    it("requires a place unless the meeting is online only", () => {
        expect(check({})).toBe(missing);
        expect(check({ place_id: "a" })).toBeNull();
        expect(check({ online: online() })).toBeNull();
    });

    it("requires a place for hybrid meetings, which the server cannot tell", () => {
        expect(check({ online: online() }, "hybrid")).toBe(missing);
        expect(check({ online: online(), place_id: "a" }, "hybrid")).toBeNull();
        expect(check({ online: online(), place_to_be_announced: true }, "hybrid")).toBeNull();
    });

    it("accepts a place to be announced, also with online details", () => {
        expect(check({ place_to_be_announced: true })).toBeNull();
        expect(check({ place_to_be_announced: true, online: online() })).toBeNull();
        expect(meetingVenueText(meeting({ place_to_be_announced: true }))).toBe(
            "Ort wird noch bekanntgegeben"
        );
    });

    it("rejects links that are not http(s), before a missing place", () => {
        expect(check({ online: online({ url: "zoom.us/j/1" }) })).toBe(
            "Der Link muss mit https:// oder http:// beginnen."
        );
        expect(check({ online: online({ url: "zoom.us/j/1" }) }, "hybrid")).toBe(
            "Der Link muss mit https:// oder http:// beginnen."
        );
        expect(check({ online: online({ url: "  " }) })).toBeNull();
    });

    it("refuses to publish a withheld link the editor has not seen", () => {
        const withheld = online({ url_hidden: true, url: null, members_only: false });
        expect(keepsHiddenLink(withheld)).toBe(true);
        expect(check({ online: withheld })).toBe(
            "Bitte den gespeicherten Link zuerst anzeigen, bevor er öffentlich gemacht wird."
        );
        expect(check({ online: { ...withheld, members_only: true } })).toBeNull();
        // Loaded or replaced: an empty string means "remove", not "keep".
        expect(keepsHiddenLink({ ...withheld, url: "" })).toBe(false);
        expect(check({ online: { ...withheld, url: "https://zoom.us/j/1" } })).toBeNull();
        // Before a missing place, as on the server.
        expect(check({ online: withheld }, "hybrid")).toBe(
            "Bitte den gespeicherten Link zuerst anzeigen, bevor er öffentlich gemacht wird."
        );
        expect(check({ online: withheld, place_id: "a" }, "hybrid")).toBe(
            "Bitte den gespeicherten Link zuerst anzeigen, bevor er öffentlich gemacht wird."
        );
    });

    it("starts new meetings without a place", () => {
        expect(defaultMeeting.location).toBeNull();
        expect(defaultMeeting.place_id).toBeNull();
        expect(defaultMeeting.online).toBeNull();
    });
});
