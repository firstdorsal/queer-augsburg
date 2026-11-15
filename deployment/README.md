# Deployment

Production runs the rendered compose project in `deployment/results/` (project name
`results`) on turing, in `/mnt/alpha/manifest/server/public/queer-augsburg`. CI builds
`qa-server` and `qa-web` from `main` and pushes them as `:latest` and `:<short sha>` (the
first 8 characters of the commit). `qa-web` runs `:latest`; `qa-server` runs one fixed build,
never `:latest` ("Server image"). root's login shell on turing is fish, so every block for
turing here goes through `ssh root@turing 'bash -s' <<'EOF'` (or `'bash -s' <script`), which
runs it in bash; the few blocks for your own machine say so.

## Order of updates

-   **Pull only after the CI image jobs of the commit are green.** A commit that changes both
    builds both images in parallel and the web image is usually pushed first; a pull in
    between mixes versions. A commit that changes only one of them builds only that image.
-   **When the server's rules change, update the server first** (a new request field, or a
    rule that now allows more). An old web works with a new server, a new web against an
    old server does not:
    -   `place_to_be_announced` (2026-10): request bodies such as `NewMeeting` reject unknown
        fields, so every bulk import fails (422).
    -   Hybrid meetings (2026-10): the old server drops the place of a hybrid meeting saved
        in the editor, without an error, and refuses hybrid bulk imports (422).
-   Tag the running web image before pulling (e.g. `:pre-<feature>`) to be able to go back;
    the server goes back by its tag ("Server image").

## Server image

`qa-server` runs one fixed build. CI moves `:latest` with every build on `main`, so with the
server on `:latest` a pull of every service (`update-containers.sh`, a web deploy that pulls
without a service name) followed by any `up` recreates the server from whatever `main` built
last. How the build is fixed, by time:

-   **Before step P1 of the Postgres cutover** (production up to the cutover commit): the
    untagged image, which is `:latest`. Harmless while every build on `main` reads MongoDB,
    and the reason P1 comes **before** the cutover commit is merged.
-   **From P1 to day step 3**: `results/docker-compose.yml` names the running Mongo build by
    its Docker Hub digest (`firstdorsal/queer-augsburg-server@sha256:…`, written by
    `pin-mongo-server.sh`). A pull fetches exactly that image, so pulls, `update-containers.sh`,
    web deploys and `up` keep the Mongo build although `:latest` is the Postgres build from the
    merge on (`deployment/tests/pin-mongo-server-docker.sh` shows both: the swap without the
    pin, none with it). In this time the next server update is the cutover itself. Do not edit
    the server's image line and do not render templates into `results/` (`start.sh`); day
    step 3 is the one step that replaces the compose file.
-   **From day step 3 on**: `firstdorsal/queer-augsburg-server:${QA_SERVER_IMAGE_TAG}`, and
    compose refuses `config`, `pull`, `create` and `up` of the project while that line is
    missing from `results/.env`. `ps`, `stop`, `restart`, `rm`, `logs`, `exec` and `down`
    still work: called with `-p results` and without `-f`, compose does not read the compose
    file for them at all and finds the containers by their project label (with a broken or
    missing file too; checked with compose 5.1.3 and 5.4.0). The tag is the short sha of one
    commit, so a pull fetches that commit's build and nothing else, and which build runs is
    one line. Going back inside the cutover's window (R1) puts P1's digest pin back; after
    the window the tag is all there is.

`update-containers.sh` refuses to pull while the compose names the server without a tag or as
`:latest`. turing's own checkout has an older copy that pulls without asking; the pin is what
makes that copy safe too. A server update from day step 3 on, with the short sha of the commit
whose image job is green:

```sh
ssh root@turing 'bash -s' <<'EOF'
set -euo pipefail
S=/root/qa-cutover/src/deployment
cd /mnt/alpha/manifest/server/public/queer-augsburg/deployment/results
bash "$S/set-server-image.sh" .env <short sha>
docker compose -p results pull qa-server
docker compose -p results up -d --no-deps qa-server
EOF
```

`set-server-image.sh` prints the tag it replaced; going back is the same with that tag. `S` is
the deployment directory of a checkout of the Postgres cutover commit or a later one: turing's
own checkout is older and carries local edits (`update-deployment.sh` would reset them), so the
cutover makes one in `/root/qa-cutover/src`. A server older than the cutover reads MongoDB, so
after the cutover only tags from the cutover commit on run ("Rolling back the server").

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
docker exec qa-pg psql -U qa_owner -d queer-augsburg -c "
SELECT m._id, m.title, m.time, m.status, m.location_name, m.place_to_be_announced,
       (SELECT jsonb_build_object('at', c.at, 'by', c.by) FROM meeting_changes c
        WHERE c.meeting_id = m._id ORDER BY c.position DESC LIMIT 1) AS last_change
FROM meetings m
WHERE m.online_platform IS NOT NULL AND m.deleted_at IS NULL
  AND (m.place_id IS NOT NULL OR m.location_name IS NOT NULL OR m.place_to_be_announced)"
