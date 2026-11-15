# Data migrations

One directory per migration, named `YYYY-MM-DD-topic`, with its own README (order, backup,
commands, verification, rollback). Migrations are mongosh scripts run by hand on turing;
they are not part of the server image. Every script is a dry run unless `APPLY=true` is
passed, checks everything before writing, and can be run again without changing anything.

Since the move to Postgres the schema lives in `server/migrations-sql/` (sqlx migrations, embedded
in the server and applied at every start; `cargo sqlx migrate run --source migrations-sql` for a
development database, with sqlx-cli 0.9.0 as in CI:
`cargo install sqlx-cli --version 0.9.0 --no-default-features --features postgres --locked`, check
with `sqlx --version`; see `server/dev/docker-compose.yml`). Data migrations that need more than SQL go there too, as a numbered
migration, with a README next to it as above. The mongosh scripts in this directory are history;
`web/src/places.test.ts` still reads one of them.
