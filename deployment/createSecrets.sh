#!/bin/bash
# Renders templates/secrets.env into a new results/.env with fresh random passwords. Only for
# a new deployment: on an existing one it would replace every secret, and the databases keep
# the passwords they were initialised with. Add single values by hand, or the Postgres
# passwords with add-postgres-secrets.sh (README "The Postgres cutover").
set -e
# The file holds every secret.
umask 077
mkdir -p results
if [ -e results/.env ]; then
    echo "results/.env exists: not replacing it (see the comment in createSecrets.sh;" \
        "for the Postgres passwords: bash add-postgres-secrets.sh results/.env)" >&2
    exit 1
fi
mpm render templates/secrets.env > results/.env
