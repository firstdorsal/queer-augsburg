import { describe, expect, it } from "vitest";
import { nameKey as migrationNameKey } from "../../server/migrations/2026-10-21-places/name_key.js";
import migrationPlaces from "../../server/migrations/2026-10-21-places/places.json";
import keyCases from "../../server/src/place_key_cases.json";
import type { InternalMember } from "./apiTypes/InternalMember";
import type { Meeting } from "./apiTypes/Meeting";
import type { MembershipStatus } from "./apiTypes/MembershipStatus";
import type { OnlineMeeting } from "./apiTypes/OnlineMeeting";
import type { User } from "./apiTypes/User";
import {
    findPlaceByName,
    keepsHiddenLink,
    maySeeMembersOnlyLinks,
    meetingVenueText,
    newOnlineMeeting,
    onlineLabel,
    placeNameKey,
    safeHttpUrl,
    venueProblem
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
    });

    it("labels the meeting card", () => {
        expect(onlineLabel(online({ platform: " Zoom " }))).toBe("Online · Zoom");
        expect(onlineLabel(online({ platform: "  " }))).toBe("Online");
    });
});

describe("venueProblem", () => {
    it("requires a place unless the meeting is online", () => {
        expect(venueProblem(meeting({}))).toBe(
            "Bitte einen Ort auswählen oder „Online-Treffen“ ankreuzen."
        );
        expect(venueProblem(meeting({ place_id: "a" }))).toBeNull();
        expect(venueProblem(meeting({ online: online() }))).toBeNull();
    });

    it("rejects links that are not http(s)", () => {
        expect(venueProblem(meeting({ online: online({ url: "zoom.us/j/1" }) }))).toBe(
            "Der Link muss mit https:// oder http:// beginnen."
        );
        expect(venueProblem(meeting({ online: online({ url: "  " }) }))).toBeNull();
    });

    it("refuses to publish a withheld link the editor has not seen", () => {
        const withheld = online({ url_hidden: true, url: null, members_only: false });
        expect(keepsHiddenLink(withheld)).toBe(true);
        expect(venueProblem(meeting({ online: withheld }))).toBe(
            "Bitte den gespeicherten Link zuerst anzeigen, bevor er öffentlich gemacht wird."
        );
        expect(venueProblem(meeting({ online: { ...withheld, members_only: true } }))).toBeNull();
        // Loaded or replaced: an empty string means "remove", not "keep".
        expect(keepsHiddenLink({ ...withheld, url: "" })).toBe(false);
        expect(
            venueProblem(meeting({ online: { ...withheld, url: "https://zoom.us/j/1" } }))
        ).toBeNull();
    });

    it("starts new meetings without a place", () => {
        expect(defaultMeeting.location).toBeNull();
        expect(defaultMeeting.place_id).toBeNull();
        expect(defaultMeeting.online).toBeNull();
    });
});
