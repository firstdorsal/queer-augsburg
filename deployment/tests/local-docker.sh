# shellcheck shell=bash
# Sourced by the tests that create containers on a real docker daemon
# (cutover-remove-server-docker.sh, pin-mongo-server-docker.sh); not a test of its own.
#
# local_docker <scratch dir> sends every later docker call of the test to the local daemon. It
# refuses a DOCKER_HOST that is not a unix:// socket and a DOCKER_CONTEXT other than `default`,
# before any docker call, and points DOCKER_CONFIG at a fresh directory, so the current
# context of your docker config does not apply either (on this machine one context points at
# turing). Call it before anything that runs docker, a cleanup trap included.
#
# COMPOSE, when set, names a compose release binary (the docker/compose release asset
# docker-compose-linux-x86_64, checked against its .sha256), which then runs as the
# `docker compose` plugin; without it the docker CLI's own plugin runs. Sets VERSION to the
# version `docker compose` runs. Needs fail() of the test.

local_docker() {
    case "${DOCKER_HOST:-}" in
        "" | unix://*) ;;
        *) fail "DOCKER_HOST=$DOCKER_HOST is not a local socket; the test runs against the local daemon only" ;;
    esac
    case "${DOCKER_CONTEXT:-default}" in
        default) unset DOCKER_CONTEXT ;;
        *) fail "DOCKER_CONTEXT=$DOCKER_CONTEXT; the test runs against the local daemon only, unset it" ;;
    esac
    export DOCKER_CONFIG=$1/docker-config
    mkdir -p "$DOCKER_CONFIG/cli-plugins"
    if [ -n "${COMPOSE:-}" ]; then
        [ -x "$COMPOSE" ] || fail "COMPOSE=$COMPOSE is not an executable file"
        ln -s "$(cd "$(dirname "$COMPOSE")" && pwd)/$(basename "$COMPOSE")" "$DOCKER_CONFIG/cli-plugins/docker-compose"
        [ "$(docker compose version --short)" = "$("$COMPOSE" version --short)" ] ||
            fail "docker compose does not run $COMPOSE (a cliPluginsExtraDirs or another plugin wins)"
    fi
    VERSION=$(docker compose version --short) || fail "no docker compose plugin; set COMPOSE"
    echo "docker compose $VERSION"
}
