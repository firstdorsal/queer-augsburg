#!/usr/bin/env bash
# Builds the backup image and runs its HEALTHCHECK command against a recent, an outdated and a
# missing last-backup timestamp. Run from anywhere: bash backup/tests/healthcheck.sh
set -euo pipefail
HERE=$(cd "$(dirname "$0")/.." && pwd)
IMAGE=qa-backup-healthcheck-test
docker build -q -t "$IMAGE" "$HERE" >/dev/null
trap 'docker rmi -f "$IMAGE" >/dev/null' EXIT

# The command exactly as the image declares it, so a wrong path in the Dockerfile fails here.
read -r -a CHECK < <(docker image inspect --format '{{range $i, $a := .Config.Healthcheck.Test}}{{if gt $i 0}}{{$a}} {{end}}{{end}}' "$IMAGE" | sed 's/^CMD-SHELL //')

fail=0
expect() { # <name> <expected exit> <shell that prepares /app_data>
    set +e
    docker run --rm --network none -e AWS_S3_BUCKET_NAME=test -e ENCRYPTION_PASSWORD=test \
        --entrypoint sh "$IMAGE" -c "mkdir -p /app_data && $3 && ${CHECK[*]}" >/dev/null 2>&1
    local got=$?
    set -e
    if [ "$got" = "$2" ]; then echo "ok   $1"; else echo "FAIL $1: exit $got, expected $2"; fail=1; fi
}

# The timestamps are computed by the container's sh, so the single quotes keep them literal.
# shellcheck disable=SC2016
expect "a backup an hour ago is healthy" 0 'echo $(( $(date +%s) - 3600 )) >/app_data/last_backup'
# shellcheck disable=SC2016
expect "a backup three weeks ago is unhealthy" 1 'echo $(( $(date +%s) - 21 * 24 * 3600 )) >/app_data/last_backup'
expect "no backup yet is unhealthy" 1 'true'

exit "$fail"
