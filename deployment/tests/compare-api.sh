#!/usr/bin/env bash
# Tests the comparison of compare-api.sh on made-up captures: what must count as identical
# (another DTSTAMP, get_meetings in another order), what is only another order (meetings at
# the same time swapped in the overview or the feed) and what differs.
#
#     bash deployment/tests/compare-api.sh      (needs jq)

set -euo pipefail

DEPLOYMENT=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT

fail() {
    echo "FAIL: $*" >&2
    exit 1
}
pass() {
    echo "ok: $*"
}

compare() {
    local code=0
    bash "$DEPLOYMENT/compare-api.sh" compare "$work/before" "$work/$1" >"$work/out" 2>&1 || code=$?
    echo "$code"
}

overview() {
    # $1 $2: the two meetings in this order.
    printf '{"time_zone":"Europe/Berlin","meetings":[%s,%s],"truncated":false}' "$1" "$2"
}
A='{"id":"aaaaa","start":"2026-11-10T19:00","title":"Gleichzeitig A","place":null,"online":false,"platform":null,"place_to_be_announced":false,"hybrid":false,"cancelled":false,"url":"https://queer-augsburg.de/treffen/aaaaa"}'
B='{"id":"bbbbb","start":"2026-11-10T19:00","title":"Gleichzeitig B","place":"Ort","online":false,"platform":null,"place_to_be_announced":false,"hybrid":false,"cancelled":false,"url":"https://queer-augsburg.de/treffen/bbbbb"}'

ical() {
    # $1: DTSTAMP, then the events' UIDs in order.
    local stamp=$1
    shift
    printf 'BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:ICALENDAR-RS\r\nCALSCALE:GREGORIAN\r\nX-WR-CALNAME:Queer Augsburg\r\n'
    for uid in "$@"; do
        printf 'BEGIN:VEVENT\r\nDTSTAMP:%s\r\nDTSTART:20261110T180000Z\r\nSUMMARY:Treffen %s\r\nUID:%s@queer-augsburg.de\r\nEND:VEVENT\r\n' "$stamp" "$uid" "$uid"
    done
    printf 'END:VCALENDAR\r\n'
}

meetings() {
    printf '{"meetings":[%s],"selected_total_count":2,"last_updated":1762800000000}' "$1"
}
MA='{"_id":"aaaaa","title":"Gleichzeitig A","time":1762800000000}'
MB='{"_id":"bbbbb","title":"Gleichzeitig B","time":1762800000000}'

capture() { # <name> <meeting> <meeting> <DTSTAMP> <UIDs, space-separated> <get_meetings entries>
    local uids
    read -ra uids <<<"$5"
    mkdir -p "$work/$1"
    overview "$2" "$3" >"$work/$1/meetings_overview.json"
    ical "$4" "${uids[@]}" >"$work/$1/ical_feed.ics"
    meetings "$6" >"$work/$1/get_meetings_active.json"
}

capture before "$A" "$B" 20261107T100000Z "aaaaa bbbbb" "$MA,$MB"

capture same "$A" "$B" 20261107T113000Z "aaaaa bbbbb" "$MB,$MA"
[ "$(compare same)" = 0 ] || fail "identical captures: $(cat "$work/out")"
grep -q 'ical_feed: identical without DTSTAMP (2 events)' "$work/out" || fail "DTSTAMP not ignored"
grep -q 'get_meetings: identical as a set' "$work/out" || fail "get_meetings not compared as a set"
grep -q 'API COMPARISON: identical' "$work/out" || fail "summary"
pass "another DTSTAMP and get_meetings in another order count as identical"

capture ties "$B" "$A" 20261107T113000Z "bbbbb aaaaa" "$MA,$MB"
[ "$(compare ties)" = 3 ] || fail "tie order: $(cat "$work/out")"
grep -q 'meetings_overview: same content, other order' "$work/out" || fail "overview order"
grep -q 'ical_feed: same content, other order' "$work/out" || fail "ical order"
pass "meetings at the same time swapped are reported as another order (exit 3), not as identical"

B2=${B/Gleichzeitig B/Gleichzeitig C}
capture edited "$A" "$B2" 20261107T113000Z "aaaaa bbbbb" "$MA,${MB/Gleichzeitig B/Gleichzeitig C}"
[ "$(compare edited)" = 1 ] || fail "edited: $(cat "$work/out")"
grep -q 'meetings_overview: DIFFERS (meetings: 0 only before, 0 only after, 1 changed' "$work/out" || fail "overview detail"
grep -q 'get_meetings: DIFFERS in: meetings' "$work/out" || fail "get_meetings detail"
if grep -q 'Gleichzeitig' "$work/out"; then fail "content was printed"; fi
pass "an edited meeting differs (exit 1), named by count and field, without printing content"

capture lost "$A" "$B" 20261107T113000Z "aaaaa" "$MA,$MB"
[ "$(compare lost)" = 1 ] || fail "lost event: $(cat "$work/out")"
grep -q 'ical_feed: DIFFERS (1 events only before, 0 only after)' "$work/out" || fail "ical detail"
pass "an event missing from the feed differs"

capture total "$A" "$B" 20261107T113000Z "aaaaa bbbbb" "$MA,$MB"
sed -i 's/"selected_total_count":2/"selected_total_count":3/' "$work/total/get_meetings_active.json"
[ "$(compare total)" = 1 ] || fail "total count"
grep -q 'get_meetings: DIFFERS in: selected_total_count' "$work/out" || fail "total detail"
pass "another selected_total_count differs"

rm "$work/total/ical_feed.ics"
[ "$(compare total)" = 2 ] || fail "a missing file is not a usage error"
pass "a missing capture file is an error (exit 2)"

echo "deployment/tests/compare-api.sh: all checks passed"
