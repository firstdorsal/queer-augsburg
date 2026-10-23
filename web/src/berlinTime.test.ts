import { describe, expect, it } from "vitest";
import { berlinDay, berlinLocalTime, berlinOffsetMs, formatBerlinTime } from "./berlinTime";

// vitest.config.ts runs the tests in America/Los_Angeles, so these prove browser independence.
describe("Berlin time", () => {
    it("gives the Berlin calendar day, not the UTC or local one", () => {
        expect(berlinDay(Date.UTC(2026, 9, 27, 22, 30))).toBe("2026-10-27");
        expect(berlinDay(Date.UTC(2026, 9, 27, 23, 30))).toBe("2026-10-28");
        expect(berlinDay(Date.UTC(2026, 6, 1, 21, 59))).toBe("2026-07-01");
        expect(berlinDay(Date.UTC(2026, 6, 1, 22, 0))).toBe("2026-07-02");
    });

    it("formats wall-clock times around daylight saving changes", () => {
        expect(berlinLocalTime(Date.parse("2026-10-25T02:30:00+02:00"))).toBe("2026-10-25T02:30");
        expect(berlinLocalTime(Date.parse("2026-10-25T02:30:00+01:00"))).toBe("2026-10-25T02:30");
        expect(berlinLocalTime(Date.parse("2026-03-29T03:00:00+02:00"))).toBe("2026-03-29T03:00");
        expect(berlinOffsetMs(Date.parse("2026-07-01T12:00:00Z"))).toBe(2 * 3_600_000);
        expect(berlinOffsetMs(Date.parse("2026-12-01T12:00:00Z"))).toBe(3_600_000);
    });

    it("formats meeting times for the dialog", () => {
        expect(formatBerlinTime(Date.UTC(2026, 9, 27, 18, 0))).toBe("Di., 27.10.2026, 19:00");
    });
});
