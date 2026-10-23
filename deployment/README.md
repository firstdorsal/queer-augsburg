# Deployment

Production runs the rendered compose project in `deployment/results/` (project name
`results`); CI builds `qa-server` and `qa-web` from `main` and pushes them as `:latest` and
`:<short sha>`.

## Order of updates

-   **Pull only after both CI image jobs of the commit are green.** The two images are built
    in parallel and the web image is usually pushed first; a pull in between mixes versions.
-   **When the server's rules change, update the server first** (a new request field, or a
    rule that now allows more). An old web works with a new server, a new web against an
    old server does not:
    -   `place_to_be_announced` (2026-10): request bodies such as `NewMeeting` reject unknown
        fields, so every bulk import fails (422).
    -   Hybrid meetings (2026-10): the old server drops the place of a hybrid meeting saved
        in the editor, without an error, and refuses hybrid bulk imports (422).
-   Tag the running images before pulling (e.g. `:pre-<feature>`) to be able to go back.

## After a web update

Open pages keep the old bundle until the service worker has loaded the new one, which can
take two reloads. Editors reload until the editor shows the new controls (for hybrid
meetings: "Vor Ort", "Hybrid (vor Ort und online)", "Nur online").

Hybrid meetings (2026-10): an old editor keeps the chosen place when "Online-Treffen (kein
Ort)" is ticked, and the new server saves that as a hybrid meeting, place and online. The
request is the same as for a real hybrid meeting, so the server cannot refuse it. Count the
hybrid meetings before the deploy (expected: 0) and list them in the days after; the board
checks each listed one:

```sh
ssh root@turing 'bash -s' <<'EOF'
docker exec qa-db sh -c 'mongosh --quiet --port 27030 -u root -p "$MONGODB_ROOT_PASSWORD" --authenticationDatabase admin queer-augsburg --eval "
db.meetings.find(
    {online: {\$ne: null}, deleted_at: null, \$or: [{place_id: {\$ne: null}}, {location: {\$ne: null}}, {place_to_be_announced: true}]},
    {title: 1, time: 1, status: 1, \"location.name\": 1, place_to_be_announced: 1, changed: {\$slice: -1}}
).forEach(printjson)"'
EOF
```

## Rolling back the server

Stored meetings keep fields an older server does not know; it ignores them when reading,
and drops them when it saves such a meeting. After going back to a server without
`place_to_be_announced`, meetings with "Ort wird noch bekanntgegeben" show "Ort unbekannt"
and must be edited again once the newer server is back.

A server from before hybrid meetings reads only one part of a hybrid meeting (list them with
the query above before going back):

-   at a place and online: shown as online only; saving it drops the place,
-   "Ort wird noch bekanntgegeben" and online: shown as "Ort wird noch bekanntgegeben" only,
    without the online details; saving it is refused (422) until one of the two is removed.

An old web against the new server reads hybrid meetings the same way. It keeps the place of
a hybrid meeting when it is saved, but refuses to save one whose place is to be announced.