EOF
```

(Until the cutover the same question goes to Mongo:
`db.meetings.find({online: {$ne: null}, deleted_at: null, $or: [{place_id: {$ne: null}}, {location: {$ne: null}}, {place_to_be_announced: true}]})`
through `docker exec qa-db mongosh` as in the git history of this file.)

## Versions

-   turing, read there on 2026-11-07:
    Docker Compose 5.1.3 (Arch package `docker-compose 5.1.3-1`; `docker compose version`
    prints v5.1.3), Docker 29.4.2 (`docker 1:29.4.2-1`) and buildx 0.33.0
    (`docker-buildx 0.33.0-1`). Both plugins are in the system plugin directory
    `/usr/lib/docker/cli-plugins/` (`docker-buildx` 0.33.0 next to `docker-compose` 5.1.3),
    and buildx's default builder, driver `docker`, runs; so `docker build` (the migrator
    image) and `docker compose … --build` (`qa-backup`) build with that buildx (read there on
    2026-11-07 too). The blocks of the Postgres cutover were tested with that
    compose release (the docker tests below, on a local Docker 29.9.1). Arch is rolling, so
    any `pacman -Syu` can bring another compose: day step 1, R1 and R2 stop on any other
    version, and P1's config hash may come out differently under another one. Leave
    turing's packages alone from P1 until the cutover window has passed.
-   `server/Cargo.lock` decides what is built (`--locked` in CI and in the image). After
    changing `server/Cargo.toml`, commit the lock file too, or both fail.
-   The server's database is Postgres 18 (`qa-pg`, image pinned to `postgres:18.6-alpine` in
    the template; a newer 18.x is a pull, 19 is a planned step with a dump first). The
    schema is `server/migrations-sql/`, applied by the server at every start. Test database
    changes against the same image: `server/dev/docker-compose.yml` sets `TEST_DATABASE_URL`
    up, CI runs the tests with the same image and initdb arguments. A query or schema change
    also regenerates `server/.sqlx/` (`cargo sqlx prepare`; CI fails on a stale one with
    `prepare --check`) with sqlx-cli 0.9.0, the version CI installs and `.sqlx/` was made with:
    `cargo install sqlx-cli --version 0.9.0 --no-default-features --features postgres --locked`,
    then `sqlx --version` must print `sqlx-cli 0.9.0`. CI's `test-deployment`
    runs `deployment/tests/postgres.sh` in that image: `pg-init.sql` through the image's
    entrypoint, the schema and a later migration applied as `qa_app`, the backup job's dump
    restored and compared. By hand, from the repository root:
    `docker run --rm -v "$PWD":/src:ro postgres:18.6-alpine bash /src/deployment/tests/postgres.sh`.
    `deployment/tests/env-scripts.sh` (also in `test-deployment`) covers the `.env` scripts,
    P1's compose rewrite and `update-containers.sh`'s refusal;
    `deployment/tests/pin-mongo-server-docker.sh` runs P1 and the pulls after it against a
    real daemon, so only by hand (needs docker, curl and a port:
    `PIN_TEST_REGISTRY_PORT=$(port-registry alloc deploy-pin-registry) bash deployment/tests/pin-mongo-server-docker.sh`).
    `deployment/tests/cutover-remove-server-docker.sh` reads the blocks of P4, day steps 1 to
    5 and 8, day step 2's stop-settings fix, R1, R2 and "Trying again" from this file and runs
    each whole against stand-ins on a real daemon, so also only by hand (needs docker).
    `postgres:18.6-alpine` stands in for every container and is a real `qa-pg` on a volume
    `qa-pg`, with `pg-init.sql` and the template's `POSTGRES_INITDB_ARGS`; one more init script
    holds its first start for 10 s after `pg-init.sql`, while it listens on its socket only, so
    that day step 3 returning before `qa-pg` takes connections over TCP is seen. The
    stand-in `qa-server` stops with the signal and grace period of the template and
    `server/Dockerfile`, and its save takes as long as the server's rooms may
    (`ROOMS_SHUTDOWN_TIMEOUT` in `server/src/main.rs`, 15 s, so that a stop with `-t 10` or
    less loses it); the test checks that the save was finished, and that the grace period is
    at least that timeout plus 5 s. Day step 2's stop check must expect exactly that signal
    and grace period, and stops a `qa-server` without `stop_grace_period` or with `SIGKILL`
    before it touches it. The stand-in `qa-ofelia` logs `New job registered "<name>"` for each
    job of its config a few seconds after it starts, as ofelia does (the text measured with
    `mcuadros/ofelia:latest`), and depends on the services the template's `qa-ofelia` depends
    on (before the cutover without `qa-pg`). One of them, `qa-backup`, differs between the old
    and the new stand-in compose file. In production their definitions are the same in both
    files (P4), and compose recreates a dependency only when its definition differs
    (measured with both versions), so the difference is there to make a dependency R1 or day
    step 5 would converge show. The stand-in `qa-backup` mounts the backup volume, and its
    `python3` takes step 8's upload as a copy of the volume, or fails. R1 runs right after
    day step 2 (no `qa-pg`), after a day step 2 that failed after the `rm` and was pasted
    again, after a day step 3 that failed before `qa-pg` existed, after the day steps 2 to 4
    as this file has them, after a day step 4 that failed, and after R2 (also after a day
    step 5 that failed, and after an R2 that failed): each time the old compose file and
    config must be live, the old server listening on the old config, `qa-ofelia` created
    again with the old jobs, `qa-pg` stopped or never created, every other container the
    same as before R1 (same id), P1's check last. "Trying again" must remove the volume
    `qa-pg` when the server never ran on it, and refuse while no rollback dump of it passed
    its restore check and was uploaded by step 8 (also after the server ran again since).
    `pg-restore-check.sh` is the real one, the migrator, `mongodump` and the other scripts
    of the checkout are stubs that refuse other arguments than the blocks give. P1's check
    is a stub that decides as the real `--check` does: by the image compose resolves for
    `qa-server` from the live file and the image id `qa-server` runs (the stand-in's old
    file names the server's image by its digest, the new one by a tag). Like the real check
    it passes a file or config edited elsewhere (`pin-mongo-server-docker.sh` measured the
    real one); day step 2's own comparison with what P1 saved stops on that, and day step
    3's with what P4 compared. The test makes the blocks fail too: a failing P1 check (in
    day step 2, and at the end of R1 pasted a second time), files edited since P1 or P4,
    Mongo dump, `migrate-config.sh`, the migrator, the restore check of day step 4, an
    `ofelia.conf` without the new job, a server that never listens (day step 5 and R1),
    `pg_dump` or restore check of R2, a config R1 cannot restore, a compose file R1's
    `config -q` refuses, a missing rollback dump at step 8: each must stop its block, and
    after the next step this file gives for it, the block goes through. Of the blocks only
    `D=`, `W=`, the backup volume R2's migrator mounts and, when the test runs another
    compose than the one recorded above, the version in R1's and R2's compose checks change,
    and the test checks that with `diff`. The stand-in is stricter than the server in one
    way: the server also saves on SIGINT, the stand-in only on the stop signal. The stand-in
    `mongodump` records whether the server had saved before it ran. `env-scripts.sh` runs day step 1's
    block against a stub `docker` too: it must pass with exactly the compose version
    recorded above and stop on any other (also with a suffix such as `-rc1`, blanks around
    it, on two lines, or an empty answer); R1 and R2 must start with the same check and stop
    before any other docker call; day step 2's `mongodump` and `migrate-config.sh` lines must
    be the rehearsal's, which run against the real `qa-db`, and its stop check must expect
    the signal and grace period of the template and `server/Dockerfile`; P6's clean-up, the
    anonymized copy, day step 4, R2 and step 8 must stop before any docker call when the
    name they read from `/root/qa-cutover` is empty or not one of theirs. Both docker
    tests talk to the local daemon only and refuse a remote `DOCKER_HOST` or
    `DOCKER_CONTEXT`. `COMPOSE` names the compose binary they run as `docker compose`; for
    turing's version, in an empty directory:
    `curl -fsSL --remote-name-all https://github.com/docker/compose/releases/download/v5.1.3/docker-compose-linux-x86_64{,.sha256} && sha256sum -c docker-compose-linux-x86_64.sha256 && chmod +x docker-compose-linux-x86_64`,
    then from the repository root
    `COMPOSE=<that directory>/docker-compose-linux-x86_64 bash deployment/tests/cutover-remove-server-docker.sh`
    (and the same `COMPOSE=…` in front of the pin test). Without `COMPOSE` they run the local
    `docker compose`.
    `backup/tests/healthcheck.sh` builds the `qa-backup` image and runs its `HEALTHCHECK`
    command against a recent, an outdated and a missing last backup, also only by hand
    (needs docker). Until 2026-11 that command named `/src/healthcheck.py`, which the image
    does not have, so `qa-backup` reported `unhealthy` while its backups ran; after a change
    in `backup/`, rebuild it on turing once its checkout has the change (the build context is the
    checkout's `backup/`): `docker compose -p results up -d --build --no-deps qa-backup`.
-   MongoDB 7.0 (`qa-db`, built from `mongodb/Dockerfile`) stays in the template until the
    rollback window of the Postgres cutover has passed; nothing connects to it any more.
    `qa-interossea-db` is the login service's own Mongo, built from the same `mongodb/`, and is
    not part of this.

## Database

-   Console: `docker exec -it qa-pg psql -U qa_owner -d queer-augsburg`. The socket inside the
    container needs no password; nothing is published on the host.
-   Two roles. `qa_app` owns every table and type of the schema: the server connects as it
    (`db.url` in `qa-server.yml`) and applies `server/migrations-sql/` at every start, and a
    migration can only change what its role owns; the migrator of the cutover runs as it too.
    `qa_owner` is the container's superuser for the console, dumps and restores, and creates
    nothing in the schema. `pg-owner-check.sql` fails and names every object another role
    owns (from the deployment directory):
    `docker exec -i qa-pg psql -X -U qa_owner -d queer-augsburg < pg-owner-check.sql`.
-   Both passwords are in `results/.env` (`POSTGRES_PASSWORD_QA`, `POSTGRES_APP_PASSWORD_QA`),
    letters and digits only: the app password goes into `db.url` unencoded, and `pg-init.sql`
    refuses anything else. `qa_app` is created by `config/pg-init.sql` **once, when the volume
    is empty**; a password changed in `.env` afterwards must also be set with
    `ALTER ROLE qa_app PASSWORD '…'`.
-   Backups: the `backup-qa-pg` job in `config/ofelia.conf` writes
    `/backup/queer-augsburg.pgdump` (`pg_dump -Fc`) into the `qa-backup` volume on the same
    schedule as the Mongo dumps, and `backup_script.py` archives the volume as before. ofelia
    reads its jobs only when it starts: after a change of `ofelia.conf`,
    `docker compose -p results up -d --no-deps --force-recreate qa-ofelia`, and
    `docker logs qa-ofelia` lists every job (`New job registered …`). A dump counts once it
    has been restored:
    `docker exec -i qa-pg sh -s -- /backup/queer-augsburg.pgdump --live-may-differ < pg-restore-check.sh`
    restores it into a throwaway database, compares it with the live one table by table and
    drops it again (without `--live-may-differ` the rows must be equal too, which holds only
    while nothing writes). A dump by hand is the job's command:
    `docker exec qa-pg sh -c 'pg_dump -Fc -U qa_owner -d queer-augsburg -f /backup/queer-augsburg.pgdump.part && mv -f /backup/queer-augsburg.pgdump.part /backup/queer-augsburg.pgdump'`.
-   Restore into the running database: `docker compose -p results stop qa-server`, then
    `docker exec qa-pg pg_restore --clean --if-exists -U qa_owner -d queer-augsburg /backup/queer-augsburg.pgdump`,
    then start the server again. `--clean` drops and recreates every table, so this replaces
    everything, including the documents' live state. The dump carries the owners, so `qa_app`
    owns everything afterwards as before.

## After a server update

The server stops at startup if it cannot reach the database or apply a schema migration, and
`restart: always` turns that into a loop. Check after every update:

-   `docker logs qa-server` shows "Listening on" and `docker ps` a growing uptime.
-   A release with a new file in `server/migrations-sql/` has applied it:
    `docker exec qa-pg psql -U qa_owner -d queer-augsburg -c 'SELECT version, description, success FROM _sqlx_migrations ORDER BY version'`
    lists it with `success = t`. A migration that failed halfway is listed with `f`, and the
    server refuses to start until it is repaired by hand (fix the data, delete that row).
    `must be owner of …` means an object belongs to another role than `qa_app`:
    `pg-owner-check.sql` ("Database") names it.
-   `https://api.queer-augsburg.de/api/meetings_overview/` and `/api/ical_feed/` answer 200.
-   Logging in works and `/ich` shows your data: this fetches the login service's key over
    plain HTTP (`interossea.url` must stay `http://`, the server has no TLS client for it).
-   Saving an existing meeting unchanged works.

## Documents

`UpdateDocuments` lets a person create, edit, sort and delete documents; no page assigns it. The
user must have logged in once and submitted member data (that is where the email is). Grant
by email and check; granting twice changes nothing:

```sh
ssh root@turing 'bash -s' <<'EOF'
docker exec qa-pg psql -U qa_owner -d queer-augsburg -c "
UPDATE users SET capabilities = array_append(capabilities, 'UpdateDocuments')
WHERE _id = (SELECT user_id FROM members WHERE email = 'name@example.org')
  AND NOT ('UpdateDocuments' = ANY(capabilities));
SELECT _id FROM users WHERE 'UpdateDocuments' = ANY(capabilities)"
EOF
```

`UPDATE 0` means the email is unknown or the person already had it. To take it away, use
`SET capabilities = array_remove(capabilities, 'UpdateDocuments')` with the same `WHERE _id`.
An open editor then closes within 30 seconds; verified members and meeting editors can still
read. Leaving the association does not remove it, so take it away when someone leaves.

A deploy of the server disconnects editors for a few seconds (2.2 s measured). Nothing is lost:
the server saves on SIGTERM (`STOPSIGNAL SIGTERM`, `stop_grace_period: 20s`), and browsers push
back what it has not seen. Sessions live in memory, so every editor renews its session
afterwards. There must only ever be one server process, as rooms live in its memory.

Backups are the jobs in `config/ofelia.conf`, `@weekly` on turing; they cover the whole
database ("Database" above). So `document_versions` is what helps with a mistake in one
document, and a dump by hand is worth it before risky work.

The first rollout:

1.  Dump the database and tag the running images `:pre-documents`.
2.  On turing, `results/docker-compose.yml` differs from the template by hand: render to `/tmp`,
    diff, and apply only `stop_grace_period: 20s` for `qa-server` and the `wss://` source in
    `CSP_CONNECT_SRC` of `qa-web`. Back up the file one level up first.
3.  Pull and recreate `qa-server`, which must ship together with `stop_grace_period`.
    `docker inspect qa-server --format '{{.Config.StopSignal}} {{.Config.StopTimeout}}'` must
    print `SIGTERM 20`. Check "After a server update".
4.  Pull and recreate `qa-web` with `--force-recreate`, in the same step as the CSP change, as
    the header is cached with the document. `curl -sI https://queer-augsburg.de/` must show
    `wss://api.queer-augsburg.de`. The test in `web/src/documents.test.ts` only sees the template.
5.  Grant yourself `UpdateDocuments`. Reload twice, open a document in the editor: the socket
    shows as 101 in the browser's network tab (traefik's access log says 0). Leave it idle for
    two minutes, type, `docker compose -p results restart qa-server`, and check that the text
    survives.
