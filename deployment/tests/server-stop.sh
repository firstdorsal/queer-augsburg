# shellcheck shell=bash
# Sourced by the tests that check how qa-server is stopped (env-scripts.sh,
# cutover-remove-server-docker.sh); not a test of its own. Needs fail() of the test.

# server_stop <deployment dir> <scratch dir>: how compose stops qa-server, read from the
# sources, as STOP_SIGNAL (the template's stop_signal of qa-server, or else the server image's
# STOPSIGNAL in server/Dockerfile) and GRACE_SECONDS (the template's stop_grace_period of
# qa-server), and how long the server's save may take, as SAVE_SECONDS (ROOMS_SHUTDOWN_TIMEOUT
# in server/src/main.rs). Fails on none, more than one or an unparseable value, on a signal the
# server cannot handle, on a save of 10 s or less (docker's default stop timeout, and a likely
# `-t`: a stop with that or any shorter timeout must lose the stand-in's save), and on a grace
# period that does not cover the save with GRACE_MARGIN to spare (after the rooms the server's
# open requests end and the process exits).
GRACE_MARGIN=5
one_value() { # <what> <file> <file name for messages> <extended regex with one group>
    local found
    found=$(sed -nE "s/$4/\\1/p" "$2")
    [ -n "$found" ] && [ "$(printf '%s\n' "$found" | wc -l)" = 1 ] ||
        fail "expected one $1 in $3, found: ${found:-none}"
    printf '%s\n' "$found"
}
server_stop() {
    local template=$1/templates/docker-compose.yml server_src=$1/../server
    SAVE_SECONDS=$(one_value ROOMS_SHUTDOWN_TIMEOUT "$server_src/src/main.rs" server/src/main.rs \
        '^const ROOMS_SHUTDOWN_TIMEOUT: Duration = Duration::from_secs\(([0-9]+)\);$')
    awk '/^[^ ]/ || /^    [A-Za-z0-9_-]+:$/ { in_server = ($0 == "    qa-server:") } in_server' \
        "$template" >"$2/template-qa-server.yml"
    [ "$(grep -c '^ *stop_grace_period:' "$2/template-qa-server.yml")" = 1 ] ||
        fail "templates/docker-compose.yml: expected one stop_grace_period in qa-server"
    GRACE_SECONDS=$(one_value "stop_grace_period of qa-server in seconds" "$2/template-qa-server.yml" \
        templates/docker-compose.yml '^        stop_grace_period: ([0-9]+)s$')
    case $(grep -c '^ *stop_signal:' "$2/template-qa-server.yml") in
        0) STOP_SIGNAL=$(one_value STOPSIGNAL "$server_src/Dockerfile" server/Dockerfile '^STOPSIGNAL (SIG[A-Z0-9]+)$') ;;
        1) STOP_SIGNAL=$(one_value "stop_signal of qa-server" "$2/template-qa-server.yml" \
            templates/docker-compose.yml '^        stop_signal: (SIG[A-Z0-9]+)$') ;;
        *) fail "templates/docker-compose.yml: more than one stop_signal in qa-server" ;;
    esac
    case $STOP_SIGNAL in
        SIGKILL | SIGSTOP) fail "qa-server stops with $STOP_SIGNAL, which it cannot handle: the rooms would not be saved" ;;
    esac
    [ "$SAVE_SECONDS" -gt 10 ] ||
        fail "ROOMS_SHUTDOWN_TIMEOUT is $SAVE_SECONDS s: the stand-in's save would fit into a stop -t 10 and could not tell it from the grace period; give the stand-in a save of its own"
    [ "$GRACE_SECONDS" -ge $((SAVE_SECONDS + GRACE_MARGIN)) ] ||
        fail "templates/docker-compose.yml: qa-server's stop_grace_period ${GRACE_SECONDS}s is less than ROOMS_SHUTDOWN_TIMEOUT ($SAVE_SECONDS s, server/src/main.rs) plus $GRACE_MARGIN s: the rooms may not be saved"
}

# day2_stop_check <day step 2's block>: the stop signal and timeout day step 2 requires of the
# live qa-server before it stops it, as "<signal> <seconds>", from its one line
# `if [ "$STOP_SETTINGS" != "<signal> <seconds>" ]; then`.
day2_stop_check() {
    # shellcheck disable=SC2016 # a literal $STOP_SETTINGS of the block
    one_value "stop settings check" "$1" "day step 2" '^ *if \[ "\$STOP_SETTINGS" != "(SIG[A-Z0-9]+ [0-9]+)" \]; then$'
}
