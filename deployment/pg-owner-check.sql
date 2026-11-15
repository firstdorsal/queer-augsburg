-- Fails unless qa_app owns every object in schema public, and names those it does not own.
-- qa_app applies the later migrations at every server start (config/pg-init.sql), and a
-- migration can only change what its role owns. Prints names of schema objects and owners,
-- never data. As qa_owner, after the schema exists (it also fails on an empty schema):
--
--     docker exec -i qa-pg psql -X -U qa_owner -d queer-augsburg < pg-owner-check.sql
--
-- deployment/tests/postgres.sh runs it against a schema qa_app created (passes) and one
-- qa_owner created (fails).

\set ON_ERROR_STOP on
DO $$
DECLARE
    owned integer;
    wrong text;
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'qa_app') THEN
        RAISE EXCEPTION 'role qa_app does not exist (config/pg-init.sql did not run)';
    END IF;
    IF (SELECT rolsuper OR rolcreaterole OR rolcreatedb OR rolbypassrls
        FROM pg_roles WHERE rolname = 'qa_app') THEN
        RAISE EXCEPTION 'qa_app has more than LOGIN (superuser, createrole, createdb or bypassrls)';
    END IF;

    SELECT string_agg(format('%s %s (owner %s)', kind, name, owner), ', ' ORDER BY kind, name)
    INTO wrong
    FROM (
        SELECT CASE c.relkind
                   WHEN 'r' THEN 'table' WHEN 'p' THEN 'table'
                   WHEN 'i' THEN 'index' WHEN 'I' THEN 'index'
                   WHEN 'S' THEN 'sequence' WHEN 'v' THEN 'view'
                   WHEN 'm' THEN 'materialized view' ELSE 'relation'
               END AS kind,
               c.relname::text AS name,
               pg_get_userbyid(c.relowner)::text AS owner
        FROM pg_class c
        WHERE c.relnamespace = 'public'::regnamespace AND c.relowner <> 'qa_app'::regrole
        UNION ALL
        SELECT 'type', t.typname::text, pg_get_userbyid(t.typowner)::text
        FROM pg_type t
        WHERE t.typnamespace = 'public'::regnamespace AND t.typowner <> 'qa_app'::regrole
        UNION ALL
        SELECT 'function', p.proname::text, pg_get_userbyid(p.proowner)::text
        FROM pg_proc p
        WHERE p.pronamespace = 'public'::regnamespace AND p.proowner <> 'qa_app'::regrole
    ) AS not_owned;

    IF wrong IS NOT NULL THEN
        RAISE EXCEPTION 'not owned by qa_app, so a later migration cannot change them: %', wrong;
    END IF;

    SELECT count(*) INTO owned FROM pg_class
    WHERE relnamespace = 'public'::regnamespace AND relkind IN ('r', 'p')
      AND relowner = 'qa_app'::regrole;
    IF owned = 0 THEN
        RAISE EXCEPTION 'schema public has no table owned by qa_app';
    END IF;
    RAISE NOTICE 'owner check passed: qa_app owns all % tables and everything else in schema public', owned;
END $$;
