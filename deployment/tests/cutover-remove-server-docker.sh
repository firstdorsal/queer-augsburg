#!/usr/bin/env bash
# The blocks of the Postgres cutover against a real docker daemon and a given compose version:
# P4's record of what it compared, day step 1 (the compose version check), day step 2 (the
# comparison with what P1 saved, the stop settings and their fix, the removal of qa-server with
# `rm -sf qa-server`, the dump), day step 3 (the comparison with P4's record, the new files and
# qa-pg), day step 4 (the migrator, the owner check, the dump and its restore check), day step 5
# (the server, then qa-ofelia), day step 8 (the upload, and the record of R2's dump in it), R1,
# R2 and "Trying again". All are read from deployment/README.md and run whole, so a change of a
# block in the README is what runs. Only what points at production changes, and the test checks
# with diff that nothing else does: D= and W= point into a scratch directory, and the volume
# the migrator mounts is qa-cutover-test-backup instead of qa-backup (a daemon can have a
# qa-backup of its own). Run with another compose than the one "Versions" records, R1's and
# R2's compose checks expect the one that runs, so that the rest of both is tested with it too;
# R1 and R2 as the README has them must then stop at their check.
#
#     COMPOSE=/path/to/docker-compose bash deployment/tests/cutover-remove-server-docker.sh
#
# COMPOSE as in local-docker.sh: turing's compose release, or without it the docker CLI's own
# plugin. Needs docker and the image postgres:18.6-alpine (pulled if missing), which stands in
# for every container and is a real qa-pg on a volume qa-pg, set up with the template's
# pg-init.sql and POSTGRES_INITDB_ARGS. pg-restore-check.sh and pg-owner-check.sql are the real
# ones; P1's check, the migrator, mongodump, qa-backup's upload and the other scripts of the
# checkout are stubs. Not in CI: the test-deployment job has no docker daemon.
#
# The blocks use the names of production: project `results`, the containers qa-server, qa-db,
# qa-pg, qa-ofelia and the other services qa-ofelia depends on in the template, the network
# and volume qa-pg and the image qa-migrate:<sha>. The test stops before it creates anything
# while one of them exists on the daemon (the image by its test tag qa-migrate:cutovertest),
# names the command that removes it, and removes only what it made.
#
# Checked, in this order (the scenarios that catch the most come first, as the test stops at
# its first failure):
# - Day step 1 passes with the compose version "Versions" records for turing, and stops
#   otherwise.
# - Day step 2: compose's qa-server of `results` is stopped with the server's stop signal and
#   given the time to save, removed, and only then dumped (the stand-in's dump records whether
#   the server had saved). It stops before anything changes on a compose file or config
#   edited since P1, on a foreign qa-server, on other stop settings (and goes through after
#   the README's fix), on P1's check, and stops at mongodump or migrate-config.sh.
# - The day as the README has it: day step 3 stops on a live file changed since P4 (though
#   kept in P1's copy, so that day step 2 passed) and on a staged one, and goes through after
#   P4 again; it returns only when qa-pg takes connections over TCP, with qa_app;
#   day step 4 migrates, checks the owners, dumps and restores; day step 5 starts the server
#   (recording that it ran) and then qa-ofelia with the new job, each touching nothing else;
#   its ofelia block stops on a config without the job and goes through when pasted again.
#   R1 leaves qa-pg without its restart policy (it mounts the pg-init.sql R1 removes).
#   "Trying again" refuses while the server runs, and after R2 until step 8 uploaded R2's
#   dump; step 8 stops on a recorded dump that is not in the backup volume and records
#   nothing when its upload fails.
# - R2, step 8, then day step 5 again (staying after all), R1 alone: "Trying again" refuses,
#   as the server ran since R2's dump; R2 after R1 starts qa-pg again and dumps it.
# - Day step 4 failing at the migrator (hidden behind tee without pipefail) and at its restore
#   check, each followed by R1 and "Trying again", which removes qa-pg as the server never ran;
#   day step 3 stopping on an existing volume qa-pg; a pg-init.sql that creates no qa_app.
# - Day step 5 with a server that never listens: it removes the server again (no later start
#   by `restart: always`), then R2, R1, step 8 and "Trying again".
# - R2 against a qa-server of another project, on another compose, with pg_dump or the
#   restore check failing (no record of a dump; after R1 "Trying again" refuses; R2 again
#   after R1 goes through).
# - R1: right after day step 2, after day step 2 or 3 failed, after the day steps 2 to 4 and
#   after R2: the old compose file and config are live, compose's qa-server of `results` runs
#   on the old config and said 'Listening on', qa-ofelia was created again and read the old
#   jobs, qa-pg is stopped and kept (or was never created), every other container is the one
#   from before R1, and the last line is P1's check. Pasted again with P1's check failing it
#   fails; with a config file it cannot restore, a compose file `config -q` refuses or an old
#   server that never listens it stops, and after the README's next step it goes back.
# The stubs of P1's check, mongodump, migrate-config.sh, the migrator and the upload refuse
# other arguments than the blocks give them. P1's check passes as the real one does, while the
# image compose resolves for qa-server is the one P1 pinned and qa-server runs the image P1
# recorded. Control: day step 2 without the container check dumps while another project's
# qa-server runs.

set -euo pipefail

DEPLOYMENT=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
README=$DEPLOYMENT/README.md
TEMPLATE=$DEPLOYMENT/templates/docker-compose.yml
IMAGE=postgres:18.6-alpine
OTHER=qa-cutover-test-other
VOLUME=qa-cutover-test-backup
SHA=cutovertest
D_LINE='D=/mnt/alpha/manifest/server/public/queer-augsburg/deployment'
W_LINE='W=/root/qa-cutover'
VOLUME_ARG='-v qa-backup:/backup:ro '
RM_LINE='docker compose -p results rm -sf qa-server'
CHECK_LINE='if docker container inspect qa-server >/dev/null 2>&1; then'
LISTENING='Listening on [::]:80'

fail() {
    echo "FAIL: $*" >&2
    exit 1
}
pass() {
    echo "ok: $*"
}
# A block not shaped as the checks below expect. A failure of its own, so that a run with
# this one as a warning shows which scenario catches a change of a block by behaviour alone.
fail_shape() {
    fail "$@"
}

work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT
# shellcheck source-path=SCRIPTDIR source=local-docker.sh
. "$DEPLOYMENT/tests/local-docker.sh"
# shellcheck source-path=SCRIPTDIR source=readme-blocks.sh
. "$DEPLOYMENT/tests/readme-blocks.sh"
# shellcheck source-path=SCRIPTDIR source=server-stop.sh
. "$DEPLOYMENT/tests/server-stop.sh"
local_docker "$work"

# --- The blocks from the README --------------------------------------------------------------

readme_blocks "$README" "$work/blocks"
# shellcheck disable=SC2016 # literal $V, $W, $C and $K of the blocks
{
    readme_block "$work/blocks" '^echo "docker compose \$V, as tested"$' "$work/version.sh"
    readme_block "$work/blocks" '>"\$W/p4-compared\.sha256"$' "$work/body-p4.sh"
    readme_block "$work/blocks" '^C=cutover-' "$work/body-day2.sh"
    readme_block "$work/blocks" '^echo "qa-server stops with ' "$work/body-fix.sh"
    readme_block "$work/blocks" '^cp "\$W/staged/docker-compose.yml" docker-compose.yml$' "$work/body-day3.sh"
    readme_block "$work/blocks" '^    tee "\$W/\$C.report.txt"$' "$work/body-day4.sh"
    readme_block "$work/blocks" '^listening=no$' "$work/body-day5.sh"
    readme_block "$work/blocks" "^docker logs qa-ofelia 2>&1 \\| grep 'New job registered \"backup-qa-pg\"'\$" "$work/body-ofelia.sh"
    readme_block "$work/blocks" '^    echo "\$K" >"\$W/rollback-uploaded"$' "$work/body-day8.sh"
    readme_block "$work/blocks" '^K=rollback-' "$work/body-r2.sh"
    readme_block "$work/blocks" '^rm -f config/pg-init.sql$' "$work/body-r1.sh"
    readme_block "$work/blocks" '^docker volume rm qa-pg$' "$work/body-again.sh"
}
TESTED=$(readme_turing_compose "$README")

[ "$(grep -lxF -- "$RM_LINE" "$work"/blocks/*.sh | wc -l)" = 2 ] ||
    fail_shape "expected '$RM_LINE' in day step 2 and R2 only"
for body in body-day2.sh body-r2.sh; do
    [ "$(grep -cxF -- "$RM_LINE" "$work/$body")" = 1 ] || fail_shape "$body: expected '$RM_LINE' once"
    [ "$(grep -xF -A 1 -- "$RM_LINE" "$work/$body" | tail -n 1)" = "$CHECK_LINE" ] ||
        fail_shape "$body: the line after the rm is not the container check"
done

# Only what points at production changes, each at most once; afterwards nothing of it is left.
localize() { # <body> <out> <number of lines changed>
    local line
    [ "$(grep -cxF -- "$D_LINE" "$1")" -le 1 ] && [ "$(grep -cxF -- "$W_LINE" "$1")" -le 1 ] ||
        fail "$(basename "$1"): expected the lines '$D_LINE' and '$W_LINE' at most once each"
    while IFS= read -r line; do
        case $line in
            "$D_LINE") line="D=$work/D" ;;
            "$W_LINE") line="W=$work/W" ;;
        esac
        printf '%s\n' "${line/"$VOLUME_ARG"/"-v $VOLUME:/backup:ro "}"
    done <"$1" >"$2"
    [ "$(diff "$1" "$2" | grep -c '^[<>]')" = $(($3 * 2)) ] ||
        fail "$(basename "$1"): localizing changed other lines than the $3 expected"
    if grep -nE '/root|/mnt/alpha|qa-backup:' "$2"; then fail "$(basename "$1"): still names production"; fi
}
# The two lines of R1's and R2's compose check that name the version, as day step 1 has them.
# shellcheck disable=SC2016 # a literal $V of the block
check_if() { printf 'if [ "$V" != %s ]; then' "$1"; }
check_stop() { printf "    echo \"STOP: docker compose on turing is '\$V', the cutover was tested with %s; nothing was changed\"" "$1"; }
with_version() { # <block> <out> <version>: the block's compose check expects <version> instead
    local line
    [ "$(grep -cxF -- "$(check_if "$TESTED")" "$1")" = 1 ] && [ "$(grep -cxF -- "$(check_stop "$TESTED")" "$1")" = 1 ] ||
        fail_shape "$(basename "$1"): expected the compose check for $TESTED, as day step 1 has it"
    while IFS= read -r line; do
        case $line in
            "$(check_if "$TESTED")") check_if "$3" && echo ;;
            "$(check_stop "$TESTED")") check_stop "$3" && echo ;;
            *) printf '%s\n' "$line" ;;
        esac
    done <"$1" >"$2"
    # Those two lines and nothing else, and none when <version> is the recorded one.
    local changed=4
    [ "$3" != "$TESTED" ] || changed=0
    [ "$(diff "$1" "$2" | grep -c '^[<>]')" = $changed ] ||
        fail "$(basename "$1"): setting the compose check to $3 changed other lines than its two"
}
for body in body-r2.sh body-day4.sh; do
    [ "$(grep -cF -- "$VOLUME_ARG" "$work/$body")" = 1 ] || fail "$body: expected '$VOLUME_ARG' once"
done
localize "$work/body-p4.sh" "$work/p4.sh" 2
localize "$work/body-day2.sh" "$work/day2.sh" 2
localize "$work/body-fix.sh" "$work/fix.sh" 2
localize "$work/body-day3.sh" "$work/day3.sh" 2
localize "$work/body-day4.sh" "$work/day4.sh" 3
localize "$work/body-day5.sh" "$work/day5.sh" 2
localize "$work/body-ofelia.sh" "$work/ofelia.sh" 1
localize "$work/body-day8.sh" "$work/day8.sh" 1
localize "$work/body-r2.sh" "$work/r2-as-is.sh" 3
localize "$work/body-r1.sh" "$work/r1-as-is.sh" 2
localize "$work/body-again.sh" "$work/again.sh" 1
# R1 and R2 for the compose that runs, and for a compose that cannot be the one running.
for block in r1 r2; do
    with_version "$work/$block-as-is.sh" "$work/$block.sh" "$VERSION"
    with_version "$work/$block-as-is.sh" "$work/$block-other-compose.sh" 0.0.0-cutovertest
done
# The control: day step 2 without the container check (its line through the next fi).
awk -v check="$CHECK_LINE" '
    skip && $0 == "fi" { skip = 0; done = 1; next }
    skip { next }
    $0 == check && !done { skip = 1; next }
    { print }' "$work/day2.sh" >"$work/day2-unchecked.sh"
