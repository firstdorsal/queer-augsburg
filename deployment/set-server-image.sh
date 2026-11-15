#!/usr/bin/env bash
# Sets the tag of the server image in an .env (on turing: results/.env). The compose file
# runs `firstdorsal/queer-augsburg-server:${QA_SERVER_IMAGE_TAG}` and refuses to start
# without it, so the tag in .env alone decides which build runs: a deploy sets the new tag,
# going back sets the previous one. A tag names one build: the `:<short sha>` CI pushes, or
# a local tag like `pre-postgres` made with `docker tag` from a running container's image.
# `latest` is refused: it moves with every build on main.
#
#     bash set-server-image.sh results/.env 1a2b3c4d
#
# Prints the old and the new tag. Every other line of the file stays as it is.
# deployment/tests/env-scripts.sh tests it.

set -euo pipefail

if [ "$#" != 2 ]; then
    echo "usage: set-server-image.sh <env file> <tag>" >&2
    exit 2
fi
file=$1
tag=$2
if [ ! -f "$file" ]; then
    echo "no file $file" >&2
    exit 1
fi
if ! printf %s "$tag" | grep -Eqx '[A-Za-z0-9_][A-Za-z0-9_.-]{0,127}'; then
    echo "not a docker tag: '$tag'" >&2
    exit 1
fi
if [ "$tag" = latest ]; then
    echo "latest is not a tag of one build: use the short sha of the CI build" >&2
    exit 1
fi
count=$(grep -c '^QA_SERVER_IMAGE_TAG=' "$file" || true)
if [ "$count" -gt 1 ]; then
    echo "QA_SERVER_IMAGE_TAG is set $count times in $file; remove all but one by hand" >&2
    exit 1
fi
old=$(sed -n 's/^QA_SERVER_IMAGE_TAG=//p' "$file")

# Rewritten through a copy of the file, so its owner and mode stay.
tmp=$(mktemp "$file.XXXXXX")
trap 'rm -f "$tmp"' EXIT
cp -p "$file" "$tmp"
if [ "$count" = 1 ]; then
    awk -v tag="$tag" '/^QA_SERVER_IMAGE_TAG=/ { print "QA_SERVER_IMAGE_TAG=" tag; next } { print }' "$file" >"$tmp"
else
    cat "$file" >"$tmp"
    if [ -s "$tmp" ] && [ "$(tail -c 1 "$tmp" | od -An -c | tr -d ' ')" != '\n' ]; then
        echo >>"$tmp"
    fi
    echo "QA_SERVER_IMAGE_TAG=$tag" >>"$tmp"
fi
mv "$tmp" "$file"
trap - EXIT
echo "QA_SERVER_IMAGE_TAG: ${old:-(not set)} -> $tag"
