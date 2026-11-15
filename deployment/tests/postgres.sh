#!/usr/bin/env bash
# The qa-pg database as production sets it up, checked end to end: runs inside the postgres
# image of qa-pg (CI job `test-deployment`), or by hand from the repository root:
#
#     docker run --rm --name qa-pg-test -v "$PWD":/src:ro postgres:18.6-alpine \
#         bash /src/deployment/tests/postgres.sh
#
# 1. The image and the environment of qa-pg come from deployment/templates/docker-compose.yml,
#    and the server is started by the image's own entrypoint with config/pg-init.sql as
#    10-roles.sql, exactly as compose mounts it.
# 2. qa_app logs in with its password over the network (scram) and nothing else may connect.
# 3. qa_app applies server/migrations-sql/ the way the server does (sqlx: its bookkeeping
#    table, one transaction per file), then a later migration of the kinds the auth half
#    plans (ALTER TYPE, ALTER TABLE, CREATE INDEX, a foreign key): it owns the schema, so it
#    can. pg-owner-check.sql passes.
# 4. Negative control: the same schema applied by qa_owner (the old cutover path) makes the
#    later migration fail with "must be owner" and pg-owner-check.sql fail.
# 5. The backup: the backup-qa-pg command of config/ofelia.conf writes the dump,
#    pg-restore-check.sh restores it and finds it equal; after a later write it fails, and
#    passes with --live-may-differ; a truncated dump fails. A restore into the live database
#    as the README describes it keeps every owner.
# 6. pg-init.sql refuses an app password the URL in qa-server.yml cannot carry, and the
#    healthcheck of qa-pg does not call the entrypoint's socket-only init server healthy.

set -euo pipefail

ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)
DEPLOYMENT=$ROOT/deployment
TEMPLATE=$DEPLOYMENT/templates/docker-compose.yml

fail() {
    echo "FAIL: $*" >&2
    exit 1
}
pass() {
    echo "ok: $*"
}

# A value of the qa-pg service in the compose template (`key: value`, first match).
qa_pg_value() {
    awk -v key="$1" '
        /^    qa-pg:$/ { inside = 1; next }
        inside && /^    [a-z]/ { exit }
        inside {
            line = $0
            sub(/^ +/, "", line)
            if (index(line, key ": ") == 1) {
                value = substr(line, length(key) + 3)
                gsub(/^"|"$/, "", value)
                print value
                exit
            }
        }' "$TEMPLATE"
}

# How long a start of the entrypoint (initdb, the init scripts, the server) may take before the
# test gives up. It waits for a state, not for a time: the server answering, or the entrypoint
# ending. Under heavy IO load (about 90 % in /proc/pressure/io) initdb alone took more than the
# 120 s an earlier bound allowed, while the same start takes under a minute otherwise (46 s
# measured on the rerun); 900 s is far beyond either and is reached only by a hang.
START_SECONDS=900

alnum() {
    local out=""
    while [ "${#out}" -lt "$1" ]; do
        out+=$(head -c 256 /dev/urandom | LC_ALL=C tr -dc 'A-Za-z0-9')
    done
    printf %s "${out:0:$1}"
}

# --- 1. image, environment and init exactly as the template --------------------------------

