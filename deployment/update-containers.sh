#!/usr/bin/env bash
# Pulls the images of every service of results/docker-compose.yml; starts and recreates
# nothing (`docker compose -p results up -d …` does that afterwards).
#
# Refuses while the compose would pull the server image without a fixed build: the plain
# name or `:latest` moves with every build CI pushes from main, so a pull followed by an
# `up` could swap qa-server for another build, the Postgres build included. Fixed are a
# digest (`@sha256:…`, from step P1 of the Postgres cutover until day step 3) and a tag of one
# CI build (`:${QA_SERVER_IMAGE_TAG}` from results/.env, from day step 3 on, README "Server
# image"). deployment/tests/env-scripts.sh tests the refusal.

set -euo pipefail

cd "$(dirname "$0")"
compose=(docker compose -f results/docker-compose.yml)

images=$("${compose[@]}" config --images)
if grep -Ex '(docker\.io/)?firstdorsal/queer-augsburg-server(:latest)?' <<<"$images" >/dev/null; then
    echo "results/docker-compose.yml runs firstdorsal/queer-augsburg-server without a fixed build" >&2
    echo "(no tag or :latest), so a pull could swap the server. Pin it first: deployment/README.md," >&2
    echo "'Server image', or P1 of the Postgres cutover. Nothing was pulled." >&2
    exit 1
fi
"${compose[@]}" pull
