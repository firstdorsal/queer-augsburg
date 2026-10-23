// Europe/Berlin wall-clock time, independent of the browser's time zone.

export const TIME_ZONE = "Europe/Berlin";
export const HOUR_MS = 3_600_000;
export const DAY_MS = 24 * HOUR_MS;

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

const meetingTimeFormat = new Intl.DateTimeFormat("de-DE", {
    timeZone: TIME_ZONE,
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
});

export interface WallClock {
    readonly year: number;
    readonly month: number;
    readonly day: number;
    readonly hour: number;
    readonly minute: number;
    readonly second: number;
}

export const berlinWallClock = (utcMs: number): WallClock => {
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

/** Berlin's offset from UTC at this instant (one or two hours). */
export const berlinOffsetMs = (utcMs: number): number => {
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

export const pad = (value: number) => String(value).padStart(2, "0");

/** The Berlin calendar day, e.g. "2026-10-27". */
export const berlinDay = (utcMs: number): string => {
    const wall = berlinWallClock(utcMs);
    return `${wall.year}-${pad(wall.month)}-${pad(wall.day)}`;
};

/** "2026-10-27T19:00", the format of the import's "start". */
export const berlinLocalTime = (utcMs: number): string => {
    const wall = berlinWallClock(utcMs);
    return `${berlinDay(utcMs)}T${pad(wall.hour)}:${pad(wall.minute)}`;
};

/** "Di., 27.10.2026, 19:00". */
export const formatBerlinTime = (utcMs: number): string => meetingTimeFormat.format(utcMs);