6.  Grant it to the others.

## The Postgres cutover

One short downtime moves the data from `qa-db` (MongoDB) to `qa-pg`. The migrator
(`migrate-from-mongo`, a binary of its own from `server/Dockerfile.migrate`, built by hand on
turing; CI compiles and tests it) reads a `mongodump` directory, writes Postgres as `qa_app`,
reads every row back through the server's own code and prints the counts and digests of both
sides; it ends with `MIGRATION VERIFIED …` or it does not. It prints counts, names of
collections and fields, rule names and digests, never a value of any field.

**What going back costs.** Mongo is not written after day step 2. Until the new server has
started (day step 5), going back loses nothing (R1). From then on every write the server takes
(meetings, places, documents and their versions, members, users) exists only in Postgres. R2
keeps it in a dump and lists which collections it changed, but Mongo does not get it, and the
board has to enter it again by hand: no tool moves data from Postgres back to Mongo. So the
decision whether to stay falls in the hours after step 7, not in the 14 days `qa-db` is kept.
The volume `qa-pg` with those writes is removed only by "Trying again", and only after R2's
dump of it passed its restore check and step 8 uploaded it.

On turing everything happens in `/root/qa-cutover` (mode 700): the checkout of the cutover
commit (`src`), the files rendered from it (`staged`), the state to go back to
(`pre-postgres`), and the migrator's configurations and reports. Every block is meant to be
pasted as it is; only P3 takes a value, the short sha. Every block runs in bash through
`ssh root@turing 'bash -s'`, except the two that run on your machine in a checkout of the
cutover commit: P6's API comparison and day step 7. Every block stops at the first failing
command (`set -euo pipefail`): a block for turing sets it in its first line, P1's block in
the script it sends (`pin-mongo-server.sh`), and the two blocks on your machine in a subshell,
`( set -euo pipefail` … `)`, which stops the same way pasted into bash or zsh and leaves your
shell open. The one exception is P4's comparison, which has to print every `diff` even
though each exits 1 on the expected differences.

### Before the day

**The order is fixed: P1, then the merge (P2), then the rest.** From the merge on, CI pushes
the Postgres build as `:latest`, and production's compose names the server without a tag until
day step 3 ("Server image"). Merging before P1 has printed `PINNED` lets the next pull and `up`
start the Postgres build on the Mongo config, and the API is down.

P1. Pin the running server to its own image, **before the cutover commit is merged to
`main`**. It needs nothing of that commit on turing, only today's compose and the running
server: the script is sent from your machine, from a checkout of the cutover branch.

```sh
ssh root@turing 'bash -s' <deployment/pin-mongo-server.sh
```

In this order, each check stopping it before the next action (the comment at the top of
`pin-mongo-server.sh` has the details):