[ "$(diff "$work/day2.sh" "$work/day2-unchecked.sh" | grep -c '^<')" = 4 ] ||
    fail_shape "day step 2: no check of four lines to leave out for the control"

# The STOP lines the scenarios expect, as the blocks print them.
stop_line() { # <block> <start of its STOP message>: the message with $W replaced
    local line
    line=$(grep -F -- "echo \"$2" "$work/$1" | sed 's/^ *echo "\(.*\)"$/\1/' || true)
    [ -n "$line" ] && [ "$(printf '%s\n' "$line" | wc -l)" = 1 ] || fail_shape "$1: expected one line echo \"$2…\""
    printf '%s\n' "${line//\$W/$work/W}"
}
DAY3_STOP_VOLUME=$(stop_line day3.sh 'STOP: the volume qa-pg exists')
DAY3_STOP_P4=$(stop_line day3.sh 'STOP: the live or the staged files are not the ones P4 compared')
DAY2_STOP_P1=$(stop_line day2.sh 'STOP: results/ is not what P1 saved')
DAY5_STOP=$(stop_line day5.sh 'STOP: qa-server did not listen')
AGAIN_NONE=$(stop_line again.sh 'no volume qa-pg')
for v in DAY3_STOP_VOLUME DAY3_STOP_P4 DAY2_STOP_P1 DAY5_STOP AGAIN_NONE; do
    [[ ${!v} != *'$'* ]] || fail_shape "$v: the message has a variable the test does not know: ${!v}"
done

# qa-pg's initdb arguments as the template sets them.
initdb_line=$(grep -E '^ +POSTGRES_INITDB_ARGS: ' "$TEMPLATE" || true)
[ -n "$initdb_line" ] && [ "$(printf '%s\n' "$initdb_line" | wc -l)" = 1 ] ||
    fail "expected one POSTGRES_INITDB_ARGS line in templates/docker-compose.yml, found: ${initdb_line:-none}"
INITDB_ARGS=$(printf '%s\n' "$initdb_line" | sed 's/^ *POSTGRES_INITDB_ARGS: *"\(.*\)"$/\1/')
[[ $INITDB_ARGS =~ ^[A-Za-z0-9=._\ -]+$ ]] ||
    fail "templates/docker-compose.yml: POSTGRES_INITDB_ARGS is not one double-quoted list of arguments: $initdb_line"
# pg-init.sql goes into config/ as it is (render.sh copies it through the template engine).
if grep -q '{{' "$DEPLOYMENT/templates/config/pg-init.sql"; then
    fail "templates/config/pg-init.sql has a template value now: render it for the stand-in qa-pg"
fi

# How compose stops qa-server and how long the save takes (server-stop.sh). A plain `docker
# stop` of compose's container is not a stop with docker's default 10 s: it uses the
# stop_grace_period compose stored in the container.
server_stop "$DEPLOYMENT" "$work"
DAY2_STOPS=$(day2_stop_check "$work/body-day2.sh")
[ "$DAY2_STOPS" = "$STOP_SIGNAL $GRACE_SECONDS" ] ||
    fail "day step 2 requires the live qa-server to stop with '$DAY2_STOPS'; the template and server/Dockerfile give '$STOP_SIGNAL $GRACE_SECONDS'"
pass "qa-server stops with $STOP_SIGNAL and ${GRACE_SECONDS}s grace, at least the rooms' $SAVE_SECONDS s plus $GRACE_MARGIN s, as day step 2 requires; the stand-in saves for $SAVE_SECONDS s"

# The database the migrator reads from the dump, as migrate-config.sh writes it: mongodump's --db.
MONGO_DB=$(one_value "database line" "$DEPLOYMENT/migrate-config.sh" migrate-config.sh '^echo "database: ([A-Za-z0-9_-]+)"$')

# The services qa-ofelia depends on in the template. Before the cutover the same without qa-pg
# (P4's expected differences). R1 recreates qa-server and qa-ofelia and must leave each of the
# others as it is.
awk '/^[^ ]/ || /^    [A-Za-z0-9_-]+:$/ { in_ofelia = ($0 == "    qa-ofelia:") } in_ofelia' "$TEMPLATE" |
    awk '/^        depends_on:$/ { deps = 1; next } deps && /^            - / { print $2; next } { deps = 0 }' \
        >"$work/ofelia-deps"
mapfile -t OFELIA_DEPS_AFTER <"$work/ofelia-deps"
if ! grep -qx qa-db "$work/ofelia-deps" || ! grep -qx qa-pg "$work/ofelia-deps"; then
    fail "templates/docker-compose.yml: expected qa-ofelia to depend on qa-db and qa-pg (a list), found: ${OFELIA_DEPS_AFTER[*]:-none}"
fi
mapfile -t OFELIA_DEPS_BEFORE < <(grep -vx qa-pg "$work/ofelia-deps")
mapfile -t EXTRA_DEPS < <(grep -vx -e qa-pg -e qa-db "$work/ofelia-deps")
[ "${#EXTRA_DEPS[@]}" -gt 0 ] ||
    fail "templates/docker-compose.yml: qa-ofelia depends on nothing but qa-db and qa-pg; give the test a dependency R1 must leave alone"
for c in "${EXTRA_DEPS[@]}"; do
    [[ $c =~ ^qa-[a-z0-9-]+$ ]] || fail "templates/docker-compose.yml: qa-ofelia depends on '$c', not a qa- service name"
done
# Step 8 uploads from qa-backup, one of them in the template.
grep -qx qa-backup "$work/ofelia-deps" ||
    fail "templates/docker-compose.yml: qa-ofelia no longer depends on qa-backup; the test's stand-in qa-backup (step 8) needs another place"
# This one differs between the stand-in compose files before and after the cutover.
DIFFERING=${EXTRA_DEPS[0]}

# --- Before creating anything ------------------------------------------------------------------

# Each of these names is production's or the test's own. One left by a killed run of this test
# is a stand-in: image postgres:18.6-alpine (or the test's qa-migrate image built from it),
# project results or qa-cutover-test-other. The message names the command that removes it;
# run it only for such a leftover.
CONTAINERS=(qa-server qa-db qa-pg qa-ofelia "${EXTRA_DEPS[@]}")
for c in "${CONTAINERS[@]}"; do
    if docker container inspect "$c" >/dev/null 2>&1; then
        fail "a container $c exists on this daemon; the test uses production's names and would remove or use it. A leftover of this test ($(docker container inspect --format '{{.Config.Image}}, project {{index .Config.Labels "com.docker.compose.project"}}' "$c")) goes with: docker rm -fv $c"
    fi
done
for p in results $OTHER; do
    [ -z "$(docker ps -aq --filter "label=com.docker.compose.project=$p")" ] ||
        fail "containers of compose project $p exist on this daemon; leftovers of this test go with: docker rm -fv \$(docker ps -aq --filter label=com.docker.compose.project=$p)"
    if docker network inspect "${p}_default" >/dev/null 2>&1; then
        fail "network ${p}_default exists; a leftover of this test goes with: docker network rm ${p}_default"
    fi
done
if docker network inspect qa-pg >/dev/null 2>&1; then
    fail "a network qa-pg exists on this daemon; a leftover of this test goes with: docker network rm qa-pg"
fi
for v in qa-pg $VOLUME; do
    if docker volume inspect "$v" >/dev/null 2>&1; then fail "a volume $v exists on this daemon; a leftover of this test goes with: docker volume rm $v"; fi
done
if docker image inspect "qa-migrate:$SHA" >/dev/null 2>&1; then
    fail "an image qa-migrate:$SHA exists on this daemon; the test builds and removes that tag. A leftover of this test goes with: docker rmi qa-migrate:$SHA"
fi

# The project directory of results is D/results, where the blocks cd to.
dir_of() { if [ "$1" = results ]; then echo "$work/D/results"; else echo "$work/$1"; fi; }
# Everything below is the test's own: none of these existed when it started, and compose said
# it created the rest (the output of every compose call and block is kept, so a block that
# names another project, such as `-p result`, is found by its network). The cleanup removes
# them also when compose's down fails (a container in a restart loop, a slow daemon), and
# fails the test if one is left.
NETWORKS="results_default ${OTHER}_default qa-pg"
VOLUMES="qa-pg $VOLUME"
: >"$work/compose.log"
: >"$work/all-out"
created_by_compose() { # <Container|Network|Volume>
    sed -nE "s/^ *$1 ([^ ]+) +Created *\$/\\1/p" "$work/compose.log" "$work/all-out" | sort -u
}
leftovers() {
    local c n v
    for c in "${CONTAINERS[@]}" $(created_by_compose Container); do
        if docker container inspect "$c" >/dev/null 2>&1; then echo "container $c"; fi
    done
    for n in $NETWORKS $(created_by_compose Network); do
        if docker network inspect "$n" >/dev/null 2>&1; then echo "network $n"; fi
    done
    for v in $VOLUMES $(created_by_compose Volume); do
        if docker volume inspect "$v" >/dev/null 2>&1; then echo "volume $v"; fi
    done
    if docker image inspect "qa-migrate:$SHA" >/dev/null 2>&1; then echo "image qa-migrate:$SHA"; fi
}
cleanup() {
    local c n v p left containers networks volumes
    containers="${CONTAINERS[*]} $(created_by_compose Container)"
    networks="$NETWORKS $(created_by_compose Network)"
    volumes="$VOLUMES $(created_by_compose Volume)"
    for c in $containers; do docker update --restart no "$c" >/dev/null 2>&1 || true; done
    for p in results $OTHER; do
        if [ -d "$(dir_of "$p")" ]; then
            (cd "$(dir_of "$p")" && docker compose -p "$p" down -v -t 1 --remove-orphans >/dev/null 2>&1) || true
        fi
    done
    for _ in 1 2 3; do
        for c in $containers; do docker rm -fv "$c" >/dev/null 2>&1 || true; done
        for n in $networks; do docker network rm "$n" >/dev/null 2>&1 || true; done
        for v in $volumes; do docker volume rm "$v" >/dev/null 2>&1 || true; done
        docker rmi "qa-migrate:$SHA" >/dev/null 2>&1 || true
        left=$(leftovers)
        [ -n "$left" ] || break
        sleep 2
    done
    rm -rf "$work"
    if [ -n "$left" ]; then
        echo "FAIL: the cleanup left on this daemon: ${left//$'\n'/, }" >&2
        exit 1
    fi
}
trap cleanup EXIT

docker image inspect $IMAGE >/dev/null 2>&1 || docker pull -q $IMAGE >/dev/null
IMAGE_ID=$(docker image inspect --format '{{.Id}}' $IMAGE)
# The old server's image by its digest, as P1 pins it; the new one by a tag, as from day step 3.
PIN_IMAGE=$(docker image inspect --format '{{range .RepoDigests}}{{println .}}{{end}}' $IMAGE | grep -m 1 -E '^postgres@sha256:[0-9a-f]{64}$' || true)
[ -n "$PIN_IMAGE" ] || fail "$IMAGE has no repository digest here (not pulled from Docker Hub?); the old stand-in server is pinned by it"

# --- Stand-ins -------------------------------------------------------------------------------

# W: the files the blocks read, the checkout's scripts (stubs for P1's check and
# migrate-config.sh, pg-restore-check.sh and pg-owner-check.sql as they are), what P1 saved for
# R1 in pre-postgres (the old compose file as docker-compose.rollback.yml, the old config, the
# image of the server in server-image.txt) and the files rendered for day step 3 in staged.
# qa-db's mongodump writes a marker into the bind-mounted backup directory. Each stub refuses
# other arguments than the blocks give it. The scenarios of failures replace a stub for one run.
mkdir -p "$work/W/src/deployment" "$work/W/pre-postgres" "$work/W/staged" "$work/D/results" "$work/$OTHER" \
    "$work/backup" "$work/migrate" "$work/saved" "$work/s3"
# P1's check decides as the real `--check` does (pin-mongo-server-docker.sh runs that one): the
# image compose resolves for the server from the live file is the one P1 pinned, and the
# container qa-server runs the image P1 recorded. So it passes a file edited elsewhere, and it
# stops day step 2 pasted again after its rm, as qa-server is gone then.
cat >"$work/W/src/deployment/pin-mongo-server.sh" <<SH
#!/bin/sh
[ "\$*" = --check ] || { echo "pin stub: arguments '\$*'" >&2; exit 2; }
cd "$work/D/results"
read -r id digest <"$work/W/pre-postgres/server-image.txt"
[ "\$(docker compose -p results config --images qa-server 2>/dev/null)" = "\$digest" ] ||
    { echo "STOP: results/docker-compose.yml does not pin the server to \$digest" >&2; exit 1; }
