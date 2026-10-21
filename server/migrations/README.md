# Data migrations

One directory per migration, named `YYYY-MM-DD-topic`, with its own README (order, backup,
commands, verification, rollback). Migrations are mongosh scripts run by hand on turing;
they are not part of the server image. Every script is a dry run unless `APPLY=true` is
passed, checks everything before writing, and can be run again without changing anything.
