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

0. **Restore point before the deploy:** tag the running images and back up the meetings
   (below; `places` does not exist yet, and `mongodump` writes no archive for a missing
   collection). After the deploy, editors save meetings under the new rules (online
   meetings without `location`), which the old server cannot read, so only this backup
   plus these images is a complete way back.
1. **Deploy the server** with the places feature (it creates the `places` collection and
   its unique index on startup; the script refuses to run without the index).
2. **Deploy the web app.** It reads old and new meetings. Until the migration, old meetings
   have no `place_id`, so editors have to pick a place when they save one (the editor
   pre-selects the matching place).
3. **Dry-run and apply** (below) once the new web app is live: open tabs of the old app
   cannot show online meetings without a location and show an error until they are
   reloaded; the service worker (`autoUpdate`) reloads them on the next visit.

Root's login shell on turing is fish: run every block through `bash -s` as shown. The
qa-db container listens on 27030 (the repo default in `deployment/config.yml` is 27018);
the root password is the container's `MONGODB_ROOT_PASSWORD`, so keep the single quotes.

### 0. Restore point

```sh
ssh root@turing 'bash -s' <<'EOF'
set -euo pipefail
docker tag "$(docker inspect --format '{{.Image}}' qa-server)" firstdorsal/queer-augsburg-server:pre-places
docker tag "$(docker inspect --format '{{.Image}}' qa-web)" firstdorsal/queer-augsburg-web:pre-places
docker exec qa-db sh -c 'mongodump --quiet --port 27030 -u root -p "$MONGODB_ROOT_PASSWORD" --authenticationDatabase admin --db queer-augsburg --collection meetings --gzip --archive=/tmp/meetings-before-places-deploy.gz'
docker cp qa-db:/tmp/meetings-before-places-deploy.gz /mnt/beta/backup/
docker exec qa-db rm /tmp/meetings-before-places-deploy.gz
chmod 600 /mnt/beta/backup/meetings-before-places-deploy.gz
ls -l /mnt/beta/backup/meetings-before-places-deploy.gz   # must not be empty
EOF
```

### 3. Migration

Copy the directory of the deployed commit fresh (a leftover copy would be nested inside,
not replaced), take a second backup right before the migration, and dry-run:

```sh
ssh root@turing 'rm -rf /tmp/places-migration'
scp -r server/migrations/2026-10-21-places root@turing:/tmp/places-migration
sha256sum server/migrations/2026-10-21-places/*.js server/migrations/2026-10-21-places/*.json

ssh root@turing 'bash -s' <<'EOF'
set -euo pipefail
sha256sum /tmp/places-migration/*.js /tmp/places-migration/*.json   # must match the above
docker exec qa-db rm -rf /tmp/places-migration
docker cp /tmp/places-migration qa-db:/tmp/places-migration
docker exec qa-db sh -c 'mongodump --quiet --port 27030 -u root -p "$MONGODB_ROOT_PASSWORD" --authenticationDatabase admin --db queer-augsburg --collection meetings --gzip --archive=/tmp/meetings-before-places.gz'
docker cp qa-db:/tmp/meetings-before-places.gz /mnt/beta/backup/
docker exec qa-db rm /tmp/meetings-before-places.gz
chmod 600 /mnt/beta/backup/meetings-before-places.gz
ls -l /mnt/beta/backup/meetings-before-places.gz
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

(numbers from the public list of 2026-10-21; planned meetings and meetings saved since the
deploy change them). Then apply, and run the same command once more: `places to insert`,
`assign to a place` and `mark online` must then be 0; the unresolved meetings are listed
again by design.

```sh
ssh root@turing 'bash -s' <<'EOF'
set -euo pipefail
for run in 1 2; do
    docker exec qa-db sh -c 'mongosh --quiet --port 27030 -u root -p "$MONGODB_ROOT_PASSWORD" --authenticationDatabase admin queer-augsburg --eval "var MIGRATION_DIR=\"/tmp/places-migration\"; var APPLY=true" --file /tmp/places-migration/migrate.js'
done
EOF
```

The first run additionally prints `meetings modified: N (planned N)`.

### Verify

```sh
ssh root@turing 'bash -s' <<'EOF'
docker exec qa-db sh -c 'mongosh --quiet --port 27030 -u root -p "$MONGODB_ROOT_PASSWORD" --authenticationDatabase admin queer-augsburg --eval "
print(\"places: \" + db.places.countDocuments());
print(\"unique index: \" + db.places.getIndexes().some(i => i.unique));
print(\"online meetings with a location (must be 0): \" + db.meetings.countDocuments({online: {\$ne: null}, location: {\$ne: null}}));
print(\"meetings without place, not online, not to be announced: \" + db.meetings.countDocuments({place_id: null, online: null, place_to_be_announced: {\$ne: true}}));
"'
docker cp qa-db:/tmp/places-migration/report.json /tmp/places-report.json
docker exec qa-db rm -rf /tmp/places-migration
rm -rf /tmp/places-migration
EOF
```

Then on the website: an online meeting shows "Online · Zoom", a meeting at a place shows
its name with the map links, and the editor's place dropdown lists the places.

### Rollback

**Only the migration** (server and web stay): restore the backup taken right before it.
This reverts every meeting edit made since that backup.

```sh
ssh root@turing 'bash -s' <<'EOF'
docker cp /mnt/beta/backup/meetings-before-places.gz qa-db:/tmp/meetings-before-places.gz
docker exec qa-db sh -c 'mongorestore --quiet --port 27030 -u root -p "$MONGODB_ROOT_PASSWORD" --authenticationDatabase admin --nsInclude=queer-augsburg.meetings --drop --gzip --archive=/tmp/meetings-before-places.gz'
# remove only the places this migration created (places created in the editor stay)
docker exec qa-db sh -c 'mongosh --quiet --port 27030 -u root -p "$MONGODB_ROOT_PASSWORD" --authenticationDatabase admin queer-augsburg --eval "db.places.deleteMany({\"created.by\": \"migration-2026-10-21-places\"})"'
EOF
```

**The whole feature** (back to the server and web from before the deploy): older servers
cannot read meetings without a location, so restore the meetings of step 0 (this reverts
every meeting edit since the deploy) and start the tagged images. The `places` collection
can stay: the old server never reads it, and a later redeploy finds the places again. The
compose file uses `:latest`, so retag before recreating:

```sh
ssh root@turing 'bash -s' <<'EOF'
set -euo pipefail
docker cp /mnt/beta/backup/meetings-before-places-deploy.gz qa-db:/tmp/meetings-before-places-deploy.gz
docker exec qa-db sh -c 'mongorestore --quiet --port 27030 -u root -p "$MONGODB_ROOT_PASSWORD" --authenticationDatabase admin --nsInclude=queer-augsburg.meetings --drop --gzip --archive=/tmp/meetings-before-places-deploy.gz'
docker exec qa-db rm /tmp/meetings-before-places-deploy.gz
docker tag firstdorsal/queer-augsburg-server:pre-places firstdorsal/queer-augsburg-server:latest
docker tag firstdorsal/queer-augsburg-web:pre-places firstdorsal/queer-augsburg-web:latest
cd /mnt/alpha/manifest/server/public/queer-augsburg/deployment/results
docker compose -p results up -d --no-deps qa-server qa-web
EOF
```
