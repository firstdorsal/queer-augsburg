#!/usr/bin/env bash
# Step P1 of the Postgres cutover (deployment/README.md, "Before the day"). Runs on turing
# BEFORE the cutover commit is merged to main, from a checkout of it on your machine:
#
#     ssh root@turing 'bash -s' <deployment/pin-mongo-server.sh
#     ssh root@turing 'bash -s -- --check' <deployment/pin-mongo-server.sh
#
# Why: until day step 3 production's compose names the server image without a tag
# (`image: firstdorsal/queer-augsburg-server`, which is `:latest`). From the merge of the
# cutover commit on, CI pushes the Postgres build as `:latest`. Any pull of all services
# (`update-containers.sh`, a web deploy without a service name) followed by any `up` would
# then recreate qa-server from the Postgres build with the mongodb:// config, and that build
# exits at start (`Error: connecting to the database`): the API is down. After this step
# qa-server is pinned to the image digest of the build running now, and a pull can fetch
# only that same image.
#
# What it does, in this order; any failing check stops it before the next action:
#
#   1. The live compose has exactly one untagged (or `:latest`) server image line, and the
#      running qa-server was created from that compose (compose's config hash).
#   2. The running qa-server is the Mongo build: its /config.yml has a mongodb:// db.url and
#      it answers 200 on /api/meetings_overview/, which reads the database. The Postgres
#      build connects to the database before it listens, and with a mongodb:// URL it exits
#      with status 1 instead (measured against mongo:7.0), so nothing would answer.
#   3. Its image (by the container's image id, never by a tag a pull may have moved) is
#      tagged `:pre-postgres`, and its Docker Hub digest is recorded.
#   4. /root/qa-cutover/pre-postgres gets today's compose, config and .env, the image id and
#      digest (server-image.txt), and docker-compose.rollback.yml: today's compose with the
#      server pinned to that digest. R1 installs that file again.
#   5. The pinned file becomes the live results/docker-compose.yml, `config --images` must
#      name the digest, qa-server is recreated from it, and the new container must run the
#      same image id and answer again (a few seconds without API, like a deploy).
#
# The last line is `PINNED <digest>`; the merge to main is allowed only after it.
# `--check` changes nothing and prints the same line when the live compose still pins the
# server to the recorded digest and the running qa-server is that image.
#
#     bash pin-mongo-server.sh --rewrite <compose in> <repo@sha256:digest> <compose out>
#
# only writes the pinned copy of a compose file (step 4's rewrite, with its checks);
# deployment/tests/env-scripts.sh tests it, deployment/tests/pin-mongo-server-docker.sh the
# whole step against a scratch compose and a local registry. The QA_PIN_* variables below
# exist for that test; on turing none is set.

set -euo pipefail

RESULTS=${QA_PIN_RESULTS:-/mnt/alpha/manifest/server/public/queer-augsburg/deployment/results}
W=${QA_PIN_CUTOVER:-/root/qa-cutover}
PROJECT=${QA_PIN_PROJECT:-results}
SERVICE=${QA_PIN_SERVICE:-qa-server}
CONTAINER=${QA_PIN_CONTAINER:-qa-server}
REPO=${QA_PIN_REPO:-firstdorsal/queer-augsburg-server}

repo_re=$(printf %s "$REPO" | sed 's/[.]/\\./g')

die() {
    echo "STOP: $*" >&2
    exit 1
}

