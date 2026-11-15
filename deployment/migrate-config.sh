#!/usr/bin/env bash
# Prints the migrator's configuration (server/migrate.example.yml) for a dump in the backup
# volume, with the expected counts taken from the live MongoDB right now: the count query of
# the runbook, never the dump itself, so a dump that lost or gained documents does not
# migrate. Run it right after the dump, while nothing writes (the cutover), or run the
# rehearsal again if a write came in between. Counts are numbers only.
#
#     bash migrate-config.sh <mongo container> <dump directory name> >migrate.yml
#
# The dump is `mongodump --db queer-augsburg --out /backup/<dump directory name>` (README
# "The Postgres cutover"); the migrator's container sees the backup volume at /backup.
# Fields that may go (`ignored_fields`, see the example) are added to the file by hand.

set -euo pipefail

if [ "$#" != 2 ]; then
    echo "usage: migrate-config.sh <mongo container> <dump directory name>" >&2
    exit 2
fi
container=$1
dump=$2
if ! printf %s "$dump" | grep -Eqx '[A-Za-z0-9._-]+'; then
    echo "not a directory name: '$dump'" >&2
    exit 2
fi

# Every collection the migrator knows (server/src/migrate: COLLECTIONS); it refuses a
# configuration that leaves one out.
collections='users originalUsers places meetings sent_email_logs email_drafts documents document_groups document_group_order document_versions'

# The port and the root password come from the container's environment (compose sets
# MONGODB_PORT_NUMBER and MONGODB_ROOT_PASSWORD for qa-db).
counts=$(docker exec "$container" bash -c '
    mongosh --quiet --port "${MONGODB_PORT_NUMBER:?}" -u root -p "$MONGODB_ROOT_PASSWORD" \
        --authenticationDatabase admin queer-augsburg --eval "
        \"$1\".split(\" \").forEach(c => print(c + \": \" + db.getCollection(c).countDocuments()))"
' bash "$collections")

lines=0
for name in $collections; do
    value=$(printf '%s\n' "$counts" | sed -n "s/^$name: //p")
    if ! printf %s "$value" | grep -Eqx '[0-9]+'; then
        echo "no count for $name" >&2
        exit 1
    fi
    lines=$((lines + 1))
done
[ "$lines" = 10 ] || { echo "expected 10 collections" >&2; exit 1; }

echo "# Written by deployment/migrate-config.sh at $(date -u +%Y-%m-%dT%H:%M:%SZ) from the live counts."
echo "dump_dir: /backup/$dump"
echo "database: queer-augsburg"
echo "expected_counts:"
for name in $collections; do
    echo "    $name: $(printf '%s\n' "$counts" | sed -n "s/^$name: //p")"
done