[ "\$(docker inspect --format '{{.Image}}' qa-server 2>/dev/null)" = "\$id" ] ||
    { echo "STOP: qa-server does not run the image of $work/W/pre-postgres/server-image.txt" >&2; exit 1; }
echo "PINNED \$digest"
SH
PIN_STOP_IMAGE="STOP: qa-server does not run the image of $work/W/pre-postgres/server-image.txt"
PINNED="PINNED $PIN_IMAGE"
pin_record() { # [other]: the image P1 recorded, the stand-ins' or one qa-server does not run
    local id=$IMAGE_ID
    [ "${1:-}" != other ] || id=sha256:$(printf '%064d' 0)
    echo "$id $PIN_IMAGE" >"$work/W/pre-postgres/server-image.txt"
}
pin_record
migrate_config_stub() { # [fail]: a failing one prints a part and exits 1, as on a missing count
    {
        echo '#!/bin/sh'
        # shellcheck disable=SC2016 # expanded by the stub
        echo '[ "$#" = 2 ] && [ "$1" = qa-db ] || { echo "migrate-config stub: arguments '\''$*'\''" >&2; exit 2; }'
        if [ "${1:-}" = fail ]; then
            # shellcheck disable=SC2016 # expanded by the stub
            echo 'echo "dump_dir: /backup/$2"; echo "no count for users" >&2; exit 1'
        else
            # shellcheck disable=SC2016 # expanded by the stub
            echo 'echo "migrate-config stub $1 $2"'
        fi
    } >"$work/W/src/deployment/migrate-config.sh"
}
migrate_config_stub
cp "$DEPLOYMENT/pg-restore-check.sh" "$DEPLOYMENT/pg-owner-check.sql" "$work/W/src/deployment/"
echo $SHA >"$work/W/sha"
# mongodump in qa-db: the host, port, user and password qa-db's environment gives, the admin
# database for the login, the database migrate-config.sh names, and a directory of /backup.
# Its marker says whether the server had saved before the dump (qa-db sees the server's saved/).
mongodump_stub() { # [fail]: a failing one dumps a part and exits 3
    {
        cat <<'SH'
#!/bin/sh
while [ "$#" -ge 2 ]; do
    case $1 in
        --host) host=$2 ;;
        --port) port=$2 ;;
        --username) user=$2 ;;
        --password) password=$2 ;;
        --authenticationDatabase) auth=$2 ;;
        --db) db=$2 ;;
        --out) out=$2 ;;
        *) break ;;
    esac
    shift 2
done
SH
        # shellcheck disable=SC2016 # expanded by the stub
        printf '%s\n' "if [ \"\$#\" != 0 ] || [ \"\$host\" != qa-db ] || [ \"\$port\" != \"\$MONGODB_PORT_NUMBER\" ] || [ \"\$user\" != root ] ||" \
            "    [ \"\$password\" != \"\$MONGODB_ROOT_PASSWORD\" ] || [ \"\$auth\" != admin ] || [ \"\$db\" != $MONGO_DB ] ||" \
            '    ! printf %s "$out" | grep -Eqx "/backup/[A-Za-z0-9._-]+"; then' \
            '    echo "mongodump stub: arguments host=$host port=$port user=$user auth=$auth db=$db out=$out, left: $*" >&2' \
            '    exit 2' \
            'fi'
        if [ "${1:-}" = fail ]; then
            # shellcheck disable=SC2016 # expanded by the stub
            echo 'mkdir -p "$out" && echo part >"$out/part" && echo "mongodump stub: failed" >&2 && exit 3'
        else
            # shellcheck disable=SC2016 # expanded by the stub
            echo 'mkdir -p "$out/$db" && if [ -f /saved/marker ]; then echo "dumped after the save"; else echo "dumped before the save"; fi >"$out/$db/marker"'
        fi
    } >"$work/mongodump"
    chmod 755 "$work/mongodump"
}
mongodump_stub
# results/.env as P5 leaves it: the passwords add-postgres-secrets.sh makes and the server's tag.
pw() { tr -dc A-Za-z0-9 </dev/urandom | head -c 64 || true; }
printf 'POSTGRES_PASSWORD_QA=%s\nPOSTGRES_APP_PASSWORD_QA=%s\nQA_SERVER_IMAGE_TAG=%s\n' "$(pw)" "$(pw)" $SHA >"$work/env"
cp "$work/env" "$work/D/results/.env"
# The config before the cutover (in pre-postgres too, as P1 saved it) and after it, as day step
# 3 copies it from staged: qa-server.yml for the server, ofelia.conf for qa-ofelia's jobs (in
# ofelia's format, the new one with the job day step 5 looks for), pg-init.sql (the
# template's) for qa-pg.
mkdir -p "$work/config-before" "$work/config-after"
echo "db: mongodb stub" >"$work/config-before/qa-server.yml"
printf '[job-exec "backup-qa-db"]\nschedule = @weekly\n' >"$work/config-before/ofelia.conf"
echo "db: postgres stub" >"$work/config-after/qa-server.yml"
printf '[job-exec "backup-qa-db"]\nschedule = @weekly\n\n[job-exec "backup-qa-pg"]\nschedule = @weekly\n' \
    >"$work/config-after/ofelia.conf"
cp "$DEPLOYMENT/templates/config/pg-init.sql" "$work/config-after/pg-init.sql"
cp -a "$work/config-before" "$work/W/pre-postgres/config"
cp -a "$work/config-after" "$work/W/staged/config"
# What the stand-in qa-ofelia logs for a config: one line per job, as ofelia's
# `New job registered "<name>" - …` (measured with mcuadros/ofelia:latest).
OFELIA_JOBS='s/^\[job-[a-z-]* "\(.*\)"\]$/New job registered "\1" - stub/p'
ofelia_jobs() { sed -n "$OFELIA_JOBS" "$1"; }

# The migrator as day step 4 and R2 run it: its arguments, the config, the database as qa_app
# and the backup volume. migrate writes a table with a row as qa_app, as the migrator leaves
# the schema; a migrate.yml with "migrator fails" makes it fail after that (as a failed
# verify), one with "unrestorable" makes it also write what a dump cannot restore (a check
# constraint calling a function that reads another table without its schema: pg_restore
# runs it with an empty search_path). verify fails as after writes on Postgres.
cat >"$work/migrate/migrate-from-mongo" <<'SH'
#!/bin/sh
case "$*" in
    "migrate --config /migrate.yml")
        echo "config: $(cat /migrate.yml)"
        psql -X -q -v ON_ERROR_STOP=1 "$DATABASE_URL" \
            -c "CREATE TABLE IF NOT EXISTS meetings (_id text PRIMARY KEY); INSERT INTO meetings VALUES ('m1') ON CONFLICT DO NOTHING" || exit 1
        if grep -q unrestorable /migrate.yml; then
            psql -X -q -v ON_ERROR_STOP=1 "$DATABASE_URL" <<'SQL' || exit 1
CREATE TABLE b (id int);
INSERT INTO b VALUES (1);
CREATE FUNCTION in_b(int) RETURNS boolean LANGUAGE sql AS 'SELECT EXISTS (SELECT 1 FROM b WHERE id = $1)';
CREATE TABLE a (x int CHECK (in_b(x)));
INSERT INTO a VALUES (1);
SQL
        fi
        echo "connected as: $(psql -X "$DATABASE_URL" -tAc 'SELECT current_user')"
        if grep -q 'migrator fails' /migrate.yml; then
            echo "MIGRATION FAILED (stub)"
            exit 1
        fi
        echo "MIGRATION VERIFIED (stub)"
        ;;
    "verify --config /migrate.yml")
        echo "config: $(cat /migrate.yml)"
        echo "connected as: $(psql -X "$DATABASE_URL" -tAc 'SELECT current_user')"
        for f in /backup/rollback-*.pgdump; do echo "dump: ${f#/backup/}"; done
        echo "MIGRATION FAILED (stub: the counts differ after writes)"
        exit 1
        ;;
    *)
        echo "migrator stub: arguments '$*'"
        exit 2
        ;;
esac
SH
chmod 755 "$work/migrate/migrate-from-mongo"
printf 'FROM %s\nCOPY migrate-from-mongo /app/migrate-from-mongo\nENTRYPOINT ["/app/migrate-from-mongo"]\n' $IMAGE \
    >"$work/migrate/Dockerfile"
docker build -q --pull=false -t "qa-migrate:$SHA" "$work/migrate" >/dev/null

# qa-backup's python3 for step 8's one command: an upload is a copy of the backup volume into
# s3/archive-<n>; with s3/fail it fails as backup_script.py does when S3 refuses.
cat >"$work/python3-stub" <<'SH'
#!/bin/sh
case ${2:-} in *'import backup_script; sys.exit(0 if backup_script.send_backup() else 1)'*) call=send_backup ;; *) call= ;; esac
if [ "$#" != 2 ] || [ "$1" != -c ] || [ "$call" != send_backup ]; then
    echo "python3 stub: arguments '$*'" >&2
    exit 2
fi
if [ -e /s3/fail ]; then
    echo "Archive could not be uploaded to S3. stub"
    exit 1
fi
n=$(($(find /s3 -mindepth 1 -maxdepth 1 -name 'archive-*' | wc -l) + 1))
mkdir "/s3/archive-$n" && cp -R /backup/. "/s3/archive-$n/"
SH
chmod 755 "$work/python3-stub"
# The first start of the stand-in qa-pg waits after pg-init.sql, on the init server that
# listens on its socket only, as a slow first start would.
printf 'echo "stand-in: holding the first start for 10 s"\nsleep 10\n' >"$work/pg-slow-init.sh"

