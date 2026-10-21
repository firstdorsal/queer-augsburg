// Places migration 2026-10-21 (mongosh). See README.md in this directory.
//
// 1. Inserts the places of places.json (a name that already exists is reused).
// 2. Gives every not yet migrated meeting a place_id + location copied from its place, or
//    marks it as an online meeting (no location). The assignment comes from
//    meeting-assignments.json (inferred from the texts of the old "Augsburg" placeholder
//    meetings), otherwise from the meeting's current place name via the alias table.
// 3. Meetings that cannot be assigned stay unchanged. They, and online meetings whose text
//    still contains a link, are written to report.json for the board.
//
// Everything is resolved and checked before the first write. Dry run by default.
// Idempotent: a second run changes nothing (and reports the same unresolved meetings).
//
// MIGRATION_DIR and APPLY are mongosh globals set with --eval, see README.md.

/* global db, Long, Double, MIGRATION_DIR, APPLY, print */
const fs = require("fs");
const path = require("path");

const dir = typeof MIGRATION_DIR === "string" ? MIGRATION_DIR : ".";
const apply = typeof APPLY !== "undefined" && APPLY === true;
const read = (file) => JSON.parse(fs.readFileSync(path.join(dir, file), "utf8"));
const { nameKey } = require(path.join(dir, "name_key.js"));
const { places } = read("places.json");
const assignmentFile = read("meeting-assignments.json");

const MIGRATED_BY = "migration-2026-10-21-places";
const now = Long.fromNumber(Date.now());
// Location names that meant "online" before online meetings existed.
const ONLINE_NAMES = new Map([
    ["zoom", "Zoom"],
    ["discord", "Discord"],
    ["jitsi", "Jitsi"]
]);
// "Online" was the inferred platform when a text only said "digital"/"online".
const platformName = (platform) => (platform.toLowerCase() === "online" ? "" : platform);
const LINK = /https?:\/\/\S+/i;

print(`Mode: ${apply ? "APPLY" : "DRY RUN (pass APPLY=true to write)"}`);

// --- preconditions --------------------------------------------------------------------
const hasUniqueIndex = db.places
    .getIndexes()
    .some((index) => index.unique && JSON.stringify(index.key) === JSON.stringify({ name_key: 1 }));
if (!hasUniqueIndex) {
    throw new Error("places.name_key unique index missing: start the new server first");
}

// --- 1. places (plan) -----------------------------------------------------------------
const placeByKey = new Map(); // name_key -> place document (existing or to insert)
const placeIdFromFile = new Map(); // _id in places.json -> _id in the database
const placesToInsert = [];
for (const place of places) {
    if (nameKey(place.name) !== place.name_key) {
        throw new Error(`name_key mismatch for ${place.name}`);
    }
    const existing = db.places.findOne({ name_key: place.name_key });
    const document = existing ?? {
        _id: place._id,
        name: place.name,
        name_key: place.name_key,
        lat: Double(place.lat),
        lon: Double(place.lon),
        created: { by: MIGRATED_BY, at: now }
    };
    if (!existing) placesToInsert.push(document);
    placeByKey.set(place.name_key, document);
    placeIdFromFile.set(place._id, document._id);
}
const placeById = new Map([...placeByKey.values()].map((place) => [place._id, place]));
const aliases = new Map(
    Object.entries(assignmentFile.aliases).map(([from, to]) => [nameKey(from), to])
);
const assignments = new Map(Object.entries(assignmentFile.meetings));