# <compose in> <repo@sha256:digest> <compose out>: the copy of <compose in> whose one
# untagged (or `:latest`) server image line names the digest instead. Changes nothing and
# stops when that line is not there exactly once.
rewrite() {
    local in=$1 digest=$2 out=$3 count
    [ -f "$in" ] || die "no file $in"
    printf %s "$digest" | grep -Eqx "${repo_re}@sha256:[0-9a-f]{64}" ||
        die "'$digest' is not $REPO@sha256:<64 hex digits>"
    count=$(grep -Ec "^ *image: ${repo_re}(:latest)? *\$" "$in" || true)
    if [ "$count" != 1 ]; then
        if grep -Eq "^ *image: ${repo_re}@sha256:" "$in"; then
            die "$in already pins the server to a digest: P1 has run (check it with --check); nothing changed"
        fi
        die "$in has $count lines 'image: $REPO' without a tag, expected 1: the server's image line was edited by hand; nothing changed (README, P1)"
    fi
    sed -E "s#^( *image: )${repo_re}(:latest)? *\$#\\1${digest}#" "$in" >"$out"
    # Lines that differ (diff's output format is not the same in busybox and GNU).
    [ "$(awk 'NR == FNR { a[FNR] = $0; n = FNR; next } a[FNR] != $0 { c++ } END { print (FNR == n ? c + 0 : -1) }' "$in" "$out")" = 1 ] ||
        die "the rewrite changed more than the image line"
    grep -Eqx " *image: ${repo_re}@sha256:[0-9a-f]{64}" "$out" || die "the rewrite left no pinned line"
}

compose() {
    docker compose -p "$PROJECT" "$@"
}

# The server lines among the images compose resolves for the project (all services).
server_images() {
    compose "$@" config --images | grep -E "^(docker\.io/)?${repo_re}([:@]|\$)" || true
}

# Step 2: the container is the Mongo build. Prints nothing of the config but its scheme.
mongo_build_check() {
    local state labels config url scheme v6 v4 addr code codes=""
    state=$(docker inspect --format '{{.State.Running}} {{.State.Restarting}}' "$CONTAINER")
    [ "$state" = "true false" ] || die "$CONTAINER is not running steadily (running, restarting: $state)"
    labels=$(docker inspect --format '{{index .Config.Labels "com.docker.compose.project"}} {{index .Config.Labels "com.docker.compose.service"}}' "$CONTAINER")
    [ "$labels" = "$PROJECT $SERVICE" ] || die "$CONTAINER is not service $SERVICE of project $PROJECT ($labels)"
    # The file as the container sees it, through the daemon (the image has no shell).
    config=$(docker cp "$CONTAINER:/config.yml" - | tar -xOf -) || die "cannot read /config.yml of $CONTAINER"
    url=$(awk '/^db:/ { d = 1; next } /^[^ #]/ { d = 0 } d && !f && /^ +url:/ { sub(/^ +url: */, ""); print; f = 1 }' <<<"$config")
    # Only the scheme is ever printed: the rest may hold a password.
    scheme=$(printf %s "$url" | sed -nE 's#^([a-z][a-z0-9+]*)://.*#\1#p')
    [ "$scheme" = mongodb ] ||
        die "db.url in $CONTAINER's /config.yml is '${scheme:-(no scheme)}://…', not mongodb://: this is not the Mongo server"
    # Every address of the container, IPv6 first; the server listens on [::]:80. Docker
    # prints an absent address as "" or "invalid IP", hence the patterns.
    v6=$(docker inspect --format '{{range .NetworkSettings.Networks}}{{println .GlobalIPv6Address}}{{end}}' "$CONTAINER" |
        grep -Ex '[0-9a-fA-F]*:[0-9a-fA-F:]*' | sed 's/.*/[&]/' || true)
    v4=$(docker inspect --format '{{range .NetworkSettings.Networks}}{{println .IPAddress}}{{end}}' "$CONTAINER" |
        grep -Ex '[0-9]+(\.[0-9]+){3}' || true)
    [ -n "$v6$v4" ] || die "$CONTAINER has no address"
    for addr in $v6 $v4; do
        code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 "http://$addr/api/meetings_overview/" || true)
        if [ "$code" = 200 ]; then
            echo "$CONTAINER: db.url mongodb://, /api/meetings_overview/ 200 at $addr: the Mongo server"
            return 0
        fi
        codes+=" $addr:$code"
    done
    die "$CONTAINER answered no 200 on /api/meetings_overview/ (address:status$codes)"
}

# Waits until the container answers 200 again after a recreate. Each try runs in a subshell
# because mongo_build_check stops the script on the first failure (die exits).
wait_answer() {
    local _
    for _ in $(seq 60); do
        (mongo_build_check) >/dev/null 2>&1 && return 0
        sleep 1
    done
    mongo_build_check
}