image=$(qa_pg_value image)
[ -n "$image" ] || fail "no image for qa-pg in $TEMPLATE"
want_version=${image#postgres:}
want_version=${want_version%-alpine}
have_version=$(postgres --version | awk '{ print $3 }')
[ "$have_version" = "$want_version" ] ||
    fail "this runs postgres $have_version, the template pins $image: run the test in that image"
pass "postgres $have_version is the image of qa-pg ($image)"

POSTGRES_USER=$(qa_pg_value POSTGRES_USER)
POSTGRES_DB=$(qa_pg_value POSTGRES_DB)
POSTGRES_INITDB_ARGS=$(qa_pg_value POSTGRES_INITDB_ARGS)
[ "$POSTGRES_USER" = qa_owner ] || fail "POSTGRES_USER of qa-pg is '$POSTGRES_USER', not qa_owner"
[ "$POSTGRES_DB" = queer-augsburg ] || fail "POSTGRES_DB of qa-pg is '$POSTGRES_DB'"
[ -n "$POSTGRES_INITDB_ARGS" ] || fail "no POSTGRES_INITDB_ARGS for qa-pg"
grep -q './config/pg-init.sql:/docker-entrypoint-initdb.d/10-roles.sql:ro' "$TEMPLATE" ||
    fail "qa-pg no longer mounts config/pg-init.sql as 10-roles.sql"
POSTGRES_PASSWORD=$(alnum 64)
POSTGRES_APP_PASSWORD=$(alnum 64)
export POSTGRES_USER POSTGRES_DB POSTGRES_INITDB_ARGS POSTGRES_PASSWORD POSTGRES_APP_PASSWORD

mkdir -p /docker-entrypoint-initdb.d /backup
cp "$DEPLOYMENT/templates/config/pg-init.sql" /docker-entrypoint-initdb.d/10-roles.sql

docker-entrypoint.sh postgres >/tmp/postgres.log 2>&1 &
server_pid=$!
stop_server() {
    kill "$server_pid" 2>/dev/null || true
    wait "$server_pid" 2>/dev/null || true
}
trap stop_server EXIT

# The entrypoint runs the init scripts on a socket-only server first; the real one listens
# on every address. Loopback is `trust` in the image, so password logins go to this address.
ADDRESS=$(hostname -i | awk '{ print $1 }')
deadline=$((SECONDS + START_SECONDS))
until pg_isready -q -h "$ADDRESS" -U qa_owner -d "$POSTGRES_DB"; do
    kill -0 "$server_pid" 2>/dev/null || { cat /tmp/postgres.log >&2; fail "the entrypoint stopped"; }
    [ "$SECONDS" -lt "$deadline" ] || { cat /tmp/postgres.log >&2; fail "postgres did not come up within $START_SECONDS s"; }
    sleep 0.5
done
grep -q 'running /docker-entrypoint-initdb.d/10-roles.sql' /tmp/postgres.log ||
    fail "the entrypoint did not run 10-roles.sql"
pass "the image's entrypoint initialised the cluster and ran pg-init.sql"

# The healthcheck of qa-pg, as compose runs it (CMD-SHELL).
HEALTHCHECK=$(sed -n 's/^ *test: \["CMD-SHELL", "\(pg_isready [^"]*\)"\]$/\1/p' "$TEMPLATE")
[ -n "$HEALTHCHECK" ] || fail "no pg_isready healthcheck for qa-pg in $TEMPLATE"
sh -c "$HEALTHCHECK" >/dev/null || fail "the healthcheck fails on the running server"
pass "the healthcheck of qa-pg passes on the running server"

owner_sql() { psql -X -q -t -A -v ON_ERROR_STOP=1 -U qa_owner "$@"; }
app_sql() {
    PGPASSWORD=$POSTGRES_APP_PASSWORD psql -X -q -t -A -v ON_ERROR_STOP=1 \
        -h "$ADDRESS" -U qa_app "$@"
}

[ "$(owner_sql -d "$POSTGRES_DB" -c "SELECT datlocprovider::text || ' ' || datlocale FROM pg_database WHERE datname = current_database()")" = "b C.UTF-8" ] ||
    fail "the database is not on the builtin C.UTF-8 locale of POSTGRES_INITDB_ARGS"
pass "POSTGRES_INITDB_ARGS applied (builtin C.UTF-8)"

# --- 2. logins -------------------------------------------------------------------------------

[ "$(app_sql -d "$POSTGRES_DB" -c 'SELECT current_user')" = qa_app ] || fail "qa_app cannot log in"
if PGPASSWORD=wrong psql -X -q -h "$ADDRESS" -U qa_app -d "$POSTGRES_DB" -c 'SELECT 1' >/dev/null 2>&1; then
    fail "qa_app logs in with a wrong password"
fi
pass "qa_app logs in with its password over the network, not with a wrong one"

owner_sql -d "$POSTGRES_DB" -c "CREATE ROLE stranger LOGIN PASSWORD 'stranger-password-1'"
if PGPASSWORD=stranger-password-1 psql -X -q -h "$ADDRESS" -U stranger -d "$POSTGRES_DB" -c 'SELECT 1' >/dev/null 2>&1; then
    fail "a role without a grant can connect to $POSTGRES_DB"
fi
owner_sql -d "$POSTGRES_DB" -c "DROP ROLE stranger"
pass "a role without a grant cannot connect"

# --- 3. the schema as the server applies it, then a later migration --------------------------

# sqlx 0.9 (sqlx-postgres src/migrate.rs, ensure_migrations_table) before the first migration.
SQLX_TABLE="CREATE TABLE IF NOT EXISTS _sqlx_migrations (
    version BIGINT PRIMARY KEY,
    description TEXT NOT NULL,
    installed_on TIMESTAMPTZ NOT NULL DEFAULT now(),
    success BOOLEAN NOT NULL,
    checksum BYTEA NOT NULL,
    execution_time BIGINT NOT NULL
)"

