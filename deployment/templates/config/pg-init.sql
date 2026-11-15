-- Run once by the postgres image when the data volume is empty, as POSTGRES_USER (qa_owner,
-- the bootstrap superuser of this container) in POSTGRES_DB (queer-augsburg). Creates the role
-- the server connects as. The password comes from the environment of qa-pg; psql reads it
-- here, so it never appears in a rendered file.
--
-- One role owns the schema: qa_app. The server applies server/migrations-sql/ at every start
-- (DB::migrate) as qa_app, and a later migration that changes an existing object (ALTER TABLE,
-- ALTER TYPE, CREATE INDEX on a table, a foreign key to it) must own that object. So every
-- object in the schema is created by qa_app: by the server on a fresh deployment, and by the
-- migrator of the cutover, which connects as qa_app too (deployment/README.md "The Postgres
-- cutover"). qa_owner is the superuser for the console, dumps and restores and never creates
-- anything in the schema. It gets no default privileges for qa_app on purpose: an object it
-- created by mistake is unusable for the server at once instead of breaking the next
-- migration, and deployment/pg-owner-check.sql names it.
--
-- deployment/tests/postgres.sh runs this file through the image's entrypoint and checks it.

\set ON_ERROR_STOP on
\set app_password `printf %s "$POSTGRES_APP_PASSWORD"`

-- The server pastes the password into db.url (qa-server.yml) without encoding it, so only
-- letters and digits are safe ('/', '@', '#', '%', '+' break the URL, '$' is cut by compose).
-- Refused here, at the first start, instead of at the server's first connect. The message
-- never contains the password.
SELECT :'app_password' ~ '^[A-Za-z0-9]{32,}$' AS app_password_ok \gset
\if :app_password_ok
\else
DO $$ BEGIN
    RAISE EXCEPTION 'POSTGRES_APP_PASSWORD must be at least 32 letters and digits (deployment/add-postgres-secrets.sh)';
END $$;
\endif

CREATE ROLE qa_app LOGIN PASSWORD :'app_password';

-- DBNAME is psql's name for the database this runs in (POSTGRES_DB).
REVOKE ALL ON DATABASE :"DBNAME" FROM PUBLIC;
GRANT CONNECT, TEMPORARY ON DATABASE :"DBNAME" TO qa_app;
GRANT USAGE, CREATE ON SCHEMA public TO qa_app;
