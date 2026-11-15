#!/usr/bin/env bash
# Step P1 of the Postgres cutover (pin-mongo-server.sh) and update-containers.sh against a real
# docker daemon: a scratch compose project, a local registry (so images have digests as on
# Docker Hub) and two stand-ins built from nginx:alpine. The "Mongo build" answers on
# /api/meetings_overview/ only with a mongodb:// db.url; the "Postgres build" exits 1 with one,
# as the real server does (DB::connect before it listens).
#
#     PIN_TEST_REGISTRY_PORT=$(port-registry alloc deploy-pin-registry) \
#         COMPOSE=/path/to/docker-compose bash deployment/tests/pin-mongo-server-docker.sh
#
# COMPOSE as in local-docker.sh: turing's compose release, or without it the docker CLI's own
# plugin. Talks to the local daemon only (local-docker.sh: a remote DOCKER_HOST or
# DOCKER_CONTEXT is refused before any docker call). Needs docker, curl, and the images
# nginx:alpine and registry:3.0.0 (pulled if missing). Everything it creates is named
# qa-pin-test-* and removed at the end. Not in CI: the test-deployment job has no docker
# daemon; env-scripts.sh covers the rewrite there.
#
# Checked: without the pin, a pull of every service and an up swap qa-server for the Postgres
# build (the window this closes); P1 refuses a server that is not the Mongo build, a compose
# the container was not created from and a second run; P1 pins and recreates the Mongo build;
# afterwards update-containers.sh's pull and an up keep it while :latest is the Postgres build.

set -euo pipefail

DEPLOYMENT=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
PORT=${PIN_TEST_REGISTRY_PORT:?set PIN_TEST_REGISTRY_PORT to a port from port-registry}
P=qa-pin-test
REGISTRY=127.0.0.1:$PORT
REPO=$REGISTRY/$P/server
work=$(mktemp -d)

fail() {
    echo "FAIL: $*" >&2
    exit 1
}
pass() {
    echo "ok: $*"
}

# Before the cleanup trap, which runs docker too.
trap 'rm -rf "$work"' EXIT
# shellcheck source-path=SCRIPTDIR source=local-docker.sh
. "$DEPLOYMENT/tests/local-docker.sh"
local_docker "$work"

cleanup() {
    (cd "$work/results" 2>/dev/null && docker compose -p $P down -v --remove-orphans >/dev/null 2>&1) || true
    docker rm -fv $P-server $P-registry >/dev/null 2>&1 || true
    # By reference only (tags and digests of the test's names), never by image id: an id
    # can carry other names, nginx:alpine's for one.
    docker image ls --digests --format '{{.Repository}} {{.Tag}} {{.Digest}}' | grep -E "^($REGISTRY/$P/|$P-)" |
        awk '$2 != "<none>" { print $1 ":" $2 } $3 != "<none>" { print $1 "@" $3 }' |
        sort -u | xargs -r docker rmi >/dev/null 2>&1 || true
    docker network rm $P-net >/dev/null 2>&1 || true
    rm -rf "$work"
}
trap cleanup EXIT

docker image inspect nginx:alpine >/dev/null 2>&1 || docker pull -q nginx:alpine >/dev/null
docker image inspect registry:3.0.0 >/dev/null 2>&1 || docker pull -q registry:3.0.0 >/dev/null
docker run -d --name $P-registry -p "$REGISTRY:5000" registry:3.0.0 >/dev/null
for _ in $(seq 30); do curl -fsS "http://$REGISTRY/v2/" >/dev/null 2>&1 && break; sleep 1; done
curl -fsS "http://$REGISTRY/v2/" >/dev/null

# The two builds.
mkdir "$work/image"
cat >"$work/image/start.sh" <<'SH'
#!/bin/sh
url=$(awk '/^db:/ { d = 1; next } /^[^ #]/ { d = 0 } d && /^ +url:/ { sub(/^ +url: */, ""); print; exit }' /config.yml)
case "$url" in
    "$SCHEME"://*) ;;
    *) echo "Error: connecting to the database"; exit 1 ;;