# The services as the blocks meet them: before the cutover qa-server needs nothing (day step
# 2, and R1's old compose) and names its image by the digest P1 pinned; after it qa-server
# depends on a healthy qa-pg and names its image by a tag, and the file needs
# QA_SERVER_IMAGE_TAG (here a label, as the stand-in's image is not the server's). compose's
# qa-server prints its config and, unless that is broken, 'Listening on' LISTEN_SECONDS after
# its start, as the server does once it reads its database: longer than R1 takes from its
# `up` to its first look at the log, even on a slow daemon, so that R1 without its wait
# fails. It saves as the server's rooms do: on its stop signal it takes SAVE_SECONDS, then
# writes saved/marker and exits, so a SIGKILL before that (kill, stop -t 0, stop -t 10, a
# grace period too short) leaves no marker. Its stop signal and grace period are those found
# above; it sleeps in steps of 0.2 s, so the signal is handled at once. qa-ofelia logs the
# jobs of its config OFELIA_SECONDS after it starts, as ofelia reads them only then, and
# depends on what the template's depends on. Of those, DIFFERING has another label after the
# cutover than before: in production the files define them alike (P4), here a convergence R1
# or day step 5 must not do would recreate it. qa-backup mounts the backup volume and the
# upload stub. qa-db, qa-ofelia, the other services and the other qa-servers run under an
# init, so their stop takes no grace period. Restart and container names as in the template.
# A tmpfs over the image's VOLUME, so that no container leaves an anonymous volume behind
# (rm -sf removes none). qa-pg as in the template: its network, its volume qa-pg, the backup
# volume, config/pg-init.sql, initdb args.
LISTEN_SECONDS=20
OFELIA_SECONDS=5
cat >"$work/server-stand-in.sh" <<SH
#!/bin/sh
trap 'sleep $SAVE_SECONDS; echo saved >/saved/marker; exit 0' ${STOP_SIGNAL#SIG}
echo "config: \$(cat /config.yml)"
if grep -q broken /config.yml; then echo "Error: connecting to the database"; exit 1; fi
i=0
while [ \$i -lt $((LISTEN_SECONDS * 5)) ]; do sleep 0.2; i=\$((i + 1)); done
echo "$LISTENING"
while :; do sleep 0.2; done
SH
cat >"$work/ofelia-stand-in.sh" <<SH
#!/bin/sh
sleep $OFELIA_SECONDS
sed -n '$OFELIA_JOBS' /etc/ofelia/config.ini
exec sleep infinity
SH
stand_in() { # <name> [before|after: the label of DIFFERING]
    printf '    %s:\n        image: %s\n        container_name: %s\n        entrypoint: ["sleep", "infinity"]\n        init: true\n        restart: always\n        tmpfs: [/var/lib/postgresql]\n' \
        "$1" $IMAGE "$1"
    if [ "$1" = "$DIFFERING" ]; then
        printf '        labels:\n            qa-cutover-test.compose: %s\n' "$2"
    fi
    if [ "$1" = qa-backup ]; then
        cat <<YAML
        user: "$(id -u):$(id -g)"
        volumes:
            - $VOLUME:/backup/:rw
            - ../../python3-stub:/usr/local/bin/python3:ro
            - ../../s3:/s3
YAML
    fi
}
server_stand_in() { # <image>
    cat <<YAML
    qa-server:
        image: $1
        container_name: qa-server
        entrypoint: ["sh", "/stand-in.sh"]
        stop_signal: $STOP_SIGNAL
        stop_grace_period: ${GRACE_SECONDS}s
        user: "$(id -u):$(id -g)"
        restart: always
        tmpfs: [/var/lib/postgresql]
        volumes:
            - ./config/qa-server.yml:/config.yml:ro
            - ../../server-stand-in.sh:/stand-in.sh:ro
            - ../../saved:/saved
YAML
}
db_stand_in() {
    stand_in qa-db
    cat <<YAML
        user: "$(id -u):$(id -g)"
        environment:
            MONGODB_PORT_NUMBER: "27017"
            MONGODB_ROOT_PASSWORD: unused
        volumes:
            - ../../backup:/backup
            - ../../saved:/saved:ro
            - ../../mongodump:/usr/local/bin/mongodump:ro
YAML
}
ofelia_stand_in() { # <service it depends on…>
    cat <<YAML
    qa-ofelia:
        image: $IMAGE
        container_name: qa-ofelia
        entrypoint: ["sh", "/stand-in.sh"]
        init: true
        restart: always
        tmpfs: [/var/lib/postgresql]
        volumes:
            - ./config/ofelia.conf:/etc/ofelia/config.ini:ro
            - ../../ofelia-stand-in.sh:/stand-in.sh:ro
        depends_on:
YAML
    printf '            - %s\n' "$@"
}
{
    echo services:
    server_stand_in "$PIN_IMAGE"
    db_stand_in
    for c in "${EXTRA_DEPS[@]}"; do stand_in "$c" before; done
    ofelia_stand_in "${OFELIA_DEPS_BEFORE[@]}"
    printf 'volumes:\n    %s:\n        name: %s\n' $VOLUME $VOLUME
} >"$work/compose-before.yml"
cp "$work/compose-before.yml" "$work/W/pre-postgres/docker-compose.rollback.yml"
{
    echo services:
    server_stand_in $IMAGE
    cat <<YAML
        depends_on:
            qa-pg:
                condition: service_healthy
        labels:
            qa-cutover-test.server-tag: \${QA_SERVER_IMAGE_TAG:?set QA_SERVER_IMAGE_TAG in .env}
YAML
    db_stand_in
    for c in "${EXTRA_DEPS[@]}"; do stand_in "$c" after; done
    ofelia_stand_in "${OFELIA_DEPS_AFTER[@]}"
    cat <<YAML
    qa-pg:
        image: $IMAGE
        container_name: qa-pg
        restart: always
        networks: [qa-pg]
        volumes:
            - qa-pg:/var/lib/postgresql
            - ./config/pg-init.sql:/docker-entrypoint-initdb.d/10-roles.sql:ro
            - ../../pg-slow-init.sh:/docker-entrypoint-initdb.d/20-slow.sh:ro
            - $VOLUME:/backup/:rw
        environment:
            POSTGRES_DB: queer-augsburg
            POSTGRES_USER: qa_owner
            POSTGRES_PASSWORD: \$POSTGRES_PASSWORD_QA
            POSTGRES_APP_PASSWORD: \$POSTGRES_APP_PASSWORD_QA
            POSTGRES_INITDB_ARGS: "$INITDB_ARGS"
        healthcheck:
            test: ["CMD", "pg_isready", "-q", "-h", "127.0.0.1", "-U", "qa_owner", "-d", "queer-augsburg"]
            interval: 1s
            retries: 300
volumes:
    qa-pg:
        name: qa-pg
    $VOLUME:
        name: $VOLUME
networks:
    qa-pg:
        name: qa-pg
YAML
} >"$work/compose-after.yml"
cp "$work/compose-after.yml" "$work/W/staged/docker-compose.yml"
# Another project's qa-server, with the stop settings of compose's, so that day step 2 gets
# past its stop check to the rm.
{
    echo services:
    stand_in qa-server
    printf '        stop_signal: %s\n        stop_grace_period: %ss\n' "$STOP_SIGNAL" "$GRACE_SECONDS"
} >"$work/$OTHER/docker-compose.yml"

compose() { # <project> <args…>: output to a log, printed on a failure
    local p=$1
    shift
    (cd "$(dir_of "$p")" &&
        timeout 900 docker compose -p "$p" "$@" </dev/null >>"$work/compose.log" 2>&1) ||
        { cat "$work/compose.log" >&2; fail "docker compose -p $p $*"; }
}
# Compose's down, tried again when it fails. Under heavy IO load a down failed once with
# "qa-ofelia Error while Stopping" and passed when run again; down is idempotent. Before the
# next try it waits until no container of the project is restarting or being removed, for up
# to SETTLE_SECONDS: a `docker run --rm … true` took up to 127 s under that load, and 300 s
# leaves room for twice that. Three tries, each bounded by the 900 s of compose(), so a fault
# that stays still fails the test, with compose's output.
SETTLE_SECONDS=300
down_project() { # <project>
    local attempt deadline
    for attempt in 1 2 3; do
        if (cd "$(dir_of "$1")" &&
            timeout 900 docker compose -p "$1" down -v -t 1 --remove-orphans </dev/null >>"$work/compose.log" 2>&1); then
            return 0
        fi
        echo "note: docker compose -p $1 down failed (try $attempt of 3)" >&2
        deadline=$((SECONDS + SETTLE_SECONDS))
        while [ -n "$(docker ps -aq --filter "label=com.docker.compose.project=$1" --filter status=restarting --filter status=removing)" ]; do
            [ "$SECONDS" -lt "$deadline" ] || break
            sleep 1
        done
    done
    cat "$work/compose.log" >&2
    fail "docker compose -p $1 down failed 3 times"
}
live_files() { # <before|after>: the compose file and config of results as the block finds them
    cp "$work/compose-$1.yml" "$work/D/results/docker-compose.yml"
    rm -rf "$work/D/results/config"
    cp -a "$work/config-$1" "$work/D/results/config"
}
# The attempt reset() names in $W/cutover: one of day step 2's form, written by no day step 2.
RESET_C=cutover-20000101-000000
reset() { # <before|after>: everything down, the project of results up as given
    local v
    down_project results
    down_project $OTHER
    docker rm -fv qa-server qa-pg >/dev/null 2>&1 || true
    for v in $VOLUMES; do
        if docker volume inspect "$v" >/dev/null 2>&1; then
            docker volume rm "$v" >/dev/null || fail "reset: cannot remove the volume $v"
        fi
    done
    live_files "$1"
    cp "$work/env" "$work/D/results/.env"
    rm -rf "${work:?}/backup/"* "${work:?}/saved/"* "${work:?}/s3/"* "$work/W/"cutover-* "$work/W/"rollback-* \
        "$work/W/server-started"
    echo "$RESET_C" >"$work/W/cutover"
    echo "stub migrate.yml" >"$work/W/$RESET_C.migrate.yml"
    compose results up -d --wait
    if [ "$1" = after ]; then
        # A table of qa_app's with a row, as the migrator leaves it: the restore check needs
        # one. Day step 5 has started the server, and recorded that.
        docker exec qa-pg psql -X -q -v ON_ERROR_STOP=1 -U qa_app -d queer-augsburg \
            -c "CREATE TABLE meetings (_id text PRIMARY KEY); INSERT INTO meetings VALUES ('m1')" >/dev/null
        date +%Y%m%d-%H%M%S >"$work/W/server-started"
    fi
}
# docker prints an empty line for a container that does not exist, so ask first.
state() {
    if docker container inspect "$1" >/dev/null 2>&1; then
        docker container inspect --format '{{.State.Status}}' "$1"
    else
        echo gone
    fi
}
volume_state() { if docker volume inspect qa-pg >/dev/null 2>&1; then echo exists; else echo gone; fi; }
project_of() { docker container inspect --format '{{index .Config.Labels "com.docker.compose.project"}}' "$1"; }
container_id() { docker container inspect --format '{{.Id}}' "$1"; }
# The id of each container, "gone" for none: <names…>
ids() {
    local c
    for c in "$@"; do
        if docker container inspect "$c" >/dev/null 2>&1; then echo "$c $(container_id "$c")"; else echo "$c gone"; fi
    done
}
# The qa-server that is not compose's of results: another project's or one without labels,
# running or created and never started. It has compose's stop settings.
foreign_server() { # <other|unlabelled> <running|created>
    # Without its save: this only makes room for the other one.
    docker rm -fv qa-server >/dev/null
    case $1-$2 in
        other-running) compose $OTHER up -d --wait ;;
        other-created) compose $OTHER create qa-server ;;
        unlabelled-running)
            docker run -d --name qa-server --init --tmpfs /var/lib/postgresql --stop-signal "$STOP_SIGNAL" \
                --stop-timeout "$GRACE_SECONDS" --entrypoint sleep $IMAGE infinity >/dev/null
            ;;
        unlabelled-created)
            docker create --name qa-server --init --tmpfs /var/lib/postgresql --stop-signal "$STOP_SIGNAL" \
                --stop-timeout "$GRACE_SECONDS" --entrypoint sleep $IMAGE infinity >/dev/null
            ;;
    esac
    [ "$(state qa-server)" = "$2" ] || fail "setup: the foreign qa-server is $(state qa-server), not $2"
    if [ "$1" = other ]; then
        [ "$(project_of qa-server)" = $OTHER ] || fail "the other project's qa-server has no project label"
    else
        [ -z "$(project_of qa-server)" ] || fail "the unlabelled qa-server has a project label"
    fi
    rm -f "$work/saved/marker"
}
run() { # <body>: as `ssh root@turing 'bash -s'` runs it, from a directory of its own; sets rc
    rc=0
    (cd "$work/W" && bash -s <"$work/$1" >"$work/out" 2>&1) || rc=$?
    cat "$work/out" >>"$work/all-out"
}
out() { cat "$work/out"; }
last_line() { tail -n 1 "$work/out"; }
stopped() { # <scenario>: the block stopped with STOP after the rm
    if [ "$rc" != 1 ] || ! grep -q '^STOP: ' "$work/out"; then
        fail "$1: rc $rc, expected 1 and STOP: $(out)"
    fi
    grep -q 'No stopped containers' "$work/out" ||
        fail "$1: rm -sf with no container of results did not say 'No stopped containers': $(out)"
}
# compose's qa-server got its stop signal and the time to save, and is removed.
saved() { # <scenario>
    [ "$(state qa-server)" = gone ] || fail "$1: qa-server is $(state qa-server)"
    [ "$(cat "$work/saved/marker" 2>/dev/null)" = saved ] ||
        fail "$1: qa-server was not given the $SAVE_SECONDS s to save on $STOP_SIGNAL (no marker): $(out)"
}
# compose's qa-server of results was not touched.
untouched() { # <scenario>
    if [ "$(state qa-server)" != running ] || [ "$(project_of qa-server)" != results ]; then
        fail "$1: compose's qa-server is $(state qa-server) now: $(out)"
    fi
    [ ! -e "$work/saved/marker" ] || fail "$1: qa-server got a $STOP_SIGNAL: $(out)"
}
dumped() { [ -n "$(ls -A "$work/backup")" ]; }
rollback_dumps() { docker exec qa-pg sh -c 'ls /backup' | grep '^rollback-' || true; }
verify_saved() { [ -n "$(find "$work/W" -name 'rollback-*.verify.txt')" ]; }
marker() { cat "$work/W/$1" 2>/dev/null || true; }
# qa-server printed this config as it started.
started_on() { # <scenario> <config file> <which config, for the message>
    docker logs qa-server >"$work/server.log" 2>&1
    [ "$(head -n "$(wc -l <"$2")" "$work/server.log")" = "config: $(cat "$2")" ] ||
        fail "$1: qa-server did not start on the $3 config: $(cat "$work/server.log")"
}
# Day step 2 normal: rc 0, the live files compared with P1's, compose's qa-server saved and
# removed, then the dump of MONGO_DB (after the save) and migrate.yml written and shown, qa-db
# running. Sets C.
day2_went_on() { # <scenario>
    [ "$rc" = 0 ] || fail "$1: rc $rc: $(out)"
    saved "$1"
    [ "$(state qa-db)" = running ] || fail "$1: qa-db is $(state qa-db)"
    C=$(cat "$work/W/cutover")
    if [ "$C" = "$RESET_C" ] || [ ! -f "$work/backup/$C/$MONGO_DB/marker" ]; then
        fail "$1: no dump of $MONGO_DB into $C: $(out)"
    fi
    [ "$(cat "$work/backup/$C/$MONGO_DB/marker")" = "dumped after the save" ] ||
        fail "$1: Mongo was dumped before the server had saved and was gone, so its last writes are not in the dump"
    # Named to the second, so that an attempt after R1 gets a directory of its own.
    [[ $C =~ ^cutover-[0-9]{8}-[0-9]{6}$ ]] || fail "$1: the dump directory $C is not named to the second"
    grep -qx "migrate-config stub qa-db $C" "$work/W/$C.migrate.yml" || fail "$1: no migrate.yml"
    grep -qx "migrate-config stub qa-db $C" "$work/out" || fail "$1: migrate.yml was not shown: $(out)"
    grep -qxF "$PINNED" "$work/out" || fail "$1: P1's check did not pass: $(out)"
}
day2() { # <scenario>: day step 2 after the old server ran again (R1, reset); it goes through
    rm -f "$work/saved/marker"
    run day2.sh
    day2_went_on "$1"
}
# Day step 3 stopped before it changed anything: the live files are still the old ones, qa-pg
# and its volume as before.
day3_stopped() { # <scenario> <STOP line> <qa-pg state before> <volume state before>
    if [ "$rc" != 1 ] || [ "$(last_line)" != "$2" ]; then fail "$1: rc $rc, expected 1 and '$2': $(out)"; fi
    cmp -s "$work/W/pre-postgres/docker-compose.rollback.yml" "$work/D/results/docker-compose.yml" ||
        fail "$1: the live compose file changed"
    diff -r "$work/W/pre-postgres/config" "$work/D/results/config" >&2 || fail "$1: the live config changed"
    [ "$(state qa-pg)" = "$3" ] || fail "$1: qa-pg is $(state qa-pg), it was $3"
    [ "$(volume_state)" = "$4" ] || fail "$1: the volume qa-pg $(volume_state), it was $4"
    [ "$(state qa-server)" = gone ] || fail "$1: qa-server is $(state qa-server)"
}
# Day step 3 normal: the new files live, qa-pg on its volume with qa_app and taking connections
# over TCP when the block returns.
day3_went_on() { # <scenario>
    [ "$rc" = 0 ] || fail "$1: rc $rc: $(out)"
    # At once, before anything else: the block returned only once qa-pg takes TCP connections.
    docker exec qa-pg pg_isready -q -h 127.0.0.1 -U qa_owner -d queer-augsburg ||
        fail "$1: day step 3 returned while qa-pg takes no connections over TCP (its first start is not done): $(out)"
    [ "$(last_line)" = qa_app ] || fail "$1: the last line is not the role check: $(out)"
    [ "$(state qa-pg)" = running ] || fail "$1: qa-pg is $(state qa-pg)"
    [ "$(volume_state)" = exists ] || fail "$1: no volume qa-pg"
    cmp -s "$work/W/staged/docker-compose.yml" "$work/D/results/docker-compose.yml" || fail "$1: the new compose file is not live"
    diff -r "$work/W/staged/config" "$work/D/results/config" >&2 || fail "$1: the new config is not live"
    [ "$(state qa-server)" = gone ] || fail "$1: qa-server is $(state qa-server)"
}
# Day step 4 normal: the migrator's report shown, kept and copied next to the dump, the owner
# check, the dump in the backup volume and its restore check passed.
day4_went_on() { # <scenario>
    [ "$rc" = 0 ] || fail "$1: rc $rc: $(out)"
    for line in 'MIGRATION VERIFIED (stub)' 'connected as: qa_app' 'RESTORE CHECK PASSED: the dump restores and equals the live database'; do
        grep -qxF "$line" "$work/out" || fail "$1: no line '$line': $(out)"
    done
    grep -q 'owner check passed' "$work/out" || fail "$1: the owner check did not run: $(out)"
    grep -qxF 'MIGRATION VERIFIED (stub)' "$work/W/$C.report.txt" || fail "$1: the report was not kept"
    cmp -s "$work/W/$C.report.txt" "$work/backup/$C/migration-report.txt" || fail "$1: the report is not next to the dump"
    docker exec qa-pg test -s /backup/queer-augsburg.pgdump || fail "$1: no dump in the backup volume"
    [ "$(state qa-server)" = gone ] || fail "$1: qa-server is $(state qa-server)"
}
# Day step 4 failed: no report next to the Mongo dump.
day4_failed() { # <scenario> <line it must show>
    [ "$rc" != 0 ] || fail "$1: rc 0: $(out)"
    grep -qxF "$2" "$work/out" || fail "$1: no line '$2': $(out)"
    [ ! -e "$work/backup/$C/migration-report.txt" ] || fail "$1: the report was copied next to the dump"
    [ "$(state qa-server)" = gone ] || fail "$1: qa-server is $(state qa-server)"
}
# Day step 5's first block went on: the server runs on the new config and listens, its start is
# recorded, an earlier R2's record is gone, and no other container changed.
day5() { # <scenario>
    ids qa-db "${EXTRA_DEPS[@]}" qa-pg qa-ofelia >"$work/ids-before-5"
    run day5.sh
    [ "$rc" = 0 ] || fail "$1: rc $rc: $(out)"
    [ "$(last_line)" = "$LISTENING" ] || fail "$1: the last line is not '$LISTENING': $(out)"
    if [ "$(state qa-server)" != running ] || [ "$(project_of qa-server)" != results ]; then
        fail "$1: qa-server is $(state qa-server) in project '$(project_of qa-server 2>/dev/null || true)'"
    fi
    started_on "$1" "$work/D/results/config/qa-server.yml" live
    [ -s "$work/W/server-started" ] || fail "$1: the server's start was not recorded"
    [ -z "$(marker rollback-checked)$(marker rollback-uploaded)" ] || fail "$1: an earlier R2's record is still there"
    ids qa-db "${EXTRA_DEPS[@]}" qa-pg qa-ofelia >"$work/ids-after-5"
    diff "$work/ids-before-5" "$work/ids-after-5" >&2 || fail "$1: day step 5 recreated or removed another container (above)"
}
# Day step 5's ofelia block went on: qa-ofelia created again, with the new jobs.
ofelia() { # <scenario>
    local before
    before=$(container_id qa-ofelia)
    ids qa-db "${EXTRA_DEPS[@]}" qa-pg qa-server >"$work/ids-before-5"
    run ofelia.sh
    [ "$rc" = 0 ] || fail "$1: rc $rc: $(out)"
    [ "$(last_line)" = 'New job registered "backup-qa-pg" - stub' ] || fail "$1: the last line: $(out)"
    [ "$(container_id qa-ofelia)" != "$before" ] || fail "$1: qa-ofelia was not created again"
    [ "$(docker logs qa-ofelia 2>&1)" = "$(ofelia_jobs "$work/D/results/config/ofelia.conf")" ] ||
        fail "$1: qa-ofelia has other jobs than the live config: $(docker logs qa-ofelia 2>&1)"
    ids qa-db "${EXTRA_DEPS[@]}" qa-pg qa-server >"$work/ids-after-5"
    diff "$work/ids-before-5" "$work/ids-after-5" >&2 || fail "$1: the ofelia block recreated or removed another container (above)"
}
# R1: every container but qa-server and qa-ofelia must be the same afterwards.
run_r1() { # [block, r1.sh by default]
    ids qa-db "${EXTRA_DEPS[@]}" qa-pg >"$work/ids-before-r1"
    run "${1:-r1.sh}"
}
# R1 went back: rc 0, the old compose file and config live, compose's qa-server running on
# the old config and listening, qa-ofelia created again with the old jobs, the other services
# running and not recreated, qa-pg stopped and kept or never created, P1's check the last line.
r1_went_back() { # <scenario> <exited|gone: qa-pg>
    [ "$rc" = 0 ] || fail "$1: rc $rc: $(out)"
    [ "$(last_line)" = "$PINNED" ] || fail "$1: the last line is not P1's check: $(out)"
    grep -qxF "$LISTENING" "$work/out" || fail "$1: 'Listening on' was not shown: $(out)"
    for c in qa-server qa-ofelia qa-db "${EXTRA_DEPS[@]}"; do
        if [ "$(state "$c")" != running ] || [ "$(project_of "$c")" != results ]; then
            fail "$1: $c is $(state "$c") in project '$(project_of "$c" 2>/dev/null || true)': $(out)"
        fi
    done
    # The logs in a file first: grep -q or head ending the pipe early would fail it (pipefail).
    started_on "$1" "$work/config-before/qa-server.yml" "before the cutover's"
    [ "$(docker logs qa-ofelia 2>&1)" = "$(ofelia_jobs "$work/config-before/ofelia.conf")" ] ||
        fail "$1: qa-ofelia has other jobs than before the cutover: $(docker logs qa-ofelia 2>&1)"
    [ "$(state qa-pg)" = "$2" ] || fail "$1: qa-pg is $(state qa-pg), expected $2"
    if [ "$2" = exited ] && [ "$(docker inspect --format '{{.HostConfig.RestartPolicy.Name}}' qa-pg)" != no ]; then
        fail "$1: the stopped qa-pg keeps its restart policy: a daemon restart would start it without config/pg-init.sql"
    fi
    ids qa-db "${EXTRA_DEPS[@]}" qa-pg >"$work/ids-after-r1"
    diff "$work/ids-before-r1" "$work/ids-after-r1" >&2 ||
        fail "$1: R1 recreated or removed a container it must leave alone (above: before, after)"
    cmp -s "$work/W/pre-postgres/docker-compose.rollback.yml" "$work/D/results/docker-compose.yml" ||
        fail "$1: the live compose file is not the one from before the cutover"
    diff -r "$work/W/pre-postgres/config" "$work/D/results/config" >&2 ||
        fail "$1: the live config is not the one from before the cutover"
}
r1() { # <scenario> <exited|gone>
    run_r1
    r1_went_back "$@"
}
# R2 went on: rc 0, qa-server gone, qa-pg running, a new dump that restores, recorded only after
# its restore check, the migrator's verify shown and saved. Sets K.
r2_went_on() { # <scenario>
    [ "$rc" = 0 ] || fail "$1: rc $rc: $(out)"
    [ "$(state qa-server)" = gone ] || fail "$1: qa-server is $(state qa-server)"
    [ "$(state qa-pg)" = running ] || fail "$1: qa-pg is $(state qa-pg)"
    K=$(marker rollback-checked)
    [[ $K =~ ^rollback-[0-9]{8}-[0-9]{6}$ ]] || fail "$1: R2 recorded no dump ('$K'): $(out)"
    rollback_dumps | grep -qxF "$K.pgdump" || fail "$1: dumps '$(rollback_dumps)', recorded '$K': $(out)"
    grep -qx 'RESTORE CHECK PASSED: the dump restores and equals the live database' "$work/out" ||
        fail "$1: the restore check did not pass: $(out)"
    [ -f "$work/W/$K.verify.txt" ] || fail "$1: no $K.verify.txt: $(out)"
    # The migrator saw the dump: it mounts the volume qa-pg dumps into. Its output is on the
    # terminal and in the file.
    for line in 'connected as: qa_app' "config: $(cat "$work/W/$(cat "$work/W/cutover").migrate.yml")" "dump: $K.pgdump" \
        'MIGRATION FAILED (stub: the counts differ after writes)'; do
        grep -qxF "$line" "$work/W/$K.verify.txt" || fail "$1: the migrator's verify has no '$line': $(cat "$work/W/$K.verify.txt")"
        grep -qxF "$line" "$work/out" || fail "$1: the migrator's verify was not shown: $(out)"
    done
}
r2() { # <scenario>
    run r2.sh
    r2_went_on "$1"
}
# Step 8 uploaded R2's dump and recorded it.
day8_uploaded() { # <scenario>
    local archive
    [ "$rc" = 0 ] || fail "$1: rc $rc: $(out)"
    [ "$(last_line)" = "uploaded with $K.pgdump" ] || fail "$1: the last line: $(out)"
    [ "$(marker rollback-uploaded)" = "$K" ] || fail "$1: recorded '$(marker rollback-uploaded)', expected $K"
    archive=$(find "$work/s3" -mindepth 1 -maxdepth 1 -name 'archive-*' | sort -V | tail -n 1)
    [ -s "$archive/$K.pgdump" ] || fail "$1: the upload does not hold $K.pgdump"
}
day8_refused() { # <scenario>: no upload recorded, no archive
    [ "$rc" != 0 ] || fail "$1: rc 0: $(out)"
    [ -z "$(marker rollback-uploaded)" ] || fail "$1: an upload was recorded: $(out)"
    [ -z "$(ls -A "$work/s3")" ] || fail "$1: something was uploaded: $(ls -A "$work/s3")"
}
# "Trying again" removed qa-pg with its volume and every record of the attempt.
again_removed() { # <scenario>
    run again.sh
    [ "$rc" = 0 ] || fail "$1: rc $rc: $(out)"
    [ "$(state qa-pg)" = gone ] || fail "$1: qa-pg is $(state qa-pg)"
    [ "$(volume_state)" = gone ] || fail "$1: the volume qa-pg is left"
    for m in server-started rollback-checked rollback-uploaded; do
        [ ! -e "$work/W/$m" ] || fail "$1: $m is left for the next attempt"
    done
}
# "Trying again" refused: qa-pg, its volume and the records as they were.
again_refused() { # <scenario>
    local pg
    pg=$(state qa-pg)
    run again.sh
    if [ "$rc" != 1 ] || [[ "$(last_line)" != "STOP: the server ran on qa-pg"* ]]; then fail "$1: rc $rc: $(out)"; fi
    [ "$(state qa-pg)" = "$pg" ] || fail "$1: qa-pg is $(state qa-pg), it was $pg"
    [ "$(volume_state)" = exists ] || fail "$1: the volume qa-pg was removed"
    [ -s "$work/W/server-started" ] || fail "$1: the record of the server's start was removed"
}

