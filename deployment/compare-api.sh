#!/usr/bin/env bash
# The end-to-end check of the Postgres cutover: the public API answers the same after the
# switch as before it. Runs on any machine with curl and jq (the API is public; nothing runs
# on turing):
#
#     bash compare-api.sh capture <dir> [<api url>]     the three answers into <dir>
#     bash compare-api.sh compare <before> <after>      compare two captures
#
# <api url> defaults to https://api.queer-augsburg.de. What is compared, and how:
#
# - meetings_overview with an explicit range (from 2000-01-01 to 2099-12-31): it does not
#   depend on the time of the request, so byte for byte.
# - ical_feed byte for byte without the DTSTAMP lines: DTSTAMP is the time the feed was
#   rendered (icalendar's Event::new), so it differs on every request, on either server.
# - get_meetings?t=Active as a set (meetings by _id, plus selected_total_count and
#   last_updated): its order depends on the time of the request (meetings less than 6 h
#   before now move from the upcoming part to the past part, get_meetings.rs), so between
#   two captures the order may change without any change of data.
#
# Result per answer: "identical"; "same content, other order" when only the order of
# entries differs (meetings starting at the same time, see issue.md); or "DIFFERS". Exit 0
# when all are identical, 3 when the worst is "other order", 1 when one differs, 2 on a
# usage or capture error. Prints no content, only what differs and how much.
#
# deployment/tests/compare-api.sh tests the comparison.

set -euo pipefail

OVERVIEW=meetings_overview.json
ICAL=ical_feed.ics
MEETINGS=get_meetings_active.json

usage() {
    echo "usage: compare-api.sh capture <dir> [<api url>] | compare <before dir> <after dir>" >&2
    exit 2
}

need() {
    command -v "$1" >/dev/null || { echo "compare-api.sh needs $1" >&2; exit 2; }
}

capture() {
    local dir=$1 api=${2:-https://api.queer-augsburg.de} path file status
    need curl
    mkdir -p "$dir"
    for path_file in \
        "/api/meetings_overview/?from=2000-01-01&to=2099-12-31 $OVERVIEW" \
        "/api/ical_feed/ $ICAL" \
        "/api/get_meetings/?t=Active $MEETINGS"; do
        path=${path_file% *}
        file=${path_file##* }
        # No cache: the overview is sent with max-age, and a proxy in between must not
        # answer for the server.
        status=$(curl -sS -o "$dir/$file" -w '%{http_code}' -H 'Cache-Control: no-cache' "$api$path") || {
            echo "capture failed: $api$path" >&2
            exit 2
        }
        if [ "$status" != 200 ]; then
            echo "capture failed: $api$path answered $status" >&2
            exit 2
        fi
        echo "captured $path ($(wc -c <"$dir/$file") bytes)"
    done
    date -u +%Y-%m-%dT%H:%M:%SZ >"$dir/captured_at"
}

# Prints the verdict and returns 0 (identical), 3 (other order) or 1 (differs).
verdict() {
    local name=$1 code=$2 detail=$3
    case $code in
        0) echo "$name: identical$detail" ;;
        3) echo "$name: same content, other order$detail" ;;
        *) echo "$name: DIFFERS$detail" ;;
    esac
    return "$code"
}

