#!/bin/bash

set -euo pipefail

export RUST_LOG=trace

bash render.sh results config.yml

mpm template -i templates/admin.yml -o results/admin.yml --variable config:config.yml --variable secrets:./results/.env

#mkdir -p results/config/mattermost
#chmod 0777 results/config/mattermost/


docker compose -p qa --project-directory results/ up --build -d --remove-orphans 
