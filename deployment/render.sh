#!/bin/bash
# Renders the templates into a directory: config/, docker-compose.yml, email-templates/ and
# data/. start.sh renders into results/ and starts the stack; on turing the Postgres cutover
# renders into a staging directory with production's config.yml and compares it with
# results/ first (README "The Postgres cutover"). Starts nothing, reads no secret.
#
#     bash render.sh <output dir> <config.yml>
#
# MPM names the mows-cli binary (default `mpm`; a newer local build is `mows`).

set -euo pipefail

if [ "$#" != 2 ]; then
    echo "usage: render.sh <output dir> <config.yml>" >&2
    exit 2
fi
[ -f "$2" ] || { echo "no config file $2" >&2; exit 1; }
mkdir -p "$1"
# Both as absolute paths: the templates are read relative to this script.
out=$(cd "$1" && pwd)
config=$(cd "$(dirname "$2")" && pwd)/$(basename "$2")
mpm=${MPM:-mpm}
cd "$(dirname "$0")"

"$mpm" template -i templates/config/ -o "$out/config/" --variable "config:$config"

"$mpm" tools yaml-to-json -i "$out/config/qa-web-ui.yml" -o "$out/config/qa-web-ui.json"
rm -f "$out/config/qa-web-ui.yml"

"$mpm" tools yaml-to-json -i "$out/config/interossea-web-ui.yml" -o "$out/config/interossea-web-ui.json"
rm -f "$out/config/interossea-web-ui.yml"

"$mpm" template -i templates/docker-compose.yml -o "$out/docker-compose.yml" --variable "config:$config"
"$mpm" tools flatten-object -i "$out/docker-compose.yml" -o "$out/docker-compose.yml"

cp -r templates/email-templates "$out/"
cp -r templates/data "$out/"
find "$out/data" -type f -exec chmod 0644 {} \;
