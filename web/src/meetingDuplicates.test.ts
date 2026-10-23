import { describe, expect, it } from "vitest";
import {
    MeetingCandidate,
    candidateOfMeeting,
    comparableMeetings,
    duplicateWarning,
    meetingStateText,
    possibleDuplicates,
    similarMeetings,
    similarTitles
} from "./meetingDuplicates";
import { storedMeeting as stored, zoom } from "./testFixtures";

describe("similarTitles", () => {
    it.each([
        ["Stammtisch", "stammtisch"],
        ["🌻Queergarten🍻", "Queergarten"],
        ["Café-Abend im Oktober", "Cafe Abend Oktober"],
        ["Straßenfest", "Strassenfest"],
        ["Stammtisch", "Queerer Stammtisch im Oktober"],
        ["Blue meets Queer ", "Blue meets Queer"],
        ["Yoga 18:00", "Yoga 19:00"],
        ["🎃", "🎃"]
    ])("%s ~ %s", (a, b) => {
        expect(similarTitles(a, b)).toBe(true);
        expect(similarTitles(b, a)).toBe(true);
    });

    it.each([
        ["Stammtisch", "Spieleabend"],
        // Shared words that do not tell meetings apart: stop words, the group's name, numbers.
        ["Die", "Die Party"],
        ["Queer", "Queer Brunch"],
        ["Queer Party 2026", "Queer Brunch 2026"],
        ["Queer Stammtisch Augsburg", "Queer Spieleabend Augsburg"],
        // A short shared word is no evidence.
        ["Bar", "Bar Abend"],
        ["IT", "IT-Treff"],
        ["A", "A B C"],
        // One shared word of two is not "mostly the same".
        ["Halloween Party", "Halloween Meet"],
        ["Queerer Stammtisch im Oktober", "Queerer Spieleabend im Oktober"],
        ["🎃", "Halloween"],
        ["", ""]
    ])("%s ≁ %s", (a, b) => {
        expect(similarTitles(a, b)).toBe(false);
        expect(similarTitles(b, a)).toBe(false);
    });
});

const at = (iso: string, overrides: Partial<MeetingCandidate> = {}): MeetingCandidate => ({
    title: "Treffen",
    time: Date.parse(iso),
    placeId: "p1",
    placeName: "Café Neruda",
    onlinePlatform: null,
    ...overrides
});

describe("similarMeetings", () => {
    it("matches the same venue up to an hour apart, also across midnight", () => {
        const late = at("2026-10-27T23:30:00+01:00", { title: "Party" });
        expect(similarMeetings(late, at("2026-10-28T00:30:00+01:00", { title: "Kino" }))).toBe(
            true
        );
        expect(similarMeetings(late, at("2026-10-28T00:31:00+01:00", { title: "Kino" }))).toBe(
            false
        );
        expect(
            similarMeetings(late, at("2026-10-27T23:45:00+01:00", { title: "Kino", placeId: "p2" }))
        ).toBe(false);
    });

    it("matches similar titles on the same Berlin day only", () => {
        const morning = at("2026-10-27T08:00:00+01:00", { title: "Stammtisch", placeId: "p2" });
        expect(
            similarMeetings(morning, at("2026-10-27T23:59:00+01:00", { title: "Stammtisch" }))
        ).toBe(true);
        expect(
            similarMeetings(morning, at("2026-10-28T00:00:00+01:00", { title: "Stammtisch" }))
        ).toBe(false);
    });

    it("uses the Berlin day on daylight saving changes", () => {
        // 25.10.2026 has 25 hours: 00:30 CEST and 23:30 CET are the same day, 24 h apart.
        expect(
            similarMeetings(
                at("2026-10-25T00:30:00+02:00", { title: "Stammtisch", placeId: "p2" }),
                at("2026-10-25T23:30:00+01:00", { title: "Stammtisch" })
            )
        ).toBe(true);
        // 29.03.2026 has 23 hours.
        expect(
            similarMeetings(
                at("2026-03-29T00:30:00+01:00", { title: "Stammtisch", placeId: "p2" }),
                at("2026-03-29T23:30:00+02:00", { title: "Stammtisch" })
            )
        ).toBe(true);
        expect(
            similarMeetings(
                at("2026-03-28T23:30:00+01:00", { title: "Stammtisch", placeId: "p2" }),
                at("2026-03-29T00:30:00+01:00", { title: "Stammtisch" })
            )
        ).toBe(false);
    });

    it("compares online meetings by platform; an unknown platform could be any", () => {
        const online = (platform: string) =>
            at("2026-10-27T19:00:00+01:00", {
                title: platform || "Online",
                placeId: null,
                placeName: null,
                onlinePlatform: platform
            });
        expect(similarMeetings(online("Zoom"), online(" zoom"))).toBe(true);
        expect(similarMeetings(online("Zoom"), online(""))).toBe(true);
        expect(similarMeetings(online("Zoom"), online("Jitsi"))).toBe(false);
        expect(
            similarMeetings(online("Zoom"), at("2026-10-27T19:00:00+01:00", { title: "Party" }))
        ).toBe(false);
    });

    it("compares place names when one side has no stored place", () => {
        const byName = at("2026-10-27T19:00:00+01:00", {
            title: "A",
            placeId: null,
            placeName: "café  NERUDA"
        });
        expect(similarMeetings(byName, at("2026-10-27T19:30:00+01:00", { title: "B" }))).toBe(true);
        expect(
            similarMeetings(
                byName,
                at("2026-10-27T19:30:00+01:00", { title: "B", placeName: "Kino" })
            )
        ).toBe(false);
    });
});