// --- 2. meetings (plan) ---------------------------------------------------------------
const resolve = (meeting) => {
    const explicit = assignments.get(meeting._id);
    if (explicit && explicit.place) {
        const place = placeById.get(placeIdFromFile.get(explicit.place));
        if (!place) throw new Error(`assignment of ${meeting._id}: unknown place ${explicit.place}`);
        return { kind: "place", place };
    }
    if (explicit && explicit.online) return { kind: "online", platform: explicit.online };
    if (explicit && explicit.unknown) return { kind: "unknown", reason: explicit.unknown };

    const name = ((meeting.location && meeting.location.name) || "").trim();
    const key = nameKey(name);
    if (ONLINE_NAMES.has(key)) return { kind: "online", platform: ONLINE_NAMES.get(key) };
    const place = placeByKey.get(nameKey(aliases.get(key) ?? name));
    if (place) return { kind: "place", place };
    return { kind: "unknown", reason: `no place for location name "${name}"` };
};

const unmigrated = { place_id: { $in: [null] }, online: { $in: [null] } };
const operations = [];
const unresolved = [];
const linksInText = [];
let alreadyMigrated = 0;
// Join links typed into the public text of online meetings: the board should move them
// into the (members-only) link field or remove them.
const reportLinkInText = (meeting) => {
    const match = `${meeting.title}\n${meeting.description}`.match(LINK);
    if (match) linksInText.push({ _id: meeting._id, title: meeting.title, link: match[0] });
};
let toPlace = 0;
db.meetings.find({}).forEach((meeting) => {
    if (meeting.online || meeting.place_id) {
        alreadyMigrated++; // migrated before or saved with the new editor
        if (meeting.online) reportLinkInText(meeting);
        return;
    }
    const target = resolve(meeting);
    if (target.kind === "unknown") {
        unresolved.push({
            _id: meeting._id,
            status: meeting.status,
            title: meeting.title,
            location: meeting.location && meeting.location.name,
            reason: target.reason
        });
        return;
    }
    const set =
        target.kind === "place"
            ? {
                  place_id: target.place._id,
                  location: {
                      name: target.place.name,
                      lat: target.place.lat,
                      lon: target.place.lon
                  }
              }
            : {
                  place_id: null,
                  location: null,
                  online: { platform: platformName(target.platform), url: null, members_only: true }
              };
    if (target.kind === "place") toPlace++;
    if (target.kind === "online") reportLinkInText(meeting);
    operations.push({
        updateOne: {
            // Skips a meeting that was saved with the new editor in the meantime.
            filter: { _id: meeting._id, ...unmigrated },
            // Pipeline update: `changed` is null in some old documents, which $push rejects.
            // The changed entry makes delta sync deliver the migrated meeting to clients.
            // $literal keeps values that start with "$" from being read as expressions.
            update: [
                {
                    $set: {
                        ...Object.fromEntries(
                            Object.entries(set).map(([field, value]) => [field, { $literal: value }])
                        ),
                        changed: {
                            $concatArrays: [
                                { $ifNull: ["$changed", []] },
                                [{ $literal: { by: MIGRATED_BY, at: now } }]
                            ]
                        }
                    }
                }
            ]
        }
    });
});

print(`places to insert: ${placesToInsert.length} (of ${places.length}, others exist already)`);
print(`meetings to assign to a place: ${toPlace}`);
print(`meetings to mark online: ${operations.length - toPlace}`);
print(`meetings already migrated: ${alreadyMigrated}`);
print(`meetings without a known place (unchanged): ${unresolved.length}`);
print(`online meetings whose text contains a link: ${linksInText.length}`);

// --- 3. write -------------------------------------------------------------------------
if (apply) {
    if (placesToInsert.length > 0) db.places.insertMany(placesToInsert, { ordered: true });
    if (operations.length > 0) {
        const result = db.meetings.bulkWrite(operations, { ordered: true });
        print(`meetings modified: ${result.modifiedCount} (planned ${operations.length})`);
        if (result.modifiedCount !== operations.length) {
            print("WARNING: some meetings changed during the run; run the script again");
        }
    }
}

const reportFile = path.join(dir, "report.json");
fs.writeFileSync(
    reportFile,
    JSON.stringify({ mode: apply ? "apply" : "dry-run", unresolved, linksInText }, null, 2)
);
print(`report: ${reportFile}`);