compare_overview() {
    local a=$1/$OVERVIEW b=$2/$OVERVIEW
    if cmp -s "$a" "$b"; then
        verdict meetings_overview 0 " ($(jq '.meetings | length' "$a") meetings)"
        return
    fi
    # Every array sorted, keys sorted: equal then means only an order differs.
    local sorted='walk(if type == "array" then sort else . end)'
    if [ "$(jq -S "$sorted" "$a")" = "$(jq -S "$sorted" "$b")" ]; then
        verdict meetings_overview 3 " ($(jq '.meetings | length' "$a") meetings)"
        return
    fi
    local changed
    changed=$(jq -n -r --slurpfile a "$a" --slurpfile b "$b" '
        ($a[0].meetings | map({key: .id, value: .}) | from_entries) as $x
        | ($b[0].meetings | map({key: .id, value: .}) | from_entries) as $y
        | ([$x | keys[] | select($y[.] == null)] | length) as $gone
        | ([$y | keys[] | select($x[.] == null)] | length) as $new
        | ([$x | keys[] | select($y[.] != null and $y[.] != $x[.])] | length) as $edited
        | "\($gone) only before, \($new) only after, \($edited) changed; truncated \($a[0].truncated) / \($b[0].truncated)"')
    verdict meetings_overview 1 " (meetings: $changed)"
}

# The feed without DTSTAMP, CRLF as sent.
ical_without_dtstamp() {
    grep -av '^DTSTAMP:' "$1"
}

# One line per VEVENT (its lines joined), sorted: the feed as a multiset of events.
ical_events() {
    ical_without_dtstamp "$1" | tr -d '\r' | awk '
        /^BEGIN:VEVENT$/ { inside = 1; event = ""; next }
        /^END:VEVENT$/ { inside = 0; print event; next }
        inside { event = event "\x1f" $0 }' | LC_ALL=C sort
}

ical_header() {
    ical_without_dtstamp "$1" | tr -d '\r' | awk '/^BEGIN:VEVENT$/ { exit } { print }'
}

compare_ical() {
    local a=$1/$ICAL b=$2/$ICAL events
    events=$(ical_events "$a" | wc -l | tr -d ' ')
    if cmp -s <(ical_without_dtstamp "$a") <(ical_without_dtstamp "$b"); then
        verdict ical_feed 0 " without DTSTAMP ($events events)"
        return
    fi
    if [ "$(ical_header "$a")" = "$(ical_header "$b")" ] &&
        cmp -s <(ical_events "$a") <(ical_events "$b"); then
        verdict ical_feed 3 " ($events events)"
        return
    fi
    local only_before only_after
    only_before=$(LC_ALL=C comm -23 <(ical_events "$a") <(ical_events "$b") | wc -l | tr -d ' ')
    only_after=$(LC_ALL=C comm -13 <(ical_events "$a") <(ical_events "$b") | wc -l | tr -d ' ')
    verdict ical_feed 1 " ($only_before events only before, $only_after only after)"
}

compare_meetings() {
    local a=$1/$MEETINGS b=$2/$MEETINGS
    local as_set='.meetings |= sort_by(._id)'
    local count
    count=$(jq '.meetings | length' "$a")
    if [ "$(jq -S "$as_set" "$a")" = "$(jq -S "$as_set" "$b")" ]; then
        verdict get_meetings 0 " as a set ($count meetings; the order depends on the time)"
        return
    fi
    local fields
    fields=$(jq -n --slurpfile a "$a" --slurpfile b "$b" -r '
        ($a[0] | .meetings |= sort_by(._id)) as $x | ($b[0] | .meetings |= sort_by(._id)) as $y
        | [($x | keys_unsorted[]), ($y | keys_unsorted[])] | unique
        | map(select(. as $k | $x[$k] != $y[$k])) | join(", ")')
    verdict get_meetings 1 " in: $fields (before $count, after $(jq '.meetings | length' "$b") meetings)"
}

compare() {
    local before=$1 after=$2 worst=0 code file
    need jq
    for dir in "$before" "$after"; do
        for file in "$OVERVIEW" "$ICAL" "$MEETINGS"; do
            [ -f "$dir/$file" ] || { echo "missing $dir/$file" >&2; exit 2; }
        done
    done
    for check in compare_overview compare_ical compare_meetings; do
        code=0
        "$check" "$before" "$after" || code=$?
        if [ "$code" = 1 ] || { [ "$code" = 3 ] && [ "$worst" = 0 ]; }; then
            worst=$code
        fi
    done
    case $worst in
        0) echo "API COMPARISON: identical" ;;
        3) echo "API COMPARISON: same content; an order differs (see above)" ;;
        *) echo "API COMPARISON: DIFFERS" ;;
    esac
    return "$worst"
}

[ "$#" -ge 1 ] || usage
case $1 in
    capture)
        [ "$#" = 2 ] || [ "$#" = 3 ] || usage
        capture "${@:2}"
        ;;
    compare)
        [ "$#" = 3 ] || usage
        compare "$2" "$3"
        ;;
    *) usage ;;
esac
