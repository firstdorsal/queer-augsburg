import { describe, expect, it } from "vitest";
import { calendarDays, formatDateTime, parseDateTime } from "./date-time-picker";

describe("formatDateTime", () => {
    it("pads every part", () => {
        expect(formatDateTime(new Date(2026, 0, 5, 7, 3, 9))).toBe("05.01.2026 07:03:09");
    });
});

describe("calendarDays", () => {
    it("starts on the Monday of the first week", () => {
        // 1 November 2026 is a Sunday.
        const days = calendarDays(2026, 10);
        expect(days[0]).toEqual(new Date(2026, 9, 26));
        expect(days[6]).toEqual(new Date(2026, 10, 1));
    });

    it("always shows six whole weeks", () => {
        expect(calendarDays(2026, 1)).toHaveLength(42);
    });

    it("starts on the first when the month begins on a Monday", () => {
        expect(calendarDays(2026, 5)[0]).toEqual(new Date(2026, 5, 1));
    });
});

describe("parseDateTime", () => {
    it("reads what formatDateTime writes", () => {
        const date = new Date(2026, 11, 3, 19, 0, 5);
        expect(parseDateTime(formatDateTime(date))).toEqual(date);
    });

    it("refuses incomplete text", () => {
        expect(parseDateTime("03.12.2026 19:00")).toBeNull();
    });

    it("refuses dates that do not exist", () => {
        expect(parseDateTime("31.02.2026 19:00:00")).toBeNull();
    });
});
