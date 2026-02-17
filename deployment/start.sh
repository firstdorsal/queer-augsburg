#!/bin/bash

set -euo pipefail

export RUST_LOG=trace

mkdir results > /dev/null 2>&1 || true


mpm template -i templates/config/ -o results/config/ --variable config:config.yml

mpm tools yaml-to-json -i results/config/qa-web-ui.yml -o results/config/qa-web-ui.json
rm -rf results/config/qa-web-ui.yml

mpm tools yaml-to-json -i results/config/interossea-web-ui.yml -o results/config/interossea-web-ui.json
rm -rf results/config/interossea-web-ui.yml

mpm template -i templates/docker-compose.yml -o results/docker-compose.yml --variable config:config.yml
mpm tools flatten-object -i results/docker-compose.yml -o results/docker-compose.yml

mpm template -i templates/admin.yml -o results/admin.yml --variable config:config.yml --variable secrets:./results/.env

cp -r templates/email-templates results/
cp -r templates/data results/
find results/data -type f -exec chmod 0644 {} \;
#mkdir -p results/config/mattermost
#chmod 0777 results/config/mattermost/


docker compose -p qa --project-directory results/ up --build -d --remove-orphans 