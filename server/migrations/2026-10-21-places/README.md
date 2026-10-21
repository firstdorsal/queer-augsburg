# Migration 2026-10-21: places

Turns the free-text locations of v1 meetings into the `places` collection and fills in the
place (or "online") of the meetings that the old importer had stored with the placeholder
"Augsburg".

| File | Content |
|---|---|
| `places.json` | The places to create. Spelling variants are merged ("Henry‘s Coffee" → "Henry's Coffee World", "ProjektRaum" → "Projektraum Rechts-der-Wertach"). `source` says where the coordinates come from: the builtin list, existing meetings, or OpenStreetMap Nominatim (query → matched object) for places that only had 0/0 or the Augsburg city centre. |
| `meeting-assignments.json` | Per meeting: place id, online platform, or unknown, with a short quote from the meeting text as evidence. Derived from the public meeting list (active meetings) of 2026-10-21. Other meetings (planned ones, newer ones) are resolved by their current place name via `aliases`. |
| `migrate.js` | The mongosh script. Dry run by default; checks everything before the first write; idempotent. |
| `name_key.js` | Place name normalization, identical to the server's (`place_key_cases.json` tests all copies). |

What the script does not change: meetings it cannot assign keep their old location. They,
and online meetings whose public text contains a join link, are listed in `report.json`
for the board. A meeting without a place has to get one when it is edited next (the editor
shows the old name as "Bisheriger Ort").

Online meetings are migrated as members-only without a link (`url: null`): the old links
were never stored separately. Links that editors had typed into the description stay in the
description; `report.json` lists them so they can be removed or moved into the link field.

## Order on turing

1. **Deploy the server** with the places feature (it creates the `places` collection and
   its unique index on startup; the script refuses to run without the index).
2. **Deploy the web app.** It reads old and new meetings. Old cached web apps cannot show
   online meetings without a location, so give the service worker a day to update clients.
3. **Back up, dry-run, apply** (below).

Root's login shell on turing is fish: run every block through `bash -s` as shown. The
qa-db container listens on 27030 (the repo default in `deployment/config.yml` is 27018);
the root password is the container's `MONGODB_ROOT_PASSWORD`, so keep the single quotes.

```sh
# copy the migration directory from a checkout of this branch to turing
scp -r server/migrations/2026-10-21-places root@turing:/tmp/places-migration

ssh root@turing 'bash -s' <<'EOF'
set -euo pipefail
# 1. backup of meetings and places (places may not exist yet; that is fine)
docker exec qa-db sh -c 'mongodump --quiet --port 27030 -u root -p "$MONGODB_ROOT_PASSWORD" --authenticationDatabase admin --db queer-augsburg --collection meetings --gzip --archive=/tmp/meetings-before-places.gz'
docker exec qa-db sh -c 'mongodump --quiet --port 27030 -u root -p "$MONGODB_ROOT_PASSWORD" --authenticationDatabase admin --db queer-augsburg --collection places --gzip --archive=/tmp/places-before-places.gz'
docker cp qa-db:/tmp/meetings-before-places.gz /mnt/beta/backup/
docker cp qa-db:/tmp/places-before-places.gz /mnt/beta/backup/
chmod 600 /mnt/beta/backup/*-before-places.gz
ls -l /mnt/beta/backup/*-before-places.gz   # both must exist and not be empty
docker exec qa-db rm /tmp/meetings-before-places.gz /tmp/places-before-places.gz

# 2. dry run
docker cp /tmp/places-migration qa-db:/tmp/places-migration
docker exec qa-db sh -c 'mongosh --quiet --port 27030 -u root -p "$MONGODB_ROOT_PASSWORD" --authenticationDatabase admin queer-augsburg --eval "var MIGRATION_DIR=\"/tmp/places-migration\"; var APPLY=false" --file /tmp/places-migration/migrate.js'
EOF
```

The dry run prints what it would do, e.g.

```
places to insert: 84 (of 84, others exist already)
meetings to assign to a place: 319
meetings to mark online: 118
meetings already migrated: 0
meetings without a known place (unchanged): 20
online meetings whose text contains a link: 17
```

(numbers from the public list of 2026-10-21; planned meetings add to them). Then apply with
the same mongosh command and `APPLY=true`. It additionally prints
`meetings modified: N (planned N)`. Run it once more: `places to insert`, `assign to a place`
and `mark online` must be 0; the unresolved meetings are listed again by design.

### Verify

```sh
ssh root@turing 'bash -s' <<'EOF'
docker exec qa-db sh -c 'mongosh --quiet --port 27030 -u root -p "$MONGODB_ROOT_PASSWORD" --authenticationDatabase admin queer-augsburg --eval "
print(\"places: \" + db.places.countDocuments());
print(\"unique index: \" + db.places.getIndexes().some(i => i.unique));
print(\"online meetings with a location (must be 0): \" + db.meetings.countDocuments({online: {\$ne: null}, location: {\$ne: null}}));
print(\"meetings without place and not online: \" + db.meetings.countDocuments({place_id: null, online: null}));
"'
docker cp qa-db:/tmp/places-migration/report.json /tmp/places-report.json
docker exec qa-db rm -rf /tmp/places-migration
EOF
```

Then on the website: an online meeting shows "Online · Zoom", a meeting at a place shows
its name with the map links, and the editor's place dropdown lists the places.

### Rollback

Restoring the backup reverts every meeting edit made since the backup was taken.

```sh
ssh root@turing 'bash -s' <<'EOF'
docker cp /mnt/beta/backup/meetings-before-places.gz qa-db:/tmp/meetings-before-places.gz
docker exec qa-db sh -c 'mongorestore --quiet --port 27030 -u root -p "$MONGODB_ROOT_PASSWORD" --authenticationDatabase admin --nsInclude=queer-augsburg.meetings --drop --gzip --archive=/tmp/meetings-before-places.gz'
# remove only the places this migration created (places created in the editor stay)
docker exec qa-db sh -c 'mongosh --quiet --port 27030 -u root -p "$MONGODB_ROOT_PASSWORD" --authenticationDatabase admin queer-augsburg --eval "db.places.deleteMany({\"created.by\": \"migration-2026-10-21-places\"})"'
EOF
```

A server rollback to a version before the places feature additionally needs this restore:
older servers cannot read meetings without a location.