describe("stored meetings", () => {
    it("compares only meetings with a time that are not deleted", () => {
        const meetings = [
            stored(),
            stored({ _id: "t", time: null }),
            stored({ _id: "d", deleted_at: 5 })
        ];
        expect(comparableMeetings(meetings).map((meeting) => meeting._id)).toEqual(["m1"]);
    });

    it("turns stored meetings into candidates", () => {
        const [meeting] = comparableMeetings([stored()]);
        expect(candidateOfMeeting(meeting)).toEqual({
            title: "Stammtisch",
            time: Date.UTC(2026, 9, 27, 18, 0),
            placeId: "p1",
            placeName: "Café Neruda",
            onlinePlatform: null
        });
        const [online] = comparableMeetings([
            stored({ online: zoom, place_id: null, location: null })
        ]);
        expect(candidateOfMeeting(online)).toMatchObject({
            placeId: null,
            placeName: null,
            onlinePlatform: "Zoom"
        });
    });

    it("finds possible duplicates and words the hint with the state", () => {
        const meetings = comparableMeetings([
            stored(),
            stored({ _id: "planned", status: "Planned", title: "Stammtisch Spezial" }),
            stored({
                _id: "other",
                title: "Kino",
                time: Date.UTC(2026, 9, 27, 20, 0),
                place_id: "p2"
            })
        ]);
        const found = possibleDuplicates(
            at("2026-10-27T18:00:00+01:00", { title: "Stammtisch" }),
            meetings
        );
        expect(found.map(duplicateWarning)).toEqual([
            "Gibt es vielleicht schon: „Stammtisch“, Di., 27.10.2026, 19:00 (aktiv).",
            "Gibt es vielleicht schon: „Stammtisch Spezial“, Di., 27.10.2026, 19:00 (geplant)."
        ]);
        expect(meetingStateText(stored({ cancelled: true, status: "Planned" }))).toBe("abgesagt");
    });

    it("stays fast for a full batch against many stored meetings", () => {
        const meetings = comparableMeetings(
            Array.from({ length: 3000 }, (_, i) =>
                stored({
                    _id: `m${i}`,
                    title: `Treffen ${i}`,
                    time: Date.UTC(2026, 0, 1) + i * 3 * 3_600_000
                })
            )
        );
        const started = performance.now();
        for (let i = 0; i < 50; i++) {
            possibleDuplicates(at("2026-06-01T19:00:00+02:00", { title: `Neu ${i}` }), meetings);
        }
        expect(performance.now() - started).toBeLessThan(500);
    });
});