esac
# Like the real server, which needs a moment to connect before it listens: P1 has to wait for it.
sleep "${START_DELAY:-0}"
echo "Listening on http://[::]:80"
exec nginx -g 'daemon off;'
SH
cat >"$work/image/Dockerfile" <<'DOCKERFILE'
FROM nginx:alpine
ARG SCHEME
ENV SCHEME=$SCHEME
RUN mkdir -p /usr/share/nginx/html/api/meetings_overview \
    && echo '{"meetings":[]}' >/usr/share/nginx/html/api/meetings_overview/index.html
COPY start.sh /start.sh
ENTRYPOINT ["sh", "/start.sh"]
DOCKERFILE
docker build -q --pull=false --build-arg SCHEME=mongodb -t $P-mongo "$work/image" >/dev/null
docker build -q --pull=false --build-arg SCHEME=postgres -t $P-postgres "$work/image" >/dev/null
MONGO_ID=$(docker image inspect --format '{{.Id}}' $P-mongo)
POSTGRES_ID=$(docker image inspect --format '{{.Id}}' $P-postgres)
publish_latest() { # <mongo|postgres>: what CI does on main, `:latest` moves to that build
    docker tag "$P-$1" "$REPO:latest"
    docker push -q "$REPO:latest" >/dev/null
}