# --- Day step 1 --------------------------------------------------------------------------------

run version.sh
if [ "$VERSION" = "$TESTED" ]; then
    if [ "$rc" != 0 ] || [ "$(out)" != "docker compose $TESTED, as tested" ]; then
        fail "day step 1 with compose $VERSION: rc $rc: $(out)"
    fi
    pass "day step 1: compose $VERSION is turing's in 'Versions', it passes"
else
    if [ "$rc" != 1 ] || ! grep -qxF "STOP: docker compose on turing is '$VERSION', the cutover was tested with $TESTED; nothing was changed" "$work/out"; then
        fail "day step 1 with compose $VERSION: rc $rc: $(out)"
    fi
    pass "day step 1: compose $VERSION is not $TESTED, turing's in 'Versions': STOP, rc 1"
fi

# --- P4's record and day step 2 ------------------------------------------------------------------

reset before
[ "$(state qa-server)" = running ] || fail "setup: qa-server does not run"
# P4 as the README has it: it shows the differences and records what it compared.
run p4.sh
[ "$(wc -l <"$work/W/p4-compared.sha256")" = "$(find "$work/D/results/docker-compose.yml" "$work/D/results/config" \
    "$work/W/staged/docker-compose.yml" "$work/W/staged/config" -type f | wc -l)" ] ||
    fail "P4 did not record every file it compared: $(cat "$work/W/p4-compared.sha256")"
