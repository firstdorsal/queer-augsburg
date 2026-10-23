// Test data shared by the *.test.ts files (not used by the app).

import type { Meeting } from "./apiTypes/Meeting";
import type { Place } from "./apiTypes/Place";
import { defaultMeetingContent } from "./meetingDefaults";

export const testPlaces: Place[] = [
    { _id: "p1", name: "Café Neruda", lat: 48.3705, lon: 10.8978 },
    { _id: "p2", name: "Kulturpark West", lat: 48.3601, lon: 10.8701 },
    { _id: "p3", name: "Straßenfest Platz", lat: 48.37, lon: 10.9 }
];

/** An active meeting at Café Neruda on Tuesday 27.10.2026, 19:00 Berlin time. */
export const storedMeeting = (overrides: Partial<Meeting> = {}): Meeting => ({
    ...defaultMeetingContent(),
    _id: "m1",
    title: "Stammtisch",
    time: Date.UTC(2026, 9, 27, 18, 0),
    place_id: "p1",
    location: { name: "Café Neruda", lat: 48.3705, lon: 10.8978 },
    online: null,
    attendance: null,
    rating: null,
    status: "Active",
    cancelled: false,
    changed: null,
    deleted_at: null,
    ...overrides
});

export const zoom = { platform: "Zoom", url: null, members_only: true, url_hidden: false };
