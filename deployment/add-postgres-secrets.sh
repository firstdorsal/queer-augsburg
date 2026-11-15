#!/usr/bin/env bash
# Adds the two Postgres passwords to an existing .env (on turing: results/.env) and leaves
# every other line as it is. createSecrets.sh is not for that: it renders the whole of
# templates/secrets.env again and so replaces every secret, the Mongo root passwords
# included, which the running databases would then refuse.
#
#     bash add-postgres-secrets.sh results/.env           add what is missing, check both
#     bash add-postgres-secrets.sh --check results/.env   only check
#
# A missing POSTGRES_PASSWORD_QA or POSTGRES_APP_PASSWORD_QA gets 64 random letters and
# digits; one that is there is kept. Both must be at least 32 letters and digits, each set
# once and not equal to each other: the server pastes the app password into the URL of
# db.url unencoded (qa-server.yml), where '/', '@', '#', '%' or '+' break it, and compose cuts
# a value at '$'. Prints the names of the variables, never a value. Exit 0 when both are good.
#
# deployment/tests/env-scripts.sh tests it.

set -euo pipefail

usage() {
    echo "usage: add-postgres-secrets.sh [--check] <env file>" >&2
    exit 2
}

check_only=no
file=
for arg in "$@"; do
    case $arg in
        --check) check_only=yes ;;
        -*) usage ;;
        *)
            [ -z "$file" ] || usage
            file=$arg
            ;;
    esac
done
[ -n "$file" ] || usage
if [ ! -f "$file" ]; then
    echo "no file $file: this adds to the existing .env, it never creates one" >&2
    exit 1
fi

NAMES=(POSTGRES_PASSWORD_QA POSTGRES_APP_PASSWORD_QA)

alnum() {
    local out=""
    while [ "${#out}" -lt "$1" ]; do
        out+=$(head -c 256 /dev/urandom | LC_ALL=C tr -dc 'A-Za-z0-9')
    done
    printf %s "${out:0:$1}"
}

value_of() {
    sed -n "s/^$1=//p" "$file"
}

if [ "$check_only" = no ]; then
    for name in "${NAMES[@]}"; do
        if grep -q "^$name=" "$file"; then
            echo "$name: kept"
            continue
        fi
        # A last line without a newline would swallow the new one.
        if [ -s "$file" ] && [ "$(tail -c 1 "$file" | od -An -c | tr -d ' ')" != '\n' ]; then
            echo >>"$file"
        fi
        echo "$name=$(alnum 64)" >>"$file"
        echo "$name: added"
    done
fi

failed=no
for name in "${NAMES[@]}"; do
    count=$(grep -c "^$name=" "$file" || true)
    if [ "$count" != 1 ]; then
        echo "$name: set $count times, must be once" >&2
        failed=yes
        continue
    fi
    if ! value_of "$name" | grep -Eqx '[A-Za-z0-9]{32,}'; then
        echo "$name: must be at least 32 letters and digits, nothing else" >&2
        failed=yes
    fi
done
if [ "$failed" = no ] && [ "$(value_of POSTGRES_PASSWORD_QA)" = "$(value_of POSTGRES_APP_PASSWORD_QA)" ]; then
    echo "POSTGRES_PASSWORD_QA and POSTGRES_APP_PASSWORD_QA must differ" >&2
    failed=yes
fi
if [ "$(stat -c %a "$file")" != 600 ]; then
    echo "note: $file has mode $(stat -c %a "$file"); it holds every secret, 600 is enough"
fi
if [ "$failed" = yes ]; then
    exit 1
fi
echo "Postgres passwords in $file: ok"