check() {
    local id digest
    [ -f "$W/pre-postgres/server-image.txt" ] || die "no $W/pre-postgres/server-image.txt: P1 has not run"
    read -r id digest <"$W/pre-postgres/server-image.txt"
    cd "$RESULTS"
    [ "$(server_images)" = "$digest" ] ||
        die "results/docker-compose.yml does not pin the server to $digest (config --images: $(server_images | tr '\n' ' '))"
    [ "$(docker inspect --format '{{.Image}}' "$CONTAINER")" = "$id" ] ||
        die "$CONTAINER does not run the image of $W/pre-postgres/server-image.txt"
    echo "PINNED $digest"
}

pin() {
    local hash label id digests digest stage
    cd "$RESULTS"
    [ ! -e "$W/pre-postgres" ] ||
        die "$W/pre-postgres exists from an earlier run: it is the way back, keep it (check the pin with --check)"
    mkdir -p "$W"
    chmod 700 "$W"

    # 1. Today's compose, and the container created from it.
    [ "$(server_images | grep -Ec "^(docker\.io/)?${repo_re}(:latest)?\$" || true)" = 1 ] ||
        die "compose does not resolve the server to $REPO without a tag (config --images: $(server_images | tr '\n' ' ')); README, P1"
    hash=$(compose config --hash "$SERVICE" | awk '{ print $2 }')
    label=$(docker inspect --format '{{index .Config.Labels "com.docker.compose.config-hash"}}' "$CONTAINER")
    [ -n "$hash" ] && [ "$hash" = "$label" ] ||
        die "the running $CONTAINER was not created from today's docker-compose.yml (config hash): an up would also apply that difference; find it first"

    # 2. The Mongo build.
    mongo_build_check

    # 3. Its image by id, and the digest a pull resolves to exactly it.
    id=$(docker inspect --format '{{.Image}}' "$CONTAINER")
    digests=$(docker image inspect --format '{{range .RepoDigests}}{{println .}}{{end}}' "$id")
    digest=$(grep -m 1 -E "^${repo_re}@sha256:[0-9a-f]{64}\$" <<<"$digests") ||
        die "the running server image has no $REPO digest (built locally?)"

    # 4. The way back, written to a staging directory first and moved in one step.
    stage=$(mktemp -d "$W/pre-postgres.XXXXXX")
    # A stop before the move leaves no half-written copy (it holds .env) behind.
    trap 'rm -rf "$stage"' EXIT
    cp -a docker-compose.yml config .env "$stage/"
    rewrite docker-compose.yml "$digest" "$stage/docker-compose.rollback.yml"
    [ "$(server_images -f "$stage/docker-compose.rollback.yml" --project-directory .)" = "$digest" ] ||
        die "config --images of the pinned file does not name $digest"
    echo "$id $digest" >"$stage/server-image.txt"
    docker tag "$id" "$REPO:pre-postgres"
    mv "$stage" "$W/pre-postgres"
    trap - EXIT

    # 5. Live: the pinned file, qa-server recreated from it, same image, answering.
    cp "$W/pre-postgres/docker-compose.rollback.yml" docker-compose.yml
    compose config -q
    [ "$(server_images)" = "$digest" ] || die "the live compose does not resolve the server to $digest"
    compose up -d --no-deps --force-recreate "$SERVICE" ||
        die "recreating $SERVICE from the pinned compose failed; it is live already. Before the merge, going back is: cp $W/pre-postgres/docker-compose.yml docker-compose.yml"
    [ "$(docker inspect --format '{{.Image}}' "$CONTAINER")" = "$id" ] ||
        die "the recreated $CONTAINER runs another image; go back: cp $W/pre-postgres/docker-compose.yml docker-compose.yml"
    wait_answer
    check
}

case "${1:-}" in
    "") pin ;;
    --check) check ;;
    --rewrite)
        [ "$#" = 4 ] || die "usage: pin-mongo-server.sh --rewrite <compose in> <repo@sha256:digest> <compose out>"
        rewrite "$2" "$3" "$4"
        ;;
    *) die "usage: pin-mongo-server.sh [--check | --rewrite <compose in> <repo@sha256:digest> <compose out>]" ;;
esac
