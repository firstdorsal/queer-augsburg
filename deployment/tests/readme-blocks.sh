# shellcheck shell=bash
# Sourced by the tests that run blocks of deployment/README.md (env-scripts.sh,
# cutover-remove-server-docker.sh); not a test of its own. Needs fail() of the test.

# readme_blocks <readme> <dir>: the body of every `ssh root@turing 'bash -s' <<'EOF'` block as
# <dir>/<n>.sh, in the order of the README, dedented as far as its fence is indented (a block
# in a list item is indented).
readme_blocks() {
    mkdir -p "$2"
    awk -v out="$2" '
        /^ *```sh$/ { inblock = 1; indent = index($0, "`") - 1; body = 0; next }
        inblock && /^ *```$/ { inblock = 0; next }
        inblock {
            line = substr($0, indent + 1)
            if (line == "ssh root@turing '\''bash -s'\'' <<'\''EOF'\''") { n++; file = out "/" n ".sh"; body = 1; next }
            if (body && line == "EOF") { body = 0; close(file); next }
            if (body) print line >file
        }' "$1"
}

# readme_turing_compose <readme>: the compose version "Versions" records for turing, the one
# day step 1 has to accept.
readme_turing_compose() {
    local version
    # shellcheck disable=SC2016 # a literal backtick
    version=$(sed -n 's/^ *Docker Compose \([0-9][0-9.]*\) (Arch package `docker-compose .*/\1/p' "$1")
    [ -n "$version" ] && [ "$(printf '%s\n' "$version" | wc -l)" = 1 ] ||
        fail "expected one line 'Docker Compose <version> (Arch package …' in the README's Versions"
    echo "$version"
}

# readme_block <dir> <extended regex> <out>: copies the one block with a line matching the
# regex to <out>; none or more than one is a failure.
readme_block() {
    local found
    found=$(grep -lE -- "$2" "$1"/*.sh || true)
    [ -n "$found" ] && [ "$(printf '%s\n' "$found" | wc -l)" = 1 ] ||
        fail "expected one block in the README with a line matching '$2', found: ${found:-none}"
    cp "$found" "$3"
}
