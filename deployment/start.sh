#!/bin/bash

mkdir results > /dev/null 2>&1
set -e

mozart render-dir templates/config/ -o results/config/

mozart yaml-to-json results/config/qa-web-ui.yml -o results/config/qa-web-ui.json
rm -rf results/config/qa-web-ui.yml

mozart yaml-to-json results/config/interossea-web-ui.yml -o results/config/interossea-web-ui.json
rm -rf results/config/interossea-web-ui.yml

mozart render templates/docker-compose.yml -o results/docker-compose.yml
mozart labels-to-compose results/docker-compose.yml -o results/docker-compose.yml

mozart render templates/admin.yml -o results/admin.yml

cp -r templates/email-templates results/
cp -r templates/data results/
find results/data -type f -exec chmod 0644 {} \;



docker compose -p qa --project-directory results/ up --build -d --remove-orphans 