# A production-like project: results/ with the compose, config and .env.
setup() { # <db url scheme>
    (cd "$work/results" 2>/dev/null && docker compose -p $P down -v --remove-orphans >/dev/null 2>&1) || true
    rm -rf "$work/results" "$work/cutover"
    mkdir -p "$work/results/config"
    cat >"$work/results/docker-compose.yml" <<YAML
services:
    qa-server:
        image: $REPO
        container_name: $P-server
        restart: always
        environment:
            START_DELAY: "4"
        networks:
            - $P-net
        volumes:
            - ./config/qa-server.yml:/config.yml:ro
networks:
    $P-net:
        name: $P-net
YAML
    # shellcheck disable=SC2016 # a literal $MONGODB_ROOT_PASSWORD, as in production's qa-server.yml
    printf 'http:\n    internalAddress: "[::]:80"\ndb:\n    url: %s://root:$MONGODB_ROOT_PASSWORD@qa-db.localhost:27030\ninterossea:\n    url: http://interossea\n' "$1" \
        >"$work/results/config/qa-server.yml"
    echo 'MONGODB_ROOT_PASSWORD_QA=unused' >"$work/results/.env"
}
# Compose's output goes to a log, printed when a call fails or takes longer than 5 minutes.
in_results() {
    (cd "$work/results" && timeout 300 docker compose -p $P "$@" </dev/null >>"$work/compose.log" 2>&1) ||
        { cat "$work/compose.log" >&2; fail "docker compose $*"; }
}
up() { in_results up -d "$@"; }
pull_all() { in_results pull -q; }
running_image() { docker inspect --format '{{.Image}}' $P-server; }
pin() { # [args]
    QA_PIN_RESULTS=$work/results QA_PIN_CUTOVER=$work/cutover QA_PIN_PROJECT=$P \
        QA_PIN_CONTAINER=$P-server QA_PIN_REPO=$REPO bash -s -- "$@" <"$DEPLOYMENT/pin-mongo-server.sh"
}
# update-containers.sh as it is, only the repository name of the stand-in in place of the
# real one, in a deployment directory of its own next to results/.
update_containers() {
    sed "s#firstdorsal/queer-augsburg-server#$REPO#g" "$DEPLOYMENT/update-containers.sh" >"$work/update-containers.sh"
    (cd "$work" && bash update-containers.sh >"$work/update.out" 2>&1)
}
answers() {
    local addr
    addr=$(docker inspect --format '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' $P-server)
    [ "$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 "http://$addr/api/meetings_overview/" || true)" = 200 ]
}
wait_answers() {
    for _ in $(seq 30); do answers && return 0; sleep 1; done
    return 1
}
no_way_back_saved() {
    [ ! -e "$work/cutover/pre-postgres" ] || fail "a refused P1 left $work/cutover/pre-postgres"
    if docker image inspect "$REPO:pre-postgres" >/dev/null 2>&1; then fail "a refused P1 tagged :pre-postgres"; fi
}

# --- Without the pin: the window ----------------------------------------------------------

publish_latest mongo
setup mongodb
up
wait_answers || fail "the Mongo stand-in does not answer"
[ "$(running_image)" = "$MONGO_ID" ] || fail "setup does not run the Mongo stand-in"
if update_containers; then fail "update-containers.sh pulled with the server untagged"; fi
grep -q 'without a fixed build' "$work/update.out" || fail "update-containers.sh message: $(cat "$work/update.out")"
publish_latest postgres
pull_all
up
[ "$(running_image)" = "$POSTGRES_ID" ] || fail "the control did not swap the server: the test cannot see the window"
sleep 3
if answers; then fail "the Postgres stand-in answers with a mongodb:// config"; fi
pass "control: untagged, a pull of every service and an up swap qa-server for the Postgres build, which stops answering; update-containers.sh refuses to pull"

# --- P1 refuses what is not the way back ----------------------------------------------------

# The server already swapped (as above, still running): restarting, or not answering.
if pin >"$work/out" 2>&1; then fail "P1 accepted a swapped server"; fi
grep -q 'STOP: ' "$work/out" || fail "P1 output for a swapped server: $(cat "$work/out")"
no_way_back_saved
pass "P1 refuses a server already swapped for the Postgres build, saves and tags nothing ($(grep 'STOP: ' "$work/out" | head -n 1 | cut -c 7-60)…)"

# A server that answers, but not on Mongo.
publish_latest postgres
setup postgres
up
wait_answers || fail "the Postgres stand-in does not answer with a postgres:// config"
if pin >"$work/out" 2>&1; then fail "P1 accepted a server with a postgres:// db.url"; fi
grep -q "STOP: db.url in $P-server's /config.yml is 'postgres://…', not mongodb://" "$work/out" || fail "P1 output: $(cat "$work/out")"
no_way_back_saved
pass "P1 refuses a running server whose db.url is not mongodb://"

# The compose was edited after the container was created.
publish_latest mongo
setup mongodb
up
wait_answers || fail "the Mongo stand-in does not answer"
sed -i 's#^        restart: always#        restart: always\n        stop_grace_period: 20s#' "$work/results/docker-compose.yml"
if pin >"$work/out" 2>&1; then fail "P1 accepted a compose the container was not created from"; fi
grep -q 'was not created from today' "$work/out" || fail "P1 output for a changed compose: $(cat "$work/out")"
no_way_back_saved
pass "P1 refuses when the running server was not created from today's compose"

# An image line compose reads, but not in the form P1 rewrites (a hand edit): the stop comes
# in step 4, after the staging copy was made, and must leave nothing behind.
setup mongodb
sed -i "s#^        image: $REPO\$#        image: $REPO  \# the server#" "$work/results/docker-compose.yml"
grep -q '  # the server$' "$work/results/docker-compose.yml" || fail "the hand edit did not apply"
up
wait_answers || fail "the Mongo stand-in does not answer"
if pin >"$work/out" 2>&1; then fail "P1 accepted an image line it cannot rewrite"; fi
grep -q "without a tag, expected 1: the server's image line was edited by hand; nothing changed" "$work/out" || fail "P1 output for a hand edit: $(cat "$work/out")"
no_way_back_saved
[ -z "$(find "$work/cutover" -mindepth 1 -maxdepth 1 -name 'pre-postgres*')" ] || fail "a stop in step 4 left a staging copy"
grep -q '  # the server$' "$work/results/docker-compose.yml" || fail "a refused P1 changed the live compose"
pass "P1 stops on a server image line it cannot rewrite, removes its staging copy, changes nothing"

# --- P1 ----------------------------------------------------------------------------------

setup mongodb
up
wait_answers || fail "the Mongo stand-in does not answer"
CONTAINER_BEFORE=$(docker inspect --format '{{.Id}}' $P-server)
pin >"$work/out" 2>&1 || fail "P1 failed: $(cat "$work/out")"
DIGEST=$(sed -n 's/^PINNED //p' "$work/out")
printf %s "$DIGEST" | grep -Eqx "$REPO@sha256:[0-9a-f]{64}" || fail "P1 printed no PINNED line: $(cat "$work/out")"
[ "$(tail -n 1 "$work/out")" = "PINNED $DIGEST" ] || fail "PINNED is not the last line"
grep -qx "        image: $DIGEST" "$work/results/docker-compose.yml" || fail "the live compose is not pinned"
[ "$(cd "$work/results" && docker compose -p $P config --images)" = "$DIGEST" ] || fail "config --images does not print the digest"
[ "$(running_image)" = "$MONGO_ID" ] || fail "P1 left another image running"
[ "$(docker inspect --format '{{.Id}}' $P-server)" != "$CONTAINER_BEFORE" ] || fail "P1 did not recreate the server from the pinned compose"
wait_answers || fail "the server does not answer after P1"
[ "$(docker image inspect --format '{{.Id}}' "$REPO:pre-postgres")" = "$MONGO_ID" ] || fail ":pre-postgres is not the Mongo build"
[ "$(cat "$work/cutover/pre-postgres/server-image.txt")" = "$MONGO_ID $DIGEST" ] || fail "server-image.txt"
for f in docker-compose.yml docker-compose.rollback.yml config/qa-server.yml .env; do
    [ -e "$work/cutover/pre-postgres/$f" ] || fail "pre-postgres lacks $f"
done
grep -qx "        image: $REPO" "$work/cutover/pre-postgres/docker-compose.yml" || fail "the saved original is not today's compose"
cmp -s "$work/cutover/pre-postgres/docker-compose.rollback.yml" "$work/results/docker-compose.yml" || fail "the live compose is not the rollback file"
[ "$(stat -c %a "$work/cutover")" = 700 ] || fail "the cutover directory is not 700"
pass "P1 pins the live compose to the Mongo build's digest, recreates the server from it, tags :pre-postgres, saves the way back"

pin --check >"$work/out" 2>&1 || fail "--check after P1: $(cat "$work/out")"
[ "$(cat "$work/out")" = "PINNED $DIGEST" ] || fail "--check output: $(cat "$work/out")"
if pin >"$work/out" 2>&1; then fail "P1 ran twice"; fi
grep -q 'pre-postgres exists from an earlier run' "$work/out" || fail "second P1 output: $(cat "$work/out")"
pass "--check prints PINNED; a second P1 stops and keeps the way back"

# --- The window, pinned: CI moved :latest to the Postgres build ------------------------------

publish_latest postgres
update_containers || fail "update-containers.sh refused the pinned compose: $(cat "$work/update.out")"
up
[ "$(running_image)" = "$MONGO_ID" ] || fail "update-containers.sh and an up swapped the pinned server"
wait_answers || fail "the pinned server does not answer after the pull and up"
pull_all
up --force-recreate
[ "$(running_image)" = "$MONGO_ID" ] || fail "a pull and a forced recreate swapped the pinned server"
wait_answers || fail "the pinned server does not answer after a forced recreate"
docker rm -f $P-server >/dev/null
docker rmi -f "$MONGO_ID" >/dev/null
if docker image inspect "$MONGO_ID" >/dev/null 2>&1; then fail "the Mongo stand-in is still there locally"; fi
up
[ "$(running_image)" = "$MONGO_ID" ] || fail "without the local image, compose did not fetch exactly the pinned build"
pin --check >/dev/null 2>&1 || fail "--check after the window"
pass "pinned: update-containers.sh, a pull of every service, up and a forced recreate keep the Mongo build while :latest is the Postgres build; without the local image the digest fetches the same build"

echo "deployment/tests/pin-mongo-server-docker.sh: all checks passed (docker compose $VERSION)"