grep -qE '^\+ +qa-pg:$' "$work/out" || fail "P4 did not show the compose difference: $(out)"
pass "P4: shows the differences and records a checksum of each live and staged file"

run day2.sh
day2_went_on "day step 2 normal"
pass "day step 2: compose's qa-server has the stop settings it requires, saves on $STOP_SIGNAL and is removed, then the dump of $MONGO_DB and migrate.yml are written and shown, qa-db keeps running"

# R1 right after day step 2, before day step 3: no qa-pg exists; "Trying again" has nothing to do.
r1 "R1 right after day step 2" gone
pass "R1 right after day step 2 (no qa-pg): the old server listens on the old config, qa-ofelia has the old jobs, the other services are untouched, P1's check is the last line"
run again.sh
if [ "$rc" != 0 ] || [ "$(out)" != "$AGAIN_NONE" ]; then fail "Trying again with no volume qa-pg: rc $rc: $(out)"; fi
pass "Trying again with no volume qa-pg: changes nothing, rc 0"

# A compose file or config edited since P1, which P1's check (here and on turing) does not see:
# day step 2 stops before it stops anything.
edited_since_p1() { # <scenario> <what it must name>
    run day2.sh
    if [ "$rc" != 1 ] || [ "$(last_line)" != "$DAY2_STOP_P1" ]; then fail "$1: rc $rc, expected 1 and '$DAY2_STOP_P1': $(out)"; fi
    grep -qF -- "$2" "$work/out" || fail "$1: the difference '$2' was not shown: $(out)"
    grep -qxF "$PINNED" "$work/out" || fail "$1: setup: P1's check did not pass first: $(out)"
    untouched "$1"
    if dumped; then fail "$1: a dump was written"; fi
    [ "$(cat "$work/W/cutover")" = "$RESET_C" ] || fail "$1: \$W/cutover was written"
}
reset before
sed -i '/^    qa-db:$/a\        hostname: qa-db-edited-by-hand' "$work/D/results/docker-compose.yml"
edited_since_p1 "day step 2 with the compose file edited since P1" '+        hostname: qa-db-edited-by-hand'
pass "day step 2 with the compose file edited since P1 (P1's check passes): STOP, the difference shown, qa-server untouched, nothing dumped"
reset before
echo "# edited by hand" >>"$work/D/results/config/ofelia.conf"
edited_since_p1 "day step 2 with the config edited since P1" 'ofelia.conf'
pass "day step 2 with a config file edited since P1: STOP, the file named, qa-server untouched, nothing dumped"

# --- The day as the README has it, then R2's way back ------------------------------------------

reset before
# An edit kept by hand in the live config and in P1's copy (so day step 2 passes), but not
# made in staged/ and not compared by P4: day step 3 stops, as its copy would drop it.
echo "# kept by hand" >>"$work/D/results/config/ofelia.conf"
echo "# kept by hand" >>"$work/W/pre-postgres/config/ofelia.conf"
day2 "the day: day step 2"
run day3.sh
day3_stopped "the day: day step 3 with a live file changed since P4" "$DAY3_STOP_P4" gone gone
grep -qF "$work/D/results/config/ofelia.conf" "$work/out" || fail "the day: day step 3 did not name the changed live file: $(out)"
cp "$work/config-before/ofelia.conf" "$work/D/results/config/ofelia.conf"
cp "$work/config-before/ofelia.conf" "$work/W/pre-postgres/config/ofelia.conf"
pass "day step 2 with an edit kept in the live config and in P1's copy goes through; day step 3 then stops before the copy, as P4 did not compare it"
# A staged file changed after P4: day step 3 stops before it copies; P4 again, then it goes on.
echo "# edited after P4" >>"$work/W/staged/config/qa-server.yml"
run day3.sh
day3_stopped "the day: day step 3 with a staged file changed since P4" "$DAY3_STOP_P4" gone gone
grep -qF "$work/W/staged/config/qa-server.yml" "$work/out" || fail "the day: day step 3 did not name the changed file: $(out)"
pass "day step 3 with a staged file changed since P4: STOP before the copy, the file named, nothing changed"
run p4.sh
run day3.sh
day3_went_on "the day: day step 3 after P4 again"
pass "day step 3 after P4 again: the new compose file and config are live, qa-pg on its volume runs with qa_app and takes connections over TCP once the block returns, qa-server stays gone"
run day4.sh
day4_went_on "the day: day step 4"
pass "day step 4: the migrator as qa_app, the owner check, the dump in the backup volume and its restore check, the report kept and next to the Mongo dump"
day5 "the day: day step 5"
pass "day step 5: the server starts on the new config and listens, its start is recorded, no other container changed"
# The ofelia block with a config that lacks the job: it fails, the server keeps running; pasted
# again with the job it goes through.
server_id=$(container_id qa-server)
cp "$work/config-before/ofelia.conf" "$work/D/results/config/ofelia.conf"
run ofelia.sh
[ "$rc" != 0 ] || fail "the day: the ofelia block without the job: rc 0: $(out)"
[ "$(container_id qa-server)" = "$server_id" ] && [ "$(state qa-server)" = running ] ||
    fail "the day: the ofelia block without the job touched the server"
cp "$work/W/staged/config/ofelia.conf" "$work/D/results/config/ofelia.conf"
pass "day step 5's ofelia block with no backup-qa-pg job in the config: rc $rc, the server keeps running"
ofelia "the day: the ofelia block pasted again"
pass "day step 5's ofelia block pasted again: qa-ofelia created again with the new jobs, no other container changed"
again_refused "the day: Trying again while the server runs"
[ "$(state qa-server)" = running ] || fail "the day: Trying again touched the server"
pass "Trying again after day step 5: STOP, the server ran on qa-pg and no dump of it is recorded; nothing removed"
r2 "the day: R2"
saved "the day: R2"
pass "R2 after day step 5: the server saves and is removed, qa-pg's dump restores and is recorded after its check, the failed verify is shown and saved"
again_refused "the day: Trying again after R2 before step 8"
pass "Trying again after R2 before step 8: STOP, the dump is not uploaded; nothing removed"
r1 "the day: R1 after R2" exited
pass "R1 after R2: the old files are live, the old server listens, qa-ofelia has the old jobs, qa-pg is stopped and kept, the other services untouched"
pin_record other
run_r1
pin_record
[ "$rc" != 0 ] || fail "R1 pasted again with P1's check failing: rc 0: $(out)"
[ "$(last_line)" = "$PIN_STOP_IMAGE" ] || fail "R1 pasted again with P1's check failing: the last line is not P1's STOP: $(out)"
grep -qxF "$LISTENING" "$work/out" || fail "R1 pasted again with P1's check failing: it did not get to its check: $(out)"
pass "R1 pasted again with P1's check failing: it goes through to P1's check, which fails it, rc $rc"
# Step 8 with a recorded dump the backup volume does not have, and with the upload failing.
echo rollback-20000101-000000 >"$work/W/rollback-checked"
run day8.sh
echo "$K" >"$work/W/rollback-checked"
day8_refused "the day: step 8 with a recorded dump not in the backup volume"
grep -q '^STOP: .*the backup volume has no such dump' "$work/out" || fail "the day: step 8 with the dump missing: $(out)"
pass "step 8 with a recorded rollback dump not in the backup volume: STOP before the upload, nothing recorded"
touch "$work/s3/fail"
run day8.sh
rm "$work/s3/fail"
day8_refused "the day: step 8 with the upload failing"
pass "step 8 with the upload failing: rc $rc, nothing recorded"
run day8.sh
day8_uploaded "the day: step 8"
pass "step 8 after R2 and R1: uploads the backup volume with R2's dump and records it"
again_removed "the day: Trying again after R2, R1 and step 8"
pass "Trying again after R2, R1 and step 8: removes qa-pg and its volume, and the records of the attempt"
cp "$work/config-after/qa-server.yml" "$work/W/staged/config/qa-server.yml"
run p4.sh

# --- R2, then staying after all, then R1 alone ---------------------------------------------------

reset before
day2 "staying after R2: day step 2"
run day3.sh
day3_went_on "staying after R2: day step 3"
run day4.sh
day4_went_on "staying after R2: day step 4"
day5 "staying after R2: day step 5"
r2 "staying after R2: R2"
run day8.sh
day8_uploaded "staying after R2: step 8"
# Staying after all: the server again on the new files, which R2 left live.
day5 "staying after R2: day step 5 again"
pass "day step 5 again after R2 and step 8: the server runs again and the record of R2's dump is dropped"
r1 "staying after R2: R1 alone" exited
again_refused "staying after R2: Trying again after R1 alone"
pass "Trying again after the server ran again since R2's dump, then R1: STOP, nothing removed"
rm -f "$work/saved/marker"
r2 "staying after R2: R2 after R1"
saved "staying after R2: R2 after R1"
pass "R2 after R1: removes the old server, starts the stopped qa-pg again, its dump restores and is recorded"
r1 "staying after R2: R1 again" exited
run day8.sh
day8_uploaded "staying after R2: step 8 again"
again_removed "staying after R2: Trying again"
pass "then R1, step 8 and Trying again: qa-pg is removed after the upload of a dump taken after the server's last run"

# --- Day step 4 failing, day step 3 on an existing volume and without qa_app -------------------

reset before
day2 "migrator failing: day step 2"
run day3.sh
day3_went_on "migrator failing: day step 3"
echo "migrator fails" >>"$work/W/$C.migrate.yml"
run day4.sh
day4_failed "day step 4 with the migrator failing" 'MIGRATION FAILED (stub)'
grep -qxF 'MIGRATION FAILED (stub)' "$work/W/$C.report.txt" || fail "day step 4 with the migrator failing: the report was not kept"
if docker exec qa-pg test -e /backup/queer-augsburg.pgdump; then fail "day step 4 with the migrator failing: it went on to the dump"; fi
pass "day step 4 with the migrator failing: rc $rc behind tee, stops before the owner check and the dump"
r1 "R1 after day step 4 failed" exited
pass "R1 after day step 4 failed: went back, qa-pg stopped and kept"
again_removed "Trying again after day step 4 failed"
pass "Trying again after day step 4 failed (the server never ran): removes qa-pg and its volume"

