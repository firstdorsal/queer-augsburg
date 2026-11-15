#!/bin/sh
# Proves that a backup restores: restores a `pg_dump -Fc` file into a throwaway database next
# to the live one and compares the two, the schema (objects, owners, grants) and every table
# (row count and a digest over its rows). Prints table names, counts and equal/DIFFERS, never
# a value. Runs inside qa-pg with the image's tools, as POSTGRES_USER over the socket, against
# POSTGRES_DB (both from the container's environment), from the deployment directory:
#
#     docker exec -i qa-pg sh -s -- /backup/queer-augsburg.pgdump < pg-restore-check.sh
#
# Passes (exit 0) when the dump restores without an error and holds exactly what the live
# database holds. That is the check for a dump taken while nothing writes (the cutover, before
# the server starts). For a dump taken while the server ran, `--live-may-differ` lists the
# tables whose rows changed since and fails only on a failed restore, another schema or
# another migration history (`_sqlx_migrations`). The throwaway database is always dropped.
#
# deployment/tests/postgres.sh runs it on a good dump, after a later write, and on a
# truncated dump.

set -eu

usage() {
    echo "usage: pg-restore-check.sh <dump file> [--live-may-differ]" >&2
    exit 2
}

dump=
live_may_differ=no
for arg in "$@"; do
    case $arg in
        --live-may-differ) live_may_differ=yes ;;
        -*) usage ;;
        *)
            [ -z "$dump" ] || usage
            dump=$arg
            ;;
    esac
done
[ -n "$dump" ] || usage
if [ ! -f "$dump" ]; then
    echo "RESTORE CHECK FAILED: no file $dump"
    exit 1
fi

user=${POSTGRES_USER:?POSTGRES_USER is not set: run this inside qa-pg}
live=${POSTGRES_DB:?POSTGRES_DB is not set: run this inside qa-pg}
check="restore_check_$$"
work=$(mktemp -d)

cleanup() {
    dropdb -U "$user" --if-exists "$check" >/dev/null 2>&1 || true
    rm -rf "$work"
}
trap cleanup EXIT
trap 'exit 1' INT TERM

echo "dump: $dump, $(stat -c '%s bytes, written %y' "$dump")"

# No command below reads stdin: under `sh -s` that is the rest of this script.

createdb -U "$user" "$check" </dev/null
if ! pg_restore --exit-on-error -U "$user" -d "$check" "$dump" </dev/null 2>"$work/restore.err"; then
    # The message part up to the first quote: a quoted part can be a value of a row.
    sed -n 's/^\(pg_restore: error: [^"]*\).*/\1/p' "$work/restore.err" | head -n 5
    echo "RESTORE CHECK FAILED: pg_restore could not restore the dump"
    exit 1
fi
echo "restore: ok"

# The schema of both, without the \restrict lines (pg_dump 18 writes them with a new key every run).
schema() {
    pg_dump -U "$user" -d "$1" --schema-only </dev/null | grep -v -e '^--' -e '^\\restrict ' -e '^\\unrestrict ' -e '^$'
}
schema "$live" >"$work/live.schema"
schema "$check" >"$work/check.schema"
failed=no
if cmp -s "$work/live.schema" "$work/check.schema"; then
    echo "schema: equal"
else
    echo "schema: DIFFERS ($(diff "$work/live.schema" "$work/check.schema" | grep -c '^[<>]') lines)"
    failed=yes
fi

# One line per table: name, row count, md5 over the rows' text in a fixed order.
tables() {
    psql -X -q -t -A -F ' ' -v ON_ERROR_STOP=1 -U "$user" -d "$1" -c "
        SELECT c.relname,
               (xpath('/row/n/text()', x))[1]::text,
               (xpath('/row/d/text()', x))[1]::text
        FROM pg_class c
        CROSS JOIN LATERAL query_to_xml(format(
            'SELECT count(*) AS n, md5(coalesce(string_agg(t::text, E''\n'' ORDER BY t::text), '''')) AS d FROM public.%I t',
            c.relname), false, true, '') AS x
        WHERE c.relnamespace = 'public'::regnamespace AND c.relkind IN ('r', 'p')
        ORDER BY c.relname" </dev/null
}
tables "$live" >"$work/live.tables"
tables "$check" >"$work/check.tables"
if [ ! -s "$work/check.tables" ]; then
    echo "RESTORE CHECK FAILED: the dump holds no table"
    exit 1
fi

echo "tables (live / dump):"
result=$(awk -v live_may_differ="$live_may_differ" '
    FNR == NR { live_n[$1] = $2; live_d[$1] = $3; names[$1] = 1; next }
    { dump_n[$1] = $2; dump_d[$1] = $3; names[$1] = 1 }
    END {
        status = "ok"
        n = 0
        for (name in names) sorted[++n] = name
        for (i = 2; i <= n; i++) {
            v = sorted[i]
            for (j = i - 1; j >= 1 && sorted[j] > v; j--) sorted[j + 1] = sorted[j]
            sorted[j + 1] = v
        }
        for (i = 1; i <= n; i++) {
            name = sorted[i]
            if (!(name in live_n)) { printf "  %-28s only in the dump\n", name; status = "failed"; continue }
            if (!(name in dump_n)) { printf "  %-28s missing in the dump\n", name; status = "failed"; continue }
            if (live_n[name] == dump_n[name] && live_d[name] == dump_d[name]) {
                printf "  %-28s %8s rows  equal\n", name, live_n[name]
                continue
            }
            printf "  %-28s %8s / %s rows  DIFFERS\n", name, live_n[name], dump_n[name]
            if (name == "_sqlx_migrations" || live_may_differ != "yes") status = "failed"
            else if (status == "ok") status = "changed"
        }
        print status > "/dev/stderr"
    }' "$work/live.tables" "$work/check.tables" 2>"$work/status")
echo "$result"
status=$(cat "$work/status")

if [ "$failed" = yes ] || [ "$status" = failed ]; then
    echo "RESTORE CHECK FAILED"
    exit 1
fi
if [ "$status" = changed ]; then
    echo "RESTORE CHECK PASSED: the dump restores; the tables marked DIFFERS changed after it was written"
else
    echo "RESTORE CHECK PASSED: the dump restores and equals the live database"
fi
