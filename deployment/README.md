# Deployment

Production runs the rendered compose project in `deployment/results/` (project name
`results`); CI builds `qa-server` and `qa-web` from `main` and pushes them as `:latest` and
`:<short sha>`.

## Order of updates

-   **Pull only after both CI image jobs of the commit are green.** The two images are built
    in parallel and the web image is usually pushed first; a pull in between mixes versions.
-   **When the server learns a new request field, update the server first.** Request bodies
    such as `NewMeeting` reject unknown fields, so a new web against an old server fails
    every bulk import (422), while an old web works with a new server (new fields have
    defaults). Example: `place_to_be_announced` (2026-10).
-   Tag the running images before pulling (e.g. `:pre-<feature>`) to be able to go back.

## Rolling back the server

Stored meetings keep fields an older server does not know; it ignores them when reading,
and drops them when it saves such a meeting. After going back to a server without
`place_to_be_announced`, meetings with "Ort wird noch bekanntgegeben" show "Ort unbekannt"
and must be edited again once the newer server is back.