day2 "unrestorable dump: day step 2"
run day3.sh
day3_went_on "unrestorable dump: day step 3"
echo "unrestorable" >>"$work/W/$C.migrate.yml"
run day4.sh
day4_failed "day step 4 with the restore check failing" 'RESTORE CHECK FAILED: pg_restore could not restore the dump'
grep -q 'owner check passed' "$work/out" || fail "day step 4 with the restore check failing: setup: the owner check did not pass first: $(out)"
pass "day step 4 with a dump that does not restore: rc $rc at the restore check, no report next to the Mongo dump"
r1 "R1 after day step 4's restore check failed" exited
# Day step 3 again while the volume qa-pg is left: it stops before it changes anything.
day2 "volume left: day step 2"
run day3.sh
day3_stopped "day step 3 with the volume qa-pg left" "$DAY3_STOP_VOLUME" exited exists
pass "day step 3 with an earlier attempt's volume qa-pg: STOP, nothing changed"
r1 "volume left: R1" exited
again_removed "volume left: Trying again"

# A pg-init.sql that creates no qa_app (P4 shows it, so it is recorded): day step 3 fails.
echo "-- creates nothing" >"$work/W/staged/config/pg-init.sql"
run p4.sh
day2 "no qa_app: day step 2"
run day3.sh
[ "$rc" != 0 ] || fail "day step 3 with a pg-init.sql that creates no qa_app: rc 0: $(out)"
[ "$(state qa-pg)" = running ] || fail "day step 3 with a pg-init.sql that creates no qa_app: setup: qa-pg is $(state qa-pg)"
pass "day step 3 with a pg-init.sql that creates no qa_app: rc $rc at the role check"
r1 "no qa_app: R1" exited
again_removed "no qa_app: Trying again"
cp "$work/config-after/pg-init.sql" "$work/W/staged/config/pg-init.sql"
run p4.sh

# --- Day step 5 with a server that never listens -------------------------------------------------

reset before
day2 "server not listening: day step 2"
run day3.sh
day3_went_on "server not listening: day step 3"
run day4.sh
day4_went_on "server not listening: day step 4"
echo "broken stub" >"$work/D/results/config/qa-server.yml"
ids qa-db "${EXTRA_DEPS[@]}" qa-pg qa-ofelia >"$work/ids-before-5"
run day5.sh
[ "$rc" = 1 ] && [ "$(last_line)" = "$DAY5_STOP" ] || fail "day step 5 with a server that never listens: rc $rc: $(out)"
[ "$(state qa-server)" = gone ] || fail "day step 5 with a server that never listens: qa-server is $(state qa-server), it can start later and take writes"
[ -s "$work/W/server-started" ] || fail "day step 5 with a server that never listens: its start was not recorded"
ids qa-db "${EXTRA_DEPS[@]}" qa-pg qa-ofelia >"$work/ids-after-5"
diff "$work/ids-before-5" "$work/ids-after-5" >&2 || fail "day step 5 with a server that never listens: another container changed (above)"
pass "day step 5 with a server that never listens: STOP after its wait, the server removed again, its start recorded, nothing else changed"
r2 "server not listening: R2"
grep -q 'No stopped containers' "$work/out" || fail "server not listening: R2 found a qa-server: $(out)"
pass "R2 after day step 5 failed: no server left, the dump restores and is recorded"
r1 "server not listening: R1" exited
run day8.sh
day8_uploaded "server not listening: step 8"
again_removed "server not listening: Trying again"
pass "then R1, step 8 and Trying again: went back, qa-pg removed after the upload"

# --- Day step 2: foreign servers, stop settings, failures ----------------------------------------

for kind in other unlabelled; do
    for status in running created; do
        reset before
        foreign_server $kind $status
        run day2.sh
        stopped "day step 2, qa-server $kind $status"
        if dumped; then fail "day step 2, qa-server $kind $status: a dump was written"; fi
        [ "$(cat "$work/W/cutover")" = "$RESET_C" ] || fail "day step 2, qa-server $kind $status: \$W/cutover was written"
        [ "$(state qa-server)" = $status ] || fail "day step 2, qa-server $kind $status: it is $(state qa-server) now"
        pass "day step 2, qa-server $kind $status: STOP, rc 1, nothing dumped, it stays $status"
    done
done
pass "rm -sf with no container of results exits 0 with 'No stopped containers', as the README says"

# A live qa-server created from a file without the grace period, or with a signal it cannot
# handle: P1 pinned that file, so it is the rollback file too. The block stops before it.
stop_settings_differ() { # <scenario> <sed expression on the old compose file> <its stop settings>
    sed "$2" "$work/compose-before.yml" >"$work/compose-variant.yml"
    if cmp -s "$work/compose-before.yml" "$work/compose-variant.yml"; then fail "setup: $1 changed nothing"; fi
    cp "$work/compose-variant.yml" "$work/D/results/docker-compose.yml"
    cp "$work/compose-variant.yml" "$work/W/pre-postgres/docker-compose.rollback.yml"
    docker rm -fv qa-server >/dev/null
    compose results up -d --no-deps qa-server
    rm -f "$work/saved/marker"
    [ "$(docker inspect --format '{{.Config.StopSignal}} {{.Config.StopTimeout}}' qa-server)" = "$3" ] ||
        fail "setup: $1: qa-server stops with $(docker inspect --format '{{.Config.StopSignal}} {{.Config.StopTimeout}}' qa-server)"
    run day2.sh
    if [ "$rc" != 1 ] || ! grep -q "^STOP: qa-server stops with '$3'" "$work/out"; then
        fail "$1: rc $rc, expected 1 and a STOP that names '$3': $(out)"
    fi
    untouched "$1"
    if dumped; then fail "$1: a dump was written"; fi
    [ "$(cat "$work/W/cutover")" = "$RESET_C" ] || fail "$1: \$W/cutover was written"
    pass "$1: day step 2 stops before it stops qa-server ('$3'), rc 1, nothing dumped"
}
reset before
stop_settings_differ "qa-server without stop_grace_period" '/^        stop_grace_period: /d' "$STOP_SIGNAL <nil>"
# The way on the README gives: the line back into P1's file by hand, then its block.
cp "$work/compose-before.yml" "$work/W/pre-postgres/docker-compose.rollback.yml"
run fix.sh
[ "$rc" = 0 ] && [ "$(last_line)" = "$PINNED" ] || fail "the stop-settings fix: rc $rc: $(out)"
grep -qxF "qa-server stops with '$STOP_SIGNAL $GRACE_SECONDS'" "$work/out" || fail "the stop-settings fix: $(out)"
cmp -s "$work/compose-before.yml" "$work/D/results/docker-compose.yml" || fail "the stop-settings fix: P1's file is not live"
[ "$(state qa-server)" = running ] || fail "the stop-settings fix: qa-server is $(state qa-server)"
day2 "day step 2 after the stop-settings fix"
pass "the stop-settings fix: P1's corrected file live, qa-server created from it ('$STOP_SIGNAL $GRACE_SECONDS', PINNED), then day step 2 goes through"
r1 "R1 after the stop-settings fix" gone
reset before
stop_settings_differ "qa-server with stop_signal SIGKILL" "s/^        stop_signal: .*/        stop_signal: SIGKILL/" \
    "SIGKILL $GRACE_SECONDS"
cp "$work/compose-before.yml" "$work/W/pre-postgres/docker-compose.rollback.yml"

reset before
pin_record other
run day2.sh
pin_record
[ "$rc" != 0 ] || fail "day step 2 with P1's check failing: rc 0: $(out)"
grep -qxF "$PIN_STOP_IMAGE" "$work/out" || fail "day step 2 with P1's check failing: not P1's STOP: $(out)"
untouched "day step 2 with P1's check failing"
if dumped; then fail "day step 2 with P1's check failing: a dump was written"; fi
[ "$(cat "$work/W/cutover")" = "$RESET_C" ] || fail "day step 2 with P1's check failing: \$W/cutover was written"
pass "day step 2 with P1's check failing: rc $rc, qa-server untouched and running, nothing dumped"

# Day step 2 failing after its rm, then the way back and the next try: pasted again it stops at
# P1's check, R1 goes back, day step 2 goes through with a dump directory of its own; day step
# 3 failing before qa-pg exists, R1 again.
mongodump_stub fail
reset before
run day2.sh
mongodump_stub
[ "$rc" != 0 ] || fail "day step 2 with mongodump failing: rc 0: $(out)"
saved "day step 2 with mongodump failing"
C=$(cat "$work/W/cutover")
if [ "$C" = "$RESET_C" ] || [ ! -f "$work/backup/$C/part" ]; then fail "day step 2 with mongodump failing: the stub did not run"; fi
[ ! -e "$work/W/$C.migrate.yml" ] || fail "day step 2 with mongodump failing: it went on to migrate.yml"
pass "day step 2 with mongodump failing: rc $rc, stops before migrate.yml"

FAILED_C=$C
(cd "$work" && find backup W | sort) >"$work/files-before"
ids "${CONTAINERS[@]}" >"$work/ids-before"
run day2.sh
if [ "$rc" != 1 ] || [ "$(last_line)" != "$PIN_STOP_IMAGE" ]; then
    fail "day step 2 pasted again after it failed past the rm: rc $rc, expected 1 and P1's STOP: $(out)"
fi
(cd "$work" && find backup W | sort) >"$work/files-after"
ids "${CONTAINERS[@]}" >"$work/ids-after"
diff "$work/files-before" "$work/files-after" >&2 || fail "day step 2 pasted again: files changed (above)"
diff "$work/ids-before" "$work/ids-after" >&2 || fail "day step 2 pasted again: containers changed (above)"
[ "$(cat "$work/W/cutover")" = "$FAILED_C" ] || fail "day step 2 pasted again: \$W/cutover was written"
pass "day step 2 pasted again after it failed past the rm: P1's check stops it (qa-server is gone), rc 1, no file and no container changed"

r1 "R1 after day step 2 failed past the rm" gone
pass "R1 after day step 2 failed past the rm and was pasted again (no qa-pg): went back as right after day step 2"

day2 "day step 2 again after R1"
[ "$C" != "$FAILED_C" ] || fail "day step 2 again after R1 dumped into the failed attempt's directory $C"
pass "day step 2 again after R1: goes through, with a dump directory of its own ($C after $FAILED_C)"

# Day step 3 without QA_SERVER_IMAGE_TAG in .env: compose refuses the new file at config -q,
# after the block copied the new files and before qa-pg exists.
grep -v '^QA_SERVER_IMAGE_TAG=' "$work/env" >"$work/D/results/.env"
run day3.sh
cp "$work/env" "$work/D/results/.env"
[ "$rc" != 0 ] || fail "day step 3 without QA_SERVER_IMAGE_TAG: rc 0: $(out)"
grep -q 'QA_SERVER_IMAGE_TAG' "$work/out" || fail "day step 3 without QA_SERVER_IMAGE_TAG: failed otherwise: $(out)"
[ "$(state qa-pg)" = gone ] || fail "day step 3 without QA_SERVER_IMAGE_TAG: qa-pg is $(state qa-pg)"
cmp -s "$work/compose-after.yml" "$work/D/results/docker-compose.yml" ||
    fail "day step 3 without QA_SERVER_IMAGE_TAG: setup: the new compose file was not copied before config -q"
pass "day step 3 without QA_SERVER_IMAGE_TAG: rc $rc at config -q, the new files are live, no qa-pg"
r1 "R1 after day step 3 failed before qa-pg existed" gone
pass "R1 after day step 3 failed before qa-pg existed: the old files are live again (pg-init.sql gone), the old server listens, the other services are untouched"

migrate_config_stub fail
reset before
run day2.sh
migrate_config_stub
[ "$rc" != 0 ] || fail "day step 2 with migrate-config.sh failing: rc 0: $(out)"
saved "day step 2 with migrate-config.sh failing"
C=$(cat "$work/W/cutover")
[ -f "$work/backup/$C/$MONGO_DB/marker" ] || fail "day step 2 with migrate-config.sh failing: no dump before it"
grep -qx 'no count for users' "$work/out" || fail "day step 2 with migrate-config.sh failing: the stub did not run: $(out)"
if grep -q '^dump_dir: ' "$work/out"; then fail "day step 2 with migrate-config.sh failing: it went on and showed the partial migrate.yml"; fi
pass "day step 2 with migrate-config.sh failing: rc $rc, stops before migrate.yml is shown"

reset before
foreign_server other running
run day2-unchecked.sh
if [ "$rc" != 0 ] || ! dumped || [ "$(state qa-server)" != running ]; then
    fail "control: day step 2 without the check did not dump with another project's qa-server running (rc $rc): $(out)"
fi
pass "control: without the check day step 2 dumps while another project's qa-server runs"

# --- R2 ----------------------------------------------------------------------------------------

reset after
if [ "$(state qa-server)" != running ] || [ "$(state qa-pg)" != running ]; then
    fail "setup after: qa-server or qa-pg does not run"