1.  `results/docker-compose.yml` names the server once without a tag, and the running
    `qa-server` was created from it (compose's config hash), so recreating it changes nothing
    but the image line.
2.  The running `qa-server` is the Mongo build: the `/config.yml` it mounts has a `mongodb://`
    `db.url`, and it answers 200 on `/api/meetings_overview/`, which reads the database. The
    Postgres build connects to the database before it listens and, with a `mongodb://` URL,
    exits with status 1 (`Error: connecting to the database`, measured against `mongo:7.0`),
    so nothing would answer: a server already swapped is never saved as the way back.
3.  Its image, by the container's image id (never by a tag a pull may have moved), is tagged
    `:pre-postgres`, and its Docker Hub digest recorded.
4.  `/root/qa-cutover/pre-postgres` (mode 700) gets copies of today's compose, config and
    `.env`, `server-image.txt` (image id and digest) and `docker-compose.rollback.yml`: today's
    compose with the server pinned to that digest. R1 installs it again.
5.  That file becomes the live `results/docker-compose.yml`; `config --images` must name the
    digest; `qa-server` is recreated from it (a few seconds without API, as in a deploy) and
    must run the same image id and answer again.

The last line is `PINNED firstdorsal/queer-augsburg-server@sha256:…`. Any time later, without
changing anything: `ssh root@turing 'bash -s -- --check' <deployment/pin-mongo-server.sh`
prints the same line while the live compose pins that digest and `qa-server` runs that image.
A stop (`STOP: …`) and what it means:

-   `… already pins the server to a digest` or `… pre-postgres exists from an earlier run`: P1
    has run; `--check` says whether the pin still holds. Never delete `pre-postgres`, it is the
    way back.
-   `… lines 'image: firstdorsal/queer-augsburg-server' without a tag, expected 1: the server's
    image line was edited by hand` (or `compose does not resolve the server …`): nothing was
    changed. `docker inspect qa-server --format '{{.Config.Image}}'` prints the name the
    running container was created with. If that is `firstdorsal/queer-augsburg-server`, the
    file was edited after the last `up`: put the line back as `image:` plus that name and run
    P1 again. If it is anything else, production runs a setup this runbook does not know; do
    not merge before that is understood.
-   `… was not created from today's docker-compose.yml`: the file was edited after the last
    `up` (or compose was updated since and hashes the same file differently), and recreating
    the server would apply that difference too. Find the edit (a backup one level up, "The
    first rollout"), undo it or apply it on purpose with
    `docker compose -p results up -d --no-deps qa-server` while `:latest` is still the Mongo
    build (before the merge), and run P1 again.
-   `… not running steadily`, `… not mongodb://`, `… answered no 200`: the running server is
    not a healthy Mongo build, so there is nothing to save as the way back. Do not merge; find
    out why (`docker logs qa-server`).

P2. Merge the cutover commit to `main`, only after P1 printed `PINNED` (and `--check` still
does), and wait until its `docker-build-server` job is green. `:latest` is the Postgres build
from now on; the pin keeps the server where it is, also against a pull of every service
(`update-containers.sh`, a web deploy) followed by `up`.

P3. A checkout of the cutover commit and the files rendered from it with production's
`config.yml`. `<short sha>` is the commit merged in P2 (the first 8 characters, as CI tags the
image). The commit does not touch `web/`, so no web image is built for it and `qa-web` stays as
it is.

```sh
ssh root@turing 'bash -s' <<'EOF'
set -euo pipefail
SHA=<short sha>
REPO=/mnt/alpha/manifest/server/public/queer-augsburg
W=/root/qa-cutover
mkdir -p "$W" && chmod 700 "$W"
git -C "$REPO" fetch origin
git -C "$REPO" worktree add --detach "$W/src" "$SHA"
[ "$(git -C "$W/src" rev-parse --short=8 HEAD)" = "$SHA" ]
echo "$SHA" >"$W/sha"
bash "$W/src/deployment/render.sh" "$W/staged" "$REPO/deployment/config.yml"
EOF
```

turing's own checkout keeps its commit and its local edits; only `git fetch` touches it.

P4. Compare the rendered files with production, the whole config directory and the compose
file as compose reads it:

```sh
ssh root@turing 'bash -s' <<'EOF'
D=/mnt/alpha/manifest/server/public/queer-augsburg/deployment
W=/root/qa-cutover
cd "$D/results" || exit 1
diff -ru config "$W/staged/config"
diff -r email-templates "$W/staged/email-templates"
diff -r data "$W/staged/data"
diff -u <(docker compose -p results config --no-interpolate) \
    <(docker compose -p results -f "$W/staged/docker-compose.yml" --project-directory . config --no-interpolate)
# What was compared, for day step 3: a checksum of each file it replaces and copies.
find "$D/results/docker-compose.yml" "$D/results/config" "$W/staged/docker-compose.yml" "$W/staged/config" \
    -type f -exec sha256sum {} + | sort -k 2 >"$W/p4-compared.sha256"
EOF
```

The expected differences, and nothing else:

-   `config/`: `pg-init.sql` is new; `ofelia.conf` gains the `backup-qa-pg` job;
    `qa-server.yml` has `db.url: postgres://qa_app:$POSTGRES_APP_PASSWORD@qa-pg:5432/queer-augsburg`
    instead of the `mongodb://` one.
-   compose: the service `qa-pg`, and the volume and network `qa-pg`; `qa-server` runs
    `firstdorsal/queer-augsburg-server:${QA_SERVER_IMAGE_TAG:?…}` instead of the digest P1
    pinned, is on network `qa-pg` instead of `qa-db`, gets `POSTGRES_APP_PASSWORD` instead of
    `MONGODB_ROOT_PASSWORD` and `depends_on: qa-pg` (healthy); `qa-ofelia` also depends on
    `qa-pg`.

Any other difference is an edit made by hand in production (as in "The first rollout"):
make the same edit in `/root/qa-cutover/staged/` and run P4 again until only the expected
differences are left. Day step 3 copies these files over production, and only while every
one of them, live and staged, is still what the last P4 compared
(`/root/qa-cutover/p4-compared.sha256`, checksums only). So after any change to them, by
hand or by a step of this runbook (day step 2's stop-settings fix), run P4 again and read
its differences again.

P5. The passwords, the server's tag and the images. `add-postgres-secrets.sh` adds
`POSTGRES_PASSWORD_QA` and `POSTGRES_APP_PASSWORD_QA` (64 random letters and digits) and
changes no other line; **never run `createSecrets.sh` here**, it would replace every secret,
and it refuses an existing `.env` now. The new lines are unused until day step 3. The migrator
image is built from the checkout and tagged with the commit.

```sh
ssh root@turing 'bash -s' <<'EOF'
set -euo pipefail
D=/mnt/alpha/manifest/server/public/queer-augsburg/deployment
W=/root/qa-cutover
SHA=$(cat "$W/sha")
S=$W/src/deployment
cd "$D/results"
bash "$S/add-postgres-secrets.sh" .env
bash "$S/set-server-image.sh" .env "$SHA"
docker pull "firstdorsal/queer-augsburg-server:$SHA"
[ "$(docker image inspect --format '{{.Id}}' "firstdorsal/queer-augsburg-server:$SHA")" != \
  "$(docker image inspect --format '{{.Id}}' firstdorsal/queer-augsburg-server:pre-postgres)" ]
docker compose -p results config -q
docker compose -p results -f "$W/staged/docker-compose.yml" --project-directory . config -q
(cd "$W/src/server" && docker build -f Dockerfile.migrate -t "qa-migrate:$SHA" .)
EOF
```

For another commit (merged to `main` like the first; the pin holds): P3 with the new sha (after
`git -C /mnt/alpha/manifest/server/public/queer-augsburg worktree remove /root/qa-cutover/src`
and `rm -r /root/qa-cutover/staged`), P4, P5; P1 stays as it is.

P6. Rehearsal, as often as wanted, without downtime. It runs the whole path on a copy: a
fresh dump, a throwaway Postgres created from the same image and init script as `qa-pg`
(`qa-pg` itself is created on the day, from an empty volume), the migrator twice and its
`verify`, the owner check, a backup with a restore check, and the new server image started on
the result. The server keeps running meanwhile, so a write between the dump and the count makes
the migrator refuse the counts: run P6 again.

```sh
ssh root@turing 'bash -s' <<'EOF'
set -euo pipefail
D=/mnt/alpha/manifest/server/public/queer-augsburg/deployment
W=/root/qa-cutover
SHA=$(cat "$W/sha")
S=$W/src/deployment
cd "$D/results"
R=rehearsal-$(date +%Y%m%d-%H%M)
echo "$R" >"$W/rehearsal"
env_value() { sed -n "s/^$1=//p" .env; }
migrator() { # <postgres container, also its network> <migrate|verify> <config>
    DATABASE_URL="postgres://qa_app:$(env_value POSTGRES_APP_PASSWORD_QA)@$1:5432/queer-augsburg" \
        docker run --rm --network "$1" -e DATABASE_URL -v qa-backup:/backup:ro \
        -v "$3:/migrate.yml:ro" "qa-migrate:$SHA" "$2" --config /migrate.yml
}

# The dump, in its own directory of the backup volume, then the live counts.
docker exec qa-db bash -c 'mongodump --host qa-db --port "${MONGODB_PORT_NUMBER:?}" --username root --password "$MONGODB_ROOT_PASSWORD" --authenticationDatabase admin --db queer-augsburg --out "/backup/$0"' "$R"
bash "$S/migrate-config.sh" qa-db "$R" >"$W/$R.migrate.yml"

# A throwaway Postgres as qa-pg is set up, data in memory only.
docker network create qa-pg-rehearsal
POSTGRES_PASSWORD=$(env_value POSTGRES_PASSWORD_QA) POSTGRES_APP_PASSWORD=$(env_value POSTGRES_APP_PASSWORD_QA) \
docker run -d --name qa-pg-rehearsal --network qa-pg-rehearsal --tmpfs /var/lib/postgresql \
    --shm-size 256m --security-opt no-new-privileges:true \
    -e POSTGRES_DB=queer-augsburg -e POSTGRES_USER=qa_owner -e POSTGRES_PASSWORD -e POSTGRES_APP_PASSWORD \
    -e POSTGRES_INITDB_ARGS='--locale-provider=builtin --builtin-locale=C.UTF-8 --encoding=UTF8 --data-checksums' \
    -v "$W/staged/config/pg-init.sql:/docker-entrypoint-initdb.d/10-roles.sql:ro" \
    postgres:18.6-alpine
for _ in $(seq 120); do
    docker exec qa-pg-rehearsal pg_isready -q -h 127.0.0.1 -U qa_owner -d queer-augsburg && break
    sleep 1
done
docker exec qa-pg-rehearsal pg_isready -h 127.0.0.1 -U qa_owner -d queer-augsburg

# Twice, then verify: the second run changes nothing and ends on the same line.
migrator qa-pg-rehearsal migrate "$W/$R.migrate.yml" | tee "$W/$R.report-1.txt"
migrator qa-pg-rehearsal migrate "$W/$R.migrate.yml" | tee "$W/$R.report-2.txt"
if grep -E 'inserted=[1-9]|updated=[1-9]' "$W/$R.report-2.txt"; then
    echo "REHEARSAL FAILED: the second run changed rows"
    exit 1
fi
[ "$(tail -n 1 "$W/$R.report-1.txt")" = "$(tail -n 1 "$W/$R.report-2.txt")" ]
migrator qa-pg-rehearsal verify "$W/$R.migrate.yml" | tee "$W/$R.report-verify.txt"

# qa_app owns the schema; a backup restores and equals the database.
docker exec -i qa-pg-rehearsal psql -X -U qa_owner -d queer-augsburg <"$S/pg-owner-check.sql"
docker exec qa-pg-rehearsal sh -c 'pg_dump -Fc -U qa_owner -d queer-augsburg -f /tmp/rehearsal.pgdump'
docker exec -i qa-pg-rehearsal sh -s -- /tmp/rehearsal.pgdump <"$S/pg-restore-check.sh"

# The new server on the copy, as qa_app; reachable only through the tunnel below.
sed 's#@qa-pg:5432/#@qa-pg-rehearsal:5432/#' "$W/staged/config/qa-server.yml" >"$W/$R.qa-server.yml"
grep -q '@qa-pg-rehearsal:5432/queer-augsburg$' "$W/$R.qa-server.yml"
INTEROSSEA=$(docker inspect --format '{{range .Config.Env}}{{println .}}{{end}}' qa-server | sed -n 's/^INTEROSSEA_INTERNAL_URL=//p')
POSTGRES_APP_PASSWORD=$(env_value POSTGRES_APP_PASSWORD_QA) \
docker create --name qa-server-rehearsal --network qa-pg-rehearsal \
    -e POSTGRES_APP_PASSWORD -e INTEROSSEA_INTERNAL_URL="$INTEROSSEA" -e MAIL_PASSWORD=unused \
    -v "$W/$R.qa-server.yml:/config.yml:ro" "firstdorsal/queer-augsburg-server:$SHA"
docker network connect qa-interossea-server qa-server-rehearsal
docker start qa-server-rehearsal
for _ in $(seq 60); do
    docker logs qa-server-rehearsal 2>&1 | grep 'Listening on' >/dev/null && break
    sleep 1
done
docker logs qa-server-rehearsal 2>&1 | grep 'Listening on'
echo "tunnel to: $(docker inspect --format '{{(index .NetworkSettings.Networks "qa-pg-rehearsal").IPAddress}}' qa-server-rehearsal):80"
EOF
```

Then, on your machine in a checkout of this commit, the API of the copy against the live one,
through a tunnel to the address printed last (the port from the registry, `ports` rule;
`alloc` gives the same port in every terminal of the checkout). In a second terminal, until
the comparison is done:
`ssh -N -L "127.0.0.1:$(port-registry alloc cutover-tunnel):<address>:80" root@turing`. Then:

```sh
( set -euo pipefail
    PORT=$(port-registry alloc cutover-tunnel)
    bash deployment/compare-api.sh capture /tmp/qa-rehearsal/live
    bash deployment/compare-api.sh capture /tmp/qa-rehearsal/copy "http://127.0.0.1:$PORT"
    bash deployment/compare-api.sh compare /tmp/qa-rehearsal/live /tmp/qa-rehearsal/copy
)
```

`identical` is the goal. `same content, other order` means entries with equal sort keys (meetings
starting at the same time) come in another order than on Mongo; the server keeps Mongo's order
(issue.md, "Orders of equal sort keys"), so this is a finding to resolve before the day, as is
`DIFFERS` unless a write reached the live server after the dump. Then clean up; the reports
stay, they hold no values:

```sh
ssh root@turing 'bash -s' <<'EOF'
set -euo pipefail
W=/root/qa-cutover
R=$(cat "$W/rehearsal")
if ! [[ $R =~ ^rehearsal-[0-9]{8}-[0-9]{4}$ ]]; then
    echo "STOP: $W/rehearsal names no rehearsal ('$R'); nothing was removed"
    exit 1
fi
docker rm -f qa-server-rehearsal qa-pg-rehearsal
docker network rm qa-pg-rehearsal
docker exec qa-db rm -rf "/backup/${R:?}"
rm -f "$W/${R:?}.qa-server.yml"
EOF
```

On your machine, end the tunnel (Ctrl-C); after the last rehearsal give the port back with
`port-registry release cutover-tunnel`.

The report: `collections:` with the expected, source and target count and both digests of
every collection; `invariants:` (history entries, memberships, approved members, live
documents); `rules applied:` with how often each rule for old documents was used
(`missing_as_false`, `missing_or_null_as_empty`, `location_without_place_id`, `kept_in_extra`,
…); `warnings:`; `errors:` by collection, field and reason; and the last line,
`MIGRATION VERIFIED …` with the counts and one digest over everything, or `MIGRATION FAILED`.
The exit code is 0 only with the first.

`originalUsers._id dangling` counts archive snapshots of users that no longer exist; they are
kept. The other warning the data can carry is `meetings.place_id dangling`: a meeting whose
place does not exist. It is migrated as it is (readers use `location`); find and decide:
`SELECT _id FROM meetings m WHERE place_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM places p WHERE p._id = m.place_id)`.

An `unknown_field` error names a field of an old document nobody knew about. Decide whether
it may go, then list it under `ignored_fields` in the migrate.yml that `migrate-config.sh`
wrote (see `server/migrate.example.yml`; users' unknown fields go to `users.extra` instead and
never error), and use that file again on the day.

For debugging away from turing there is an anonymized copy of a dump: every personal value
replaced by generated mock data, ids, types, timestamps, counts and the references between
records kept, so it migrates like the original and prints the same rule counts. The tool
prints counts only. Before the clean-up, with the rehearsal's dump:

```sh
ssh root@turing 'bash -s' <<'EOF'
set -euo pipefail
W=/root/qa-cutover
R=$(cat "$W/rehearsal")
if ! [[ $R =~ ^rehearsal-[0-9]{8}-[0-9]{4}$ ]]; then
    echo "STOP: $W/rehearsal names no rehearsal ('$R'); nothing was read"
    exit 1
fi
docker run --rm -v qa-backup:/backup:ro -v /root/qa-anon:/out --entrypoint /app/anonymize-dump \
    "qa-migrate:$(cat "$W/sha")" "/backup/$R" /out --database queer-augsburg
EOF
```

### The day

The site is down from step 2 to step 5. Have P1 to P6 done, the last rehearsal recent.

1.  Right before step 2. turing's Docker Compose must be the version the blocks of the
    cutover were tested with ("Versions"); an Arch update since then can have brought
    another one:

    ```sh
    ssh root@turing 'bash -s' <<'EOF'
    set -euo pipefail
    V=$(docker compose version --short 2>&1 || true)
    if [ "$V" != 5.1.3 ]; then
        echo "STOP: docker compose on turing is '$V', the cutover was tested with 5.1.3; nothing was changed"
        exit 1
    fi
    echo "docker compose $V, as tested"
    EOF
    ```

    `STOP: …` means: do not start the downtime. On your machine, run the two docker tests of
    "Versions" (`cutover-remove-server-docker.sh`, `pin-mongo-server-docker.sh`) with the
    release binary of that version as `COMPOSE`. Only if both pass, put that version into
    this block, into R1 and R2 ("Going back", which start with the same check) and into
    "Versions" (a commit, so the next paste has it), and paste the block again. If a test
    fails, the runbook does not hold for that compose: stay on Mongo until it is fixed; P1's
    pin holds meanwhile.

    Then on your machine: `bash deployment/compare-api.sh capture /tmp/qa-cutover/before`.
2.  P1's pin still holds (`PINNED`, so the server about to stop is the way back). Stop the
    server (rooms save on SIGTERM, "Documents"); the PWA keeps showing cached meetings, the API
    answers 502, nobody can log in. The container is removed, not only stopped: a stopped
    container with `restart: always` comes back when the Docker daemon restarts, and from day
    step 3 on its mounted config would already be the Postgres one. Every later start creates
    the server from the compose file (step 5, R1). Then the dump that the migrator reads and that stays as the
    record of the last Mongo state, and the counts, which are final now:

    ```sh
    ssh root@turing 'bash -s' <<'EOF'
    set -euo pipefail
    D=/mnt/alpha/manifest/server/public/queer-augsburg/deployment
    W=/root/qa-cutover
    S=$W/src/deployment
    cd "$D/results"
    bash "$S/pin-mongo-server.sh" --check
    if ! diff -u "$W/pre-postgres/docker-compose.rollback.yml" docker-compose.yml || ! diff -rq "$W/pre-postgres/config" config; then
        echo "STOP: results/ is not what P1 saved in $W/pre-postgres (above), it was edited since; nothing was stopped"
        exit 1
    fi
    STOP_SETTINGS=$(docker inspect qa-server --format '{{.Config.StopSignal}} {{.Config.StopTimeout}}')
    if [ "$STOP_SETTINGS" != "SIGTERM 20" ]; then
        echo "STOP: qa-server stops with '$STOP_SETTINGS', not 'SIGTERM 20': its rooms would not be saved; nothing was stopped"
        exit 1
    fi
    docker compose -p results rm -sf qa-server
    if docker container inspect qa-server >/dev/null 2>&1; then
        echo "STOP: a container qa-server still exists, it is not service qa-server of project results; nothing was dumped"
        exit 1
    fi
    C=cutover-$(date +%Y%m%d-%H%M%S)
    echo "$C" >"$W/cutover"
    docker exec qa-db bash -c 'mongodump --host qa-db --port "${MONGODB_PORT_NUMBER:?}" --username root --password "$MONGODB_ROOT_PASSWORD" --authenticationDatabase admin --db queer-augsburg --out "/backup/$0"' "$C"
    bash "$S/migrate-config.sh" qa-db "$C" >"$W/$C.migrate.yml"
    cat "$W/$C.migrate.yml"
    EOF
    ```

    `rm -sf` stops with SIGTERM and waits up to the container's `stop_grace_period` (20 s,
    which compose stored in the container when it created it; `rm` does not read the file),
    so the rooms are saved (up to 15 s, `ROOMS_SHUTDOWN_TIMEOUT`). A `kill`, or a `stop` with
    `-t` under those 15 s (`-t 0`, `-t 10`) before it, would lose them; a plain `docker stop`
    uses the stored 20 s as well. So before it stops anything the block reads what the live
    container has stored, as the Documents rollout did ("The first rollout", step 3): the
    server image's `STOPSIGNAL SIGTERM` and the template's `stop_grace_period: 20s`. `STOP:
    qa-server stops with '…'` comes before anything is changed, and the site is still up on
    Mongo: `SIGTERM <nil>` is a container created from a file without `stop_grace_period`,
    which docker stops after its default 10 s. The way on: in
    `/root/qa-cutover/pre-postgres/docker-compose.rollback.yml`, the file R1 installs, give
    `qa-server` the line `stop_grace_period: 20s` (and remove a `stop_signal:` line), then
    this block makes that file the live one and creates the server from it (a few seconds
    without API, as in P1). It must print `qa-server stops with 'SIGTERM 20'` and end with
    `PINNED …`:

    ```sh
    ssh root@turing 'bash -s' <<'EOF'
    set -euo pipefail
    D=/mnt/alpha/manifest/server/public/queer-augsburg/deployment
    W=/root/qa-cutover
    cd "$D/results"
    cp "$W/pre-postgres/docker-compose.rollback.yml" docker-compose.yml
    docker compose -p results up -d --no-deps --force-recreate qa-server
    echo "qa-server stops with '$(docker inspect qa-server --format '{{.Config.StopSignal}} {{.Config.StopTimeout}}')'"
    bash "$W/src/deployment/pin-mongo-server.sh" --check
    EOF
    ```

    Then P4 again (the live compose file changed, and day step 3 compares with P4's record)
    and the day from step 1.

    `STOP: results/ is not what P1 saved …` also comes before anything is changed: the live
    compose file (its difference shown) or a file of `config/` (named) was edited after P1.
    R1 puts P1's copies back, so such an edit would silently vanish in a rollback, and day
    step 3 would replace it. If the edit stays, make the same edit in
    `/root/qa-cutover/pre-postgres/` (`docker-compose.rollback.yml` or `config/`) and in
    `/root/qa-cutover/staged/`, then P4 again. If it goes, copy P1's file back
    (`cp /root/qa-cutover/pre-postgres/docker-compose.rollback.yml docker-compose.yml`, or the
    file from `pre-postgres/config/`); an edit of `qa-server` that was applied with an `up` is
    undone with the block above, of another service with
    `docker compose -p results up -d --no-deps <service>`. Then the day from step 1. `.env`
    is not compared: P5 added lines to it, R1 leaves it as it is, and no step copies it.

    `rm -sf` exits 0 also when no container of project `results` matches ("No stopped
    containers"), so the block checks that no `qa-server` is left before it dumps. `STOP: a
    container qa-server still exists …` means the container is not compose's `qa-server` of
    project `results` and `rm` did not touch it: if it ran, the site is still up on Mongo, and
    nothing was dumped or changed.
    `docker inspect qa-server --format '{{index .Config.Labels "com.docker.compose.project"}} {{index .Config.Labels "com.docker.compose.service"}}'`
    names its project and service; P1 checked both, so it was created again since. Do not go
    on before that is understood.

    If P1's check fails when the block is pasted first, nothing is stopped. **If the block
    fails after the `rm`** (`mongodump` or `migrate-config.sh`), the site is down and the old
    server is gone. Pasting the block again then changes nothing: it stops at its first
    check, as P1's check finds no `qa-server` (`STOP: qa-server does not run the image of
    …`). The way back is R1 ("Going back"): Mongo has not been written, so nothing is lost.
    Then find the cause, paste "Trying again" (no `qa-pg` exists yet, it changes nothing) and
    start again from step 1. Each attempt dumps into a directory of
    its own (`cutover-<date>-<time to the second>`, named in `/root/qa-cutover/cutover`); a
    failed attempt's stays in the backup volume and is not read again.

    `deployment/tests/cutover-remove-server-docker.sh` runs this block and the others of the
    day whole against stand-ins ("Versions"): with a foreign `qa-server` that runs or was
    created and never started, with a `qa-server` without `stop_grace_period` (then the fix
    above, and this block goes through) or with `SIGKILL`, with the compose file or the
    config edited since P1, with P1's check, `mongodump` or `migrate-config.sh` failing,
    pasted again after `mongodump` failed, and R1 and this block again after that.

    If the rehearsal needed `ignored_fields`, copy them into `/root/qa-cutover/<cutover>.migrate.yml` now.

3.  The new compose file and config (P4), and `qa-pg` from an empty volume. From here on
    the server is pinned by `QA_SERVER_IMAGE_TAG` (P5) instead of P1's digest:

    ```sh
    ssh root@turing 'bash -s' <<'EOF'
    set -euo pipefail
    D=/mnt/alpha/manifest/server/public/queer-augsburg/deployment
    W=/root/qa-cutover
    cd "$D/results"
    if docker volume inspect qa-pg >/dev/null 2>&1; then
        echo "STOP: the volume qa-pg exists, see 'Trying again' (Going back); nothing was changed"
        exit 1
    fi
    find "$D/results/docker-compose.yml" "$D/results/config" "$W/staged/docker-compose.yml" "$W/staged/config" \
        -type f -exec sha256sum {} + | sort -k 2 >"$W/day3-compared.sha256"
    if ! diff "$W/p4-compared.sha256" "$W/day3-compared.sha256"; then
        echo "STOP: the live or the staged files are not the ones P4 compared (checksums above); nothing was changed"
        exit 1
    fi
    cp "$W/staged/docker-compose.yml" docker-compose.yml
    cp -a "$W/staged/config/." config/
    docker compose -p results config -q
    docker compose -p results up -d --no-deps qa-pg
    for _ in $(seq 120); do
        docker exec qa-pg pg_isready -q -h 127.0.0.1 -U qa_owner -d queer-augsburg && break
        sleep 1
    done
    docker exec qa-pg pg_isready -h 127.0.0.1 -U qa_owner -d queer-augsburg
    docker exec qa-pg psql -X -U qa_owner -d queer-augsburg -tAc \
        "SELECT rolname FROM pg_roles WHERE rolname = 'qa_app' AND rolcanlogin AND NOT rolsuper" | grep -x qa_app
    EOF
    ```

    `pg_isready` goes over TCP: during the first start the image runs `pg-init.sql` on a server
    that listens on its socket only.

    The two checks before the copy change nothing when they stop. `STOP: the volume qa-pg
    exists` means an earlier attempt's `qa-pg` is left: R1 (the site is down since step 2),
    then "Trying again", then the day from step 1. `STOP: the live or the staged files are
    not the ones P4 compared` lists, by checksum, each file changed, added or removed since
    the last P4: P4 again, and when it shows only the expected differences, this block again;
    otherwise R1 and find the edit.

    If the block fails after them, at any line and whether `qa-pg` exists yet or not, go back
    with R1 as for step 2, then "Trying again" (it removes a `qa-pg` this block created and
    changes nothing when there is none), then start again from step 1. The test runs this
    block with `QA_SERVER_IMAGE_TAG` missing from `.env` (P5 not done): it stops at `config
    -q`, after the new files were copied and before `qa-pg` exists, and R1 goes back from
    there. It also runs it with an existing volume `qa-pg`, with staged files changed since
    P4, and with a `pg-init.sql` that creates no `qa_app`.
4.  The migrator as `qa_app`; anything but `MIGRATION VERIFIED` → R1. Then the owner check, and
    the backup job's command by hand with its restore check: nothing writes yet, so the dump
    must equal the database. The report goes next to the dump.

    ```sh
    ssh root@turing 'bash -s' <<'EOF'
    set -euo pipefail
    D=/mnt/alpha/manifest/server/public/queer-augsburg/deployment
    W=/root/qa-cutover
    SHA=$(cat "$W/sha")
    S=$W/src/deployment
    C=$(cat "$W/cutover")
    if ! [[ $C =~ ^cutover-[0-9]{8}-[0-9]{6}$ ]]; then
        echo "STOP: $W/cutover names no dump of day step 2 ('$C'); nothing was changed"
        exit 1
    fi
    cd "$D/results"
    DATABASE_URL="postgres://qa_app:$(sed -n 's/^POSTGRES_APP_PASSWORD_QA=//p' .env)@qa-pg:5432/queer-augsburg" \
        docker run --rm --network qa-pg -e DATABASE_URL -v qa-backup:/backup:ro \
        -v "$W/$C.migrate.yml:/migrate.yml:ro" "qa-migrate:$SHA" migrate --config /migrate.yml |
        tee "$W/$C.report.txt"
    docker exec -i qa-pg psql -X -U qa_owner -d queer-augsburg <"$S/pg-owner-check.sql"
    docker exec qa-pg sh -c 'pg_dump -Fc -U qa_owner -d queer-augsburg -f /backup/queer-augsburg.pgdump.part && mv -f /backup/queer-augsburg.pgdump.part /backup/queer-augsburg.pgdump'
    docker exec -i qa-pg sh -s -- /backup/queer-augsburg.pgdump <"$S/pg-restore-check.sh"
    docker exec -i qa-db sh -c 'cat >"/backup/$0/migration-report.txt"' "$C" <"$W/$C.report.txt"
    EOF
    ```

    Compare the `rules applied:` and `warnings:` with the last rehearsal: other numbers than
    the writes since then explain mean another dump.

    If the block fails at any line (with `set -o pipefail` a failing migrator fails it
    through `tee`), the server has not run: R1, "Trying again", then the day from step 1.
    Nothing is lost.
5.  The server, then `qa-ofelia`. From the server's start on, every write exists only in
    `qa-pg`. The block first records that in `/root/qa-cutover/server-started` ("Trying
    again" reads it) and drops the record of an earlier R2's dump, which no longer holds
    everything once the server runs again:

    ```sh
    ssh root@turing 'bash -s' <<'EOF'
    set -euo pipefail
    D=/mnt/alpha/manifest/server/public/queer-augsburg/deployment
    W=/root/qa-cutover
    cd "$D/results"
    date +%Y%m%d-%H%M%S >"$W/server-started"
    rm -f "$W/rollback-checked" "$W/rollback-uploaded"
    listening=no
    if docker compose -p results up -d --no-deps qa-server; then
        for _ in $(seq 120); do
            if docker logs qa-server 2>&1 | grep 'Listening on' >/dev/null; then
                listening=yes
                break
            fi
            sleep 1
        done
    fi
    if [ "$listening" != yes ]; then
        docker compose -p results rm -sf qa-server
        echo "STOP: qa-server did not listen within 120 s and was removed again, so it takes no writes; go back with R2, then R1"
        exit 1
    fi
    docker logs qa-server 2>&1 | grep 'Listening on'
    EOF
    ```

    Its last line is `Listening on …`. **If the block fails at any line, go back with R2,
    then R1** (never R1 alone: the server may have taken writes). A server that does not
    listen within 120 s is removed again (with SIGTERM, so it saves) and cannot start later
    by `restart: always`, so `STOP: qa-server did not listen …` leaves no server; R2 then
    finds none and goes on. A failure of `up` or of that removal can leave a server running,
    and R2 removes it first. The server's log goes with the container; P6 starts the same
    image on a copy and shows why it does not start.

    Then `qa-ofelia`, which reads its jobs only when it starts: without the recreate the new
    `backup-qa-pg` job never runs. The last line is `New job registered "backup-qa-pg" …`:

    ```sh
    ssh root@turing 'bash -s' <<'EOF'
    set -euo pipefail
    D=/mnt/alpha/manifest/server/public/queer-augsburg/deployment
    cd "$D/results"
    docker compose -p results up -d --no-deps --force-recreate qa-ofelia
    for _ in $(seq 60); do
        docker logs qa-ofelia 2>&1 | grep 'New job registered "backup-qa-pg"' >/dev/null && break
        sleep 1
    done
    docker logs qa-ofelia 2>&1 | grep 'New job registered "backup-qa-pg"'
    EOF
    ```

    If this one fails, the server runs on Postgres and keeps running; what is missing is
    `qa-ofelia` with the `backup-qa-pg` job (when the recreate itself failed, `qa-ofelia` and
    all its weekly jobs). Paste this block again; it recreates `qa-ofelia` only. If it keeps
    failing, `docker logs qa-ofelia` shows why, and `config/ofelia.conf` must have the job
    (P4); until it runs, step 8's upload is the only backup of Postgres. Going back stays R2,
    then R1, which recreates `qa-ofelia` with the old jobs.
6.  The site is back. Check "After a server update", and in addition: open a document in the
    editor, search a document, open the member list as admin. From here on, going back is R2.
7.  On your machine:

    ```sh
    ( set -euo pipefail
        bash deployment/compare-api.sh capture /tmp/qa-cutover/after
        bash deployment/compare-api.sh compare /tmp/qa-cutover/before /tmp/qa-cutover/after
    )
    ```

    `meetings_overview` (explicit range) compares byte for byte, the iCal feed byte for byte
    without its `DTSTAMP` lines (the render time, different on every request on either
    server), `get_meetings?t=Active` as a set of meetings plus `selected_total_count` and
    `last_updated` (its order depends on the time of the request). `identical` → stay.
    `same content, other order` or `DIFFERS` → R2, unless an edit explains it that was made
    after step 1's capture: until step 2's `rm` the site was up on Mongo, from step 5 on it is
    up on Postgres, and both take edits. The rehearsal showed `identical`, so anything else
    is new.
8.  After the downtime: the cutover dump, the migrator's report and the first Postgres dump to
    S3 now, not with the next weekly upload. This uploads the whole backup volume as the
    weekly job does and leaves its schedule alone (`send_backup` of `backup/src/backup_script.py`).
    The same block is the last step of going back with R2 (R2, R1, this): when R2's dump
    passed its restore check (`/root/qa-cutover/rollback-checked` names it), the block
    checks that the dump is in the backup volume, uploads, and only after an upload that
    exited 0 records that dump in `/root/qa-cutover/rollback-uploaded`, which "Trying again"
    requires:

    ```sh
    ssh root@turing 'bash -s' <<'EOF'
    set -euo pipefail
    W=/root/qa-cutover
    K=
    if [ -e "$W/rollback-checked" ]; then
        K=$(cat "$W/rollback-checked")
        if ! [[ $K =~ ^rollback-[0-9]{8}-[0-9]{6}$ ]] || ! docker exec qa-backup test -s "/backup/$K.pgdump"; then
            echo "STOP: $W/rollback-checked names '$K', and the backup volume has no such dump; nothing was uploaded"
            exit 1
        fi
    fi
    docker exec qa-backup python3 -c 'import sys; sys.path.insert(0, "/app"); import backup_script; sys.exit(0 if backup_script.send_backup() else 1)'
    if [ -n "$K" ]; then
        echo "$K" >"$W/rollback-uploaded"
        echo "uploaded with $K.pgdump"
    fi
    EOF
    ```

    Exit 0 is an upload; check that the archive is in the bucket (after R2: that it holds
    `rollback-….pgdump`). A failing upload records nothing: find the cause
    (`docker logs qa-backup`, the bucket's credentials in `.env`) and paste the block again.
9.  After the first scheduled run of `backup-qa-pg` (`@weekly` on turing): the job ran without
    a failure, the dump is newer than the cutover, and it restores (while the server runs, so
    with `--live-may-differ`):

    ```sh
    ssh root@turing 'bash -s' <<'EOF'
    set -euo pipefail
    S=/root/qa-cutover/src/deployment
    docker logs qa-ofelia 2>&1 | grep '"backup-qa-pg"' | tail -n 3
    docker exec qa-pg stat -c '%y' /backup/queer-augsburg.pgdump
    docker exec -i qa-pg sh -s -- /backup/queer-augsburg.pgdump --live-may-differ <"$S/pg-restore-check.sh"
    EOF
    ```

    The weekly S3 upload after that carries it; check one archive.

### Going back

R1. Before step 5 started the server: nothing is lost. This is the way back from any point
after step 2's `rm` until step 5's first block, also when step 2, 3 or 4 failed, and with or
without `qa-pg`. From step 5's first block on, R2 comes first, then R1. The old compose file
(the server pinned to the old image's digest) and config back, the old server and
`qa-ofelia` with its old jobs, `qa-pg` stopped with its volume kept and without its restart
policy; no other service is touched (`--no-deps`). `qa-pg` mounts `config/pg-init.sql`,
which R1 removes: with `restart: always` the daemon would start it again at its next start
(a reboot), find the file missing and create a directory in its place (measured), which
would break R1 pasted again; with `restart: no` it stays stopped until R2 or "Trying again":

```sh
ssh root@turing 'bash -s' <<'EOF'
set -euo pipefail
V=$(docker compose version --short 2>&1 || true)
if [ "$V" != 5.1.3 ]; then
    echo "STOP: docker compose on turing is '$V', the cutover was tested with 5.1.3; nothing was changed"
    exit 1
fi
D=/mnt/alpha/manifest/server/public/queer-augsburg/deployment
W=/root/qa-cutover
cd "$D/results"
cp "$W/pre-postgres/docker-compose.rollback.yml" docker-compose.yml
cp -a "$W/pre-postgres/config/." config/
rm -f config/pg-init.sql
diff -r "$W/pre-postgres/config" config
docker compose -p results config -q
docker compose -p results up -d --no-deps --force-recreate qa-server qa-ofelia
if docker container inspect qa-pg >/dev/null 2>&1; then
    docker update --restart no qa-pg >/dev/null
    docker stop qa-pg
fi
for _ in $(seq 60); do
    docker logs qa-server 2>&1 | grep 'Listening on' >/dev/null && break
    sleep 1
done
docker logs qa-server 2>&1 | grep 'Listening on'
bash "$W/src/deployment/pin-mongo-server.sh" --check
EOF
```

The last line is P1's `PINNED …` again: the live compose pins the old image's digest and
`qa-server` runs exactly that image. If the local image is gone, compose pulls exactly it by
its digest. The old server continues on Mongo where it stopped. `.env` keeps the new
lines; nothing old reads them. Then "Trying again" before the next attempt.

Where R1 stops instead, and the way on. In each case the site is down, Mongo has not been
written since step 2, and R1 can be pasted again once the cause is fixed; it ends with the
same check:

-   At `diff -r` (it names a file, `Only in config: …`): a file in `config/` that P1's copy
    does not have, other than `pg-init.sql`. The old compose file and config are live, no
    container has changed. Move the file out of `config/`, one level up as in "The first
    rollout" (`mv config/<file> ../<file>.cutover`), then R1 again.
-   At `config -q` or `up`: compose's message names the cause (a file it cannot read, an
    image it cannot pull, the daemon). The old files are live; `up` may have recreated one
    of the two services. Fix the cause, then R1 again.
-   After its wait (the `grep` prints nothing, no `PINNED`): the old server runs from the
    old files but does not listen. `docker logs qa-server` says why (it reads `qa-db`:
    `docker ps` shows whether that runs). Fix that, then R1 again.
-   At P1's check (`STOP: …`, the last line): the old files are live and a server runs, but
    not the image P1 recorded, or not from the pinned file. Find out why before anything
    else (`docker inspect qa-server --format '{{.Image}}'` against
    `/root/qa-cutover/pre-postgres/server-image.txt`), then R1 again: it recreates the old
    server once more (a few seconds without API).

What R1 replaces, and why that is never more than it should: it copies P1's compose file and
config over the live ones and removes `config/pg-init.sql`, so it undoes every change to
them since P1. Day step 2 stops unless the live files are exactly P1's copies, and day step
3 copies only while the live and the staged files are what P4 compared. So until R1 the live
files changed only by day step 3's copy, unless someone edited them after day step 3 (during
the downtime, or after step 5 while the decision is open): R1 undoes such an edit too, which
is what going back to the Mongo setup P1 saved means; make it again afterwards if it is
still wanted. A file R1 would leave behind stops it at `diff -r`. `.env` is not touched (P5's
lines stay, unused). Of the containers only `qa-server` and `qa-ofelia` are recreated and
`qa-pg` stopped: `--no-deps` keeps compose from converging any other service to the old file
(in production the files define them alike, P4). The test checks each of these after every
R1.

R1 and R2 start with the compose check of day step 1: these blocks and P1's pin were tested
with that compose only. Its `STOP: docker compose on turing is …` comes before anything is
changed (what runs keeps running, R2's server too); then do what day step 1 says for that
version before going back.

R2. From step 5's first block on, also when step 5 failed at any line: everything the server
wrote since is lost for the site. First the server is removed and what it wrote kept: a dump
that restores, then the migrator's `verify` against the cutover dump (the collections whose
target count or digest differ are the ones changed on Postgres, and the dump holds the rows
the board has to enter again). Then R1, then step 8's block, which uploads the dump; only
then does "Trying again" remove the volume `qa-pg`.

```sh
ssh root@turing 'bash -s' <<'EOF'
set -euo pipefail
V=$(docker compose version --short 2>&1 || true)
if [ "$V" != 5.1.3 ]; then
    echo "STOP: docker compose on turing is '$V', the cutover was tested with 5.1.3; nothing was changed"
    exit 1
fi
D=/mnt/alpha/manifest/server/public/queer-augsburg/deployment
W=/root/qa-cutover
SHA=$(cat "$W/sha")
S=$W/src/deployment
C=$(cat "$W/cutover")
if ! [[ $C =~ ^cutover-[0-9]{8}-[0-9]{6}$ ]]; then
    echo "STOP: $W/cutover names no dump of day step 2 ('$C'); nothing was changed"
    exit 1
fi
cd "$D/results"
docker compose -p results rm -sf qa-server
if docker container inspect qa-server >/dev/null 2>&1; then
    echo "STOP: a container qa-server still exists, it is not service qa-server of project results; nothing was dumped"
    exit 1
fi
# After R1 qa-pg is stopped, without its restart policy, and its config/pg-init.sql is gone.
if [ ! -e config/pg-init.sql ]; then
    cp "$W/staged/config/pg-init.sql" config/pg-init.sql
fi
docker update --restart always qa-pg >/dev/null
docker start qa-pg >/dev/null
for _ in $(seq 120); do
    docker exec qa-pg pg_isready -q -h 127.0.0.1 -U qa_owner -d queer-augsburg && break
    sleep 1
done
docker exec qa-pg pg_isready -h 127.0.0.1 -U qa_owner -d queer-augsburg
K=rollback-$(date +%Y%m%d-%H%M%S)
if docker exec qa-pg test -e "/backup/$K.pgdump"; then
    echo "STOP: /backup/$K.pgdump exists already; paste R2 again"
    exit 1
fi
docker exec qa-pg sh -c 'pg_dump -Fc -U qa_owner -d queer-augsburg -f "/backup/$0.pgdump"' "$K"
docker exec -i qa-pg sh -s -- "/backup/$K.pgdump" <"$S/pg-restore-check.sh"
echo "$K" >"$W/rollback-checked"
DATABASE_URL="postgres://qa_app:$(sed -n 's/^POSTGRES_APP_PASSWORD_QA=//p' .env)@qa-pg:5432/queer-augsburg" \
    docker run --rm --network qa-pg -e DATABASE_URL -v qa-backup:/backup:ro \
    -v "$W/$C.migrate.yml:/migrate.yml:ro" "qa-migrate:$SHA" verify --config /migrate.yml |
    tee "$W/$K.verify.txt" || true
EOF
```

`RESTORE CHECK PASSED: the dump restores and equals the live database` comes before the
migrator's output, and only after it does R2 record the dump in
`/root/qa-cutover/rollback-checked`. The migrator's `verify` fails after writes
(`MIGRATION FAILED`), which is expected and does not fail the block; its report is in
`/root/qa-cutover/rollback-….verify.txt`.

The `STOP` after `rm -sf` is the one of day step 2: the container `qa-server` is not
compose's, it was not touched, and nothing was dumped; find out where it came from before R1.

If R2 fails at another line (`pg_isready`, `pg_dump`, `RESTORE CHECK FAILED`), the server is
removed already and the site is down, and `qa-pg` with its volume holds every write,
untouched. No dump was recorded, so "Trying again" refuses to remove them. Paste R2 again
(every run dumps into a file of its own). If it keeps failing, R1 brings the site back on
Mongo, and the writes stay in the volume `qa-pg` only; find the cause, then R2 again. R2
then starts `qa-pg` again, and it also removes the old server R1 started (a stop as in a
deploy; Mongo keeps what that server wrote), so R1 follows it again, then step 8. For that
start R2 puts back `config/pg-init.sql` (only read on an empty volume, so its content does
not matter here) and `qa-pg`'s restart policy, which R1 took.

Trying again, after R1 (and after R2 and step 8, when the server ran): the volume `qa-pg`
must be empty for day step 3, and P1 stays as it is (R1 put its pin back). Paste this before
every new attempt; with no volume `qa-pg` it changes nothing. It removes the container and
volume `qa-pg` when the server never ran on it (step 5's first block writes
`/root/qa-cutover/server-started`), and otherwise only when R2's dump passed its restore check
and step 8 uploaded exactly that dump since (`rollback-checked` and `rollback-uploaded` name
it; step 5 drops both when it starts the server again). That dump is in the backup volume
(`/backup/rollback-….pgdump`, not in `qa-pg`) and in that S3 archive.

```sh
ssh root@turing 'bash -s' <<'EOF'
set -euo pipefail
W=/root/qa-cutover
if ! docker volume inspect qa-pg >/dev/null 2>&1; then
    echo "no volume qa-pg: nothing to remove"
    exit 0
fi
if [ -e "$W/server-started" ]; then
    CHECKED=$(cat "$W/rollback-checked" 2>/dev/null || true)
    UPLOADED=$(cat "$W/rollback-uploaded" 2>/dev/null || true)
    if [ -z "$CHECKED" ] || [ "$UPLOADED" != "$CHECKED" ]; then
        echo "STOP: the server ran on qa-pg, and no dump of it since passed R2's restore check and step 8's upload (checked '$CHECKED', uploaded '$UPLOADED'); nothing was removed"
        exit 1
    fi
    echo "qa-pg is in /backup/$CHECKED.pgdump, restore-checked and uploaded"
fi
docker rm -f qa-pg
docker volume rm qa-pg
rm -f "$W/server-started" "$W/rollback-checked" "$W/rollback-uploaded"
EOF
```

`STOP: the server ran on qa-pg …` means R2 has not passed since the server last ran, or step
8 has not uploaded that dump since: R2 (it removes the old server R1 started, so R1 again
after it), step 8, then this block again. `server-started` is written only by step 5's first
block, so a server started on `qa-pg` another way (an `up` by hand while the new compose file
is live) is not seen: from day step 3 until R1, start nothing of project `results` by hand.

Then P6 (and P3, P4, P5 for a new commit) and the day from step 1.

### After the window

`qa-db` stays 14 days, connected to nothing, its weekly dump job still running. Then one
commit removes from the template the service `qa-db`, its volume and network, `qa-db` from
`depends_on` of `qa-ofelia`, the `backup-qa-db` job of `config/ofelia.conf` and the `qa-db-uri`
of `admin.yml`, and with them the `migration_hashes` table (a migration), the `mongo-source`
feature with `server/Dockerfile.migrate` and the feature's CI steps. `mongodb/` stays: it also
builds `qa-interossea-db`. On turing, as in P4: render, compare, copy, then
`docker compose -p results up -d --no-deps --force-recreate qa-ofelia` **before** removing
the container, `docker rm -f qa-db`, and only once the S3 archive of step 8 is confirmed,
`docker volume rm qa-db` and `docker exec qa-backup rm -rf /backup/queer-augsburg`.
`/root/qa-cutover` can go once turing's checkout is at the cutover commit or later; with it
goes P1's digest pin (`pre-postgres`), which only R1 used, and the tag `:pre-postgres` can be
removed. The server stays pinned by `QA_SERVER_IMAGE_TAG` as since day step 3 ("Server
image"), and `update-containers.sh` keeps refusing an untagged server.

## Rolling back the server

Dependency updates do not change what is stored: an older image reads and writes the data as
before. Go back by setting the previous tag ("Server image"). Since the Postgres cutover that
works only for tags from the cutover commit on: an older server reads MongoDB, and going back
that far is "Going back" of the cutover, inside its window.

**Going back behind the documents** needs MongoDB: a server from before the documents is older
than the Postgres cutover, so first "Going back" of the cutover (R1 or R2, inside its window),
then, on the old compose file, this. An older server cannot read a user holding a capability
it does not know, so those users could no longer log in and the member list fails. So in this
order:

1.  Remove the capability from everybody; the count must be 0:

    ```sh
    ssh root@turing 'bash -s' <<'EOF'
    docker exec qa-db bash -c 'mongosh --quiet --port "${MONGODB_PORT_NUMBER:?}" -u root -p "$MONGODB_ROOT_PASSWORD" --authenticationDatabase admin queer-augsburg --eval "
    printjson(db.users.updateMany({capabilities: \"UpdateDocuments\"}, {\$pull: {capabilities: \"UpdateDocuments\"}}));
    print(db.users.countDocuments({capabilities: \"UpdateDocuments\"}))"'
    EOF
    ```

2.  In `results/docker-compose.yml`, the `qa-server` image (the digest R1 put there) becomes
    `firstdorsal/queer-augsburg-server:pre-documents`; `docker tag firstdorsal/queer-augsburg-web:pre-documents firstdorsal/queer-augsburg-web:latest`;
    then `docker compose -p results up -d --no-deps --force-recreate qa-server qa-web`
    without a `pull`. The old image stops with SIGKILL again, which no longer matters then.
3.  The compose edits can stay. The document collections stay too, and an older server ignores them.

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