# Applies every file of server/migrations-sql/ in order, each in one transaction with its
# bookkeeping row, as the role of the given psql function.
apply_schema() {
    local as=$1 db=$2 file version
    "$as" -d "$db" -c "$SQLX_TABLE"
    for file in "$ROOT"/server/migrations-sql/*.sql; do
        version=$(basename "$file" | sed 's/_.*//')
        {
            echo 'BEGIN;'
            cat "$file"
            echo
            printf '%s\n' "INSERT INTO _sqlx_migrations (version, description, success, checksum, execution_time)
                  VALUES ($((10#$version)), '$(basename "$file" .sql)', true, '\\x00', 0);"
            echo 'COMMIT;'
        } | "$as" -d "$db" -f -
    done
}

# What a later migration of the auth half does (research-postgres §2.2): every statement
# needs the owner of users, meetings or user_capability. Rolled back, so it can run twice.
LATER_MIGRATION="BEGIN;
ALTER TYPE user_capability ADD VALUE 'LaterCapability';
ALTER TABLE users ADD COLUMN email text;
ALTER TABLE meetings ADD COLUMN later integer;
CREATE INDEX users_email ON users (email);
CREATE TABLE sessions (_id text PRIMARY KEY, user_id text COLLATE \"C\" NOT NULL REFERENCES users (_id));
ALTER TABLE places ADD CONSTRAINT places_later CHECK (lat >= -90);
ROLLBACK;"

apply_schema app_sql "$POSTGRES_DB"
pass "qa_app applied server/migrations-sql/ ($(find "$ROOT/server/migrations-sql" -maxdepth 1 -name '*.sql' | wc -l) files)"

app_sql -d "$POSTGRES_DB" -c "$LATER_MIGRATION" >/dev/null ||
    fail "qa_app cannot apply a later migration to the schema it created"
pass "qa_app applies a later migration (ALTER TYPE, ALTER TABLE, CREATE INDEX, REFERENCES)"

owner_sql -d "$POSTGRES_DB" -f "$DEPLOYMENT/pg-owner-check.sql" 2>&1 | grep -q 'owner check passed' ||
    fail "pg-owner-check.sql fails on the schema qa_app created"
pass "pg-owner-check.sql passes"

# The server's writes: rows, including identity columns (sequences owned by qa_app).
app_sql -d "$POSTGRES_DB" -c "
    INSERT INTO users (_id, capabilities) VALUES ('user-1', '{UpdateMeetings}'), ('user-2', '{}');
    INSERT INTO places (_id, name, name_key, lat, lon) VALUES ('place-1', 'Ort', 'ort', 48.37, 10.89);"
pass "qa_app writes rows, identity columns included"

# --- 4. negative control: the schema created by qa_owner ------------------------------------

owner_sql -d "$POSTGRES_DB" -c 'CREATE DATABASE negative_control'
owner_sql -d negative_control -c 'GRANT CONNECT ON DATABASE negative_control TO qa_app; GRANT USAGE, CREATE ON SCHEMA public TO qa_app'
apply_schema owner_sql negative_control
if app_sql -d negative_control -c "$LATER_MIGRATION" >/tmp/negative.out 2>&1; then
    fail "the negative control passed: the later migration ran on a schema qa_owner owns"
fi
grep -q 'must be owner' /tmp/negative.out || { cat /tmp/negative.out >&2; fail "unexpected error in the negative control"; }
if owner_sql -d negative_control -f "$DEPLOYMENT/pg-owner-check.sql" >/tmp/negative-check.out 2>&1; then
    fail "pg-owner-check.sql passes on a schema qa_owner owns"
fi
grep -q 'not owned by qa_app' /tmp/negative-check.out || { cat /tmp/negative-check.out >&2; fail "unexpected owner check output"; }
owner_sql -d "$POSTGRES_DB" -c 'DROP DATABASE negative_control'
pass "negative control: on a schema qa_owner created the later migration fails with 'must be owner', and the owner check names it"

# --- 5. backup, restore check and restore ---------------------------------------------------

backup_command=$(awk '
    /^\[job-exec "backup-qa-pg"\]$/ { inside = 1; next }
    /^\[/ { inside = 0 }
    inside && /^command = / { sub(/^command = /, ""); print; exit }' "$DEPLOYMENT/templates/config/ofelia.conf")
[ -n "$backup_command" ] || fail "no command for backup-qa-pg in ofelia.conf"
case $backup_command in *'{{'*) fail "the backup-qa-pg command has a template value; extend this test" ;; esac
# ofelia's job-exec runs it with `docker exec` as the container's user, root.
eval "$backup_command"
[ -s /backup/queer-augsburg.pgdump ] || fail "the backup job wrote no dump"
[ ! -e /backup/queer-augsburg.pgdump.part ] || fail "the backup job left the .part file"
pass "the backup-qa-pg command of ofelia.conf wrote /backup/queer-augsburg.pgdump"

restore_check() {
    # As the README runs it: the script on stdin of `sh -s`.
    sh -s -- "$@" <"$DEPLOYMENT/pg-restore-check.sh"
}
restore_check /backup/queer-augsburg.pgdump >/tmp/check.out || { cat /tmp/check.out >&2; fail "restore check of a fresh dump"; }
grep -q 'RESTORE CHECK PASSED: the dump restores and equals the live database' /tmp/check.out || fail "restore check output"
grep -Eq '^  users +2 rows  equal$' /tmp/check.out || { cat /tmp/check.out >&2; fail "restore check did not compare users"; }
pass "pg-restore-check.sh restores the dump and finds it equal"

[ "$(owner_sql -d postgres -c "SELECT count(*) FROM pg_database WHERE datname LIKE 'restore_check_%'")" = 0 ] ||
    fail "the restore check left its database behind"
pass "the restore check drops its database"

app_sql -d "$POSTGRES_DB" -c "INSERT INTO users (_id) VALUES ('user-3')"
if restore_check /backup/queer-augsburg.pgdump >/tmp/check.out; then
    fail "the restore check passes although a row was written after the dump"
fi
grep -Eq '^  users +3 / 2 rows  DIFFERS$' /tmp/check.out || { cat /tmp/check.out >&2; fail "restore check did not name the changed table"; }
restore_check /backup/queer-augsburg.pgdump --live-may-differ >/tmp/check.out || { cat /tmp/check.out >&2; fail "--live-may-differ"; }
grep -q 'changed after it was written' /tmp/check.out || fail "--live-may-differ output"
pass "a later write fails the check, and is listed with --live-may-differ"

app_sql -d "$POSTGRES_DB" -c "UPDATE _sqlx_migrations SET description = description || ' changed' WHERE version = (SELECT min(version) FROM _sqlx_migrations)"
if restore_check /backup/queer-augsburg.pgdump --live-may-differ >/tmp/check.out; then
    fail "another migration history passes the restore check with --live-may-differ"
fi
grep -Eq '^  _sqlx_migrations +[0-9]+ / [0-9]+ rows  DIFFERS$' /tmp/check.out || { cat /tmp/check.out >&2; fail "restore check did not name _sqlx_migrations"; }
app_sql -d "$POSTGRES_DB" -c "UPDATE _sqlx_migrations SET description = regexp_replace(description, ' changed$', '')"
pass "another migration history fails even with --live-may-differ"

head -c "$(( $(stat -c %s /backup/queer-augsburg.pgdump) / 2 ))" /backup/queer-augsburg.pgdump >/backup/truncated.pgdump
if restore_check /backup/truncated.pgdump --live-may-differ >/tmp/check.out; then
    fail "a truncated dump passes the restore check"
fi
grep -q 'RESTORE CHECK FAILED' /tmp/check.out || fail "truncated dump output"
rm /backup/truncated.pgdump
pass "a truncated dump fails the restore check"

# README "Database": the restore into the running database.
pg_restore --clean --if-exists -U qa_owner -d "$POSTGRES_DB" /backup/queer-augsburg.pgdump
[ "$(owner_sql -d "$POSTGRES_DB" -c 'SELECT count(*) FROM users')" = 2 ] || fail "restore into the live database"
owner_sql -d "$POSTGRES_DB" -f "$DEPLOYMENT/pg-owner-check.sql" 2>&1 | grep -q 'owner check passed' ||
    fail "after pg_restore --clean qa_app no longer owns the schema"
app_sql -d "$POSTGRES_DB" -c "$LATER_MIGRATION" >/dev/null || fail "later migration after a restore"
[ "$(app_sql -d "$POSTGRES_DB" -c "INSERT INTO users (_id) VALUES ('user-4') RETURNING _id")" = user-4 ] ||
    fail "qa_app cannot write after a restore"
pass "pg_restore --clean into the live database keeps qa_app the owner and the server writing"

# --- 6. pg-init.sql refuses a password the URL cannot carry -----------------------------------

port=5433
# shellcheck disable=SC2016 # a literal '$', one of the characters refused
for bad in 'ab/cd+ef@gh#ij%kl$mnABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789' 'short1' ''; do
    data=/tmp/pgdata-bad-$port
    # The entrypoint ends when the init script fails. Had it accepted the password, it would
    # say that the init is complete and go on to serve, so that ends the wait too.
    PGDATA=$data PGPORT=$port POSTGRES_APP_PASSWORD=$bad docker-entrypoint.sh postgres >/tmp/bad.log 2>&1 &
    bad_pid=$!
    deadline=$((SECONDS + START_SECONDS))
    while kill -0 "$bad_pid" 2>/dev/null; do
        if grep -q 'PostgreSQL init process complete' /tmp/bad.log; then
            kill "$bad_pid" 2>/dev/null || true
            wait "$bad_pid" || true
            fail "pg-init.sql accepted an app password the URL cannot carry"
        fi
        if [ "$SECONDS" -ge "$deadline" ]; then
            kill "$bad_pid" 2>/dev/null || true
            cat /tmp/bad.log >&2
            fail "the entrypoint with a refused password did not end within $START_SECONDS s"
        fi
        sleep 0.5
    done
    if wait "$bad_pid"; then
        fail "pg-init.sql accepted an app password the URL cannot carry (the entrypoint ended with 0)"
    fi
    # A failed init script leaves the entrypoint's socket-only init server running (in a
    # container it ends with the container): the state the healthcheck must not call healthy.
    pg_isready -q -p "$port" -U qa_owner || fail "the init server is not up on the socket"
    if PGPORT=$port sh -c "$HEALTHCHECK" >/dev/null; then
        fail "the healthcheck calls the socket-only init server healthy"
    fi
    gosu postgres pg_ctl -D "$data" -m immediate stop >/dev/null 2>&1 || true
    grep -q 'POSTGRES_APP_PASSWORD must be at least 32 letters and digits' /tmp/bad.log ||
        { cat /tmp/bad.log >&2; fail "unexpected init failure"; }
    if [ -n "$bad" ] && grep -qF -- "$bad" /tmp/bad.log; then
        fail "the refused password appears in the log"
    fi
    rm -rf "$data"
    port=$((port + 1))
done
pass "pg-init.sql refuses app passwords that are not 32+ letters and digits, without printing them"
pass "the healthcheck does not call the init server (socket only) healthy"

echo "deployment/tests/postgres.sh: all checks passed"