fi
# qa-pg was set up with the template's initdb arguments.
[ "$(docker exec qa-pg printenv POSTGRES_INITDB_ARGS)" = "$INITDB_ARGS" ] || fail "qa-pg has other initdb arguments"
IFS='|' read -r checksums provider locale encoding < <(docker exec qa-pg psql -X -tAq -U qa_owner -d queer-augsburg -c \
    "SELECT current_setting('data_checksums'), datlocprovider, coalesce(datlocale, ''), pg_encoding_to_char(encoding)
     FROM pg_database WHERE datname = current_database()")
read -ra initdb_args <<<"$INITDB_ARGS"
for arg in "${initdb_args[@]}"; do
    case $arg in
        --data-checksums) [ "$checksums" = on ] || fail "qa-pg: data_checksums is $checksums" ;;
        --locale-provider=builtin) [ "$provider" = b ] || fail "qa-pg: locale provider is $provider" ;;
        --builtin-locale=*) [ "$locale" = "${arg#*=}" ] || fail "qa-pg: locale is $locale" ;;
        --encoding=*) [ "$encoding" = "${arg#*=}" ] || fail "qa-pg: encoding is $encoding" ;;
        *) fail "the template's initdb argument $arg has no check here yet" ;;
    esac
done
pass "qa-pg runs with the template's initdb arguments ($INITDB_ARGS)"
r2 "R2 normal"
saved "R2 normal"
pass "R2: compose's qa-server saves on $STOP_SIGNAL and is removed, qa-pg keeps running, its dump restores and is recorded, the failed verify is shown and saved"
first_k=$K
r2 "R2 again"
[ "$K" != "$first_k" ] || fail "R2 again recorded the first dump"
pass "R2 again with no qa-server left goes on the same way, into a dump of its own"

# R1 after R2, as R2's prose says: qa-ofelia was created by day step 5 with the jobs after the
# cutover; only a recreate makes it read the old ones (compose does not recreate it for the
# changed config file or depends_on). Every service was created from the file after the
# cutover, so DIFFERING differs from the old file here.
r1 "R1 after R2" exited
pass "R1 after R2: qa-ofelia, created by day step 5 with the jobs after the cutover, is created again with the old ones; the old server listens on the old config, qa-pg is stopped, $DIFFERING (defined otherwise in the old file) and the other services are untouched"

for kind in other unlabelled; do
    for status in running created; do
        reset after
        foreign_server $kind $status
        run r2.sh
        stopped "R2, qa-server $kind $status"
        [ -z "$(rollback_dumps)" ] || fail "R2, qa-server $kind $status: dumped $(rollback_dumps)"
        if verify_saved; then fail "R2, qa-server $kind $status: wrote a verify"; fi
        [ "$(state qa-server)" = $status ] || fail "R2, qa-server $kind $status: it is $(state qa-server) now"
        [ "$(state qa-pg)" = running ] || fail "R2, qa-server $kind $status: qa-pg is $(state qa-pg)"
        pass "R2, qa-server $kind $status: STOP, rc 1, nothing dumped, it stays $status"
    done
done

# R2's compose check: on another compose it stops before anything. As the README has it when
# this compose is not the recorded one, and for one that cannot be the running one.
r2_compose_stop() { # <scenario> <version the block expects>
    if [ "$rc" != 1 ] || [ "$(wc -l <"$work/out")" != 1 ] ||
        ! grep -qxF "STOP: docker compose on turing is '$VERSION', the cutover was tested with $2; nothing was changed" "$work/out"; then
        fail "$1: rc $rc, expected 1 and the compose STOP only: $(out)"
    fi
    untouched "$1"
    [ -z "$(rollback_dumps)" ] || fail "$1: dumped $(rollback_dumps)"
    if verify_saved; then fail "$1: wrote a verify"; fi
}
reset after
run r2-other-compose.sh
r2_compose_stop "R2 expecting compose 0.0.0-cutovertest" 0.0.0-cutovertest
if [ "$VERSION" != "$TESTED" ]; then
    run r2-as-is.sh
    r2_compose_stop "R2 as the README has it, with compose $VERSION" "$TESTED"
    pass "R2 as the README has it stops at its compose check: compose $VERSION is not $TESTED"
fi
pass "R2 on another compose: STOP, rc 1, qa-server untouched and running, nothing dumped"

reset after
docker exec qa-pg psql -X -q -v ON_ERROR_STOP=1 -U qa_owner -d postgres \
    -c 'ALTER DATABASE "queer-augsburg" RENAME TO "qa-cutover-test-renamed"' >/dev/null
run r2.sh
[ "$rc" != 0 ] || fail "R2 with pg_dump failing: rc 0: $(out)"
saved "R2 with pg_dump failing"
grep -q 'pg_dump: error' "$work/out" || fail "R2 with pg_dump failing: pg_dump did not fail: $(out)"
if grep -q 'RESTORE CHECK' "$work/out" || verify_saved || [ -n "$(marker rollback-checked)" ]; then
    fail "R2 with pg_dump failing: it went on to the restore check, the record or the verify: $(out)"
fi
pass "R2 with pg_dump failing: rc $rc, stops before the restore check, the record and the verify"

# The restore check failing: no record, so after R1 "Trying again" refuses; R2 again after the
# cause is fixed goes through (and removes the old server R1 started), then R1, step 8 and
# "Trying again".
reset after
docker exec qa-pg psql -X -q -v ON_ERROR_STOP=1 -U qa_app -d queer-augsburg -c 'DROP TABLE meetings' >/dev/null
run r2.sh
[ "$rc" != 0 ] || fail "R2 with the restore check failing: rc 0: $(out)"
saved "R2 with the restore check failing"
grep -q '^RESTORE CHECK FAILED' "$work/out" || fail "R2 with the restore check failing: it did not fail: $(out)"
[ "$(rollback_dumps | wc -l)" = 1 ] || fail "R2 with the restore check failing: dumps '$(rollback_dumps)'"
[ -z "$(marker rollback-checked)" ] || fail "R2 with the restore check failing: the dump was recorded before its check"
if verify_saved; then fail "R2 with the restore check failing: it went on to the verify: $(out)"; fi
pass "R2 with the restore check failing: rc $rc, the dump is kept but not recorded, stops before the verify"
r1 "R1 after R2 failed" exited
again_refused "Trying again after R2 failed and R1"
pass "Trying again after R2 failed and R1: STOP, nothing removed"
# R2 again before the cause is fixed: it starts qa-pg again and fails as before.
rm -f "$work/saved/marker"
run r2.sh
if [ "$rc" = 0 ] || ! grep -q '^RESTORE CHECK FAILED' "$work/out"; then fail "R2 again after R2 failed and R1: rc $rc: $(out)"; fi
saved "R2 again after R2 failed and R1, still failing"
[ "$(state qa-pg)" = running ] || fail "R2 again after R1: qa-pg is $(state qa-pg)"
[ -z "$(marker rollback-checked)" ] || fail "R2 again after R1, failing: the dump was recorded"
pass "R2 after R2 failed and R1: removes the old server, starts qa-pg again (its pg-init.sql and restart policy back), fails at the restore check as before"
docker exec qa-pg psql -X -q -v ON_ERROR_STOP=1 -U qa_app -d queer-augsburg \
    -c "CREATE TABLE meetings (_id text PRIMARY KEY); INSERT INTO meetings VALUES ('m1')" >/dev/null
r2 "R2 again after R2 failed, R1 and the fix"
r1 "R1 again after R2 passed" exited
run day8.sh
day8_uploaded "step 8 after R2 passed"
again_removed "Trying again after R2 passed, R1 and step 8"
pass "R2 again after the fix (removing the old server R1 started), R1, step 8, Trying again: qa-pg removed after the upload"

# --- R1 ----------------------------------------------------------------------------------------

# Before day step 5, set up by hand: day step 2 removed qa-server, day step 3 made the compose
# file and config of the cutover live and started qa-pg; qa-ofelia runs with the jobs it read
# before. (R1 after the day steps 2 to 4 as the README has them runs above.)
before_step5() {
    reset before
    docker rm -fv qa-server >/dev/null
    live_files after
    compose results up -d --no-deps --wait qa-pg
}
# R1's compose check: on another compose it stops before anything.
r1_compose_stop() { # <scenario> <version the block expects> <qa-ofelia's id before>
    if [ "$rc" != 1 ] || [ "$(wc -l <"$work/out")" != 1 ] ||
        ! grep -qxF "STOP: docker compose on turing is '$VERSION', the cutover was tested with $2; nothing was changed" "$work/out"; then
        fail "$1: rc $rc, expected 1 and the compose STOP only: $(out)"
    fi
    cmp -s "$work/compose-after.yml" "$work/D/results/docker-compose.yml" || fail "$1: the live compose file changed"
    diff -r "$work/config-after" "$work/D/results/config" >&2 || fail "$1: the live config changed"
    [ "$(state qa-server)" = gone ] || fail "$1: qa-server is $(state qa-server)"
    [ "$(state qa-pg)" = running ] || fail "$1: qa-pg is $(state qa-pg)"
    [ "$(container_id qa-ofelia)" = "$3" ] || fail "$1: qa-ofelia was created again"
}
before_step5
ofelia_id=$(container_id qa-ofelia)
run r1-other-compose.sh
r1_compose_stop "R1 expecting compose 0.0.0-cutovertest" 0.0.0-cutovertest "$ofelia_id"
if [ "$VERSION" != "$TESTED" ]; then
    run r1-as-is.sh
    r1_compose_stop "R1 as the README has it, with compose $VERSION" "$TESTED" "$ofelia_id"
    pass "R1 as the README has it stops at its compose check: compose $VERSION is not $TESTED"
fi
pass "R1 on another compose: STOP, rc 1, no file and no container changed"

# A file in config/ that neither pre-postgres nor R1's rm accounts for: diff stops R1 before
# any container changes; moved out of config/ as the README says, R1 goes back.
echo "a file of the cutover's config" >"$work/D/results/config/extra.conf"
ids "${CONTAINERS[@]}" >"$work/ids-before"
run r1.sh
[ "$rc" != 0 ] || fail "R1 with a config it cannot restore: rc 0: $(out)"
grep -qF 'extra.conf' "$work/out" || fail "R1 with a config it cannot restore: diff did not name it: $(out)"
ids "${CONTAINERS[@]}" >"$work/ids-after"
diff "$work/ids-before" "$work/ids-after" >&2 || fail "R1 with a config it cannot restore: containers changed (above): $(out)"
[ "$(state qa-pg)" = running ] || fail "R1 with a config it cannot restore: qa-pg is $(state qa-pg)"
pass "R1 with a config it cannot restore: rc $rc at diff, no container created, recreated or stopped"
(cd "$work/D/results" && mv config/extra.conf ../extra.conf.cutover)
r1 "R1 after the file was moved out of config/" exited
pass "R1 after the README's next step (the file moved out of config/): went back"

# A compose file R1's config -q refuses: R1 stops before any container changes; with P1's file
# put right, R1 goes back.
before_step5
cp "$work/W/pre-postgres/docker-compose.rollback.yml" "$work/rollback-good.yml"
echo "    broken: [" >>"$work/W/pre-postgres/docker-compose.rollback.yml"
ids "${CONTAINERS[@]}" >"$work/ids-before"
run r1.sh
cp "$work/rollback-good.yml" "$work/W/pre-postgres/docker-compose.rollback.yml"
[ "$rc" != 0 ] || fail "R1 with a compose file config -q refuses: rc 0: $(out)"
ids "${CONTAINERS[@]}" >"$work/ids-after"
diff "$work/ids-before" "$work/ids-after" >&2 || fail "R1 with a compose file config -q refuses: containers changed (above): $(out)"
pass "R1 with a compose file config -q refuses: rc $rc, no container changed"
r1 "R1 after the compose file was put right" exited
pass "R1 after the README's next step (the cause fixed): went back"

# An old server that never listens: R1 stops after its wait, before P1's check; with the cause
# fixed, R1 goes back.
before_step5
echo "broken stub" >"$work/W/pre-postgres/config/qa-server.yml"
run r1.sh
cp "$work/config-before/qa-server.yml" "$work/W/pre-postgres/config/qa-server.yml"
[ "$rc" != 0 ] || fail "R1 with a server that never listens: rc 0: $(out)"
docker logs qa-server >"$work/server.log" 2>&1
grep -qx 'Error: connecting to the database' "$work/server.log" ||
    fail "R1 with a server that never listens: setup: $(cat "$work/server.log")"
if grep -q "PINNED" "$work/out"; then fail "R1 with a server that never listens: it went on to P1's check"; fi
pass "R1 with a server that never listens: rc $rc after its wait, before P1's check"
r1 "R1 after the old server's cause was fixed" exited
pass "R1 after the README's next step (the cause fixed): went back"

echo "deployment/tests/cutover-remove-server-docker.sh: all checks passed (docker compose $VERSION)"
