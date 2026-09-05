-- Restricted runtime database role (ARCHITECTURE §10, PRD §11: "enforced at
-- the database grant level"). The application's running Nest process
-- connects as this role (APP_DATABASE_URL), never as the privileged role
-- that runs migrations (DATABASE_URL) — in PostgreSQL, whichever role owns
-- a table can always re-GRANT itself anything it REVOKEs, so this
-- restriction only means something enforced against a *different,
-- non-owning* role.
--
-- The migration password below is a non-production placeholder, the same
-- convention already used for `hublanka_dev_password`/`hublanka_ci_password`
-- in docker-compose.yml/ci.yml. Production sets a real password post-deploy
-- via `ALTER ROLE hublanka_app WITH PASSWORD '<secret>'` from the
-- deployment platform's secret manager — never committed, exactly like the
-- real production DATABASE_URL itself.
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'hublanka_app') THEN
    CREATE ROLE hublanka_app WITH LOGIN PASSWORD 'hublanka_app_dev_password';
  END IF;
END
$$;

GRANT USAGE ON SCHEMA public TO hublanka_app;

-- Existing tables/sequences as of this migration.
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO hublanka_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO hublanka_app;

-- Every table/sequence created by a *future* migration (always run as the
-- privileged CURRENT_USER) automatically grants hublanka_app the same
-- default access — no per-phase migration boilerplate needed to keep the
-- runtime role usable as the schema grows.
ALTER DEFAULT PRIVILEGES FOR ROLE CURRENT_USER IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO hublanka_app;
ALTER DEFAULT PRIVILEGES FOR ROLE CURRENT_USER IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO hublanka_app;

-- The actual restriction: audit_log is append-only for the runtime role.
REVOKE UPDATE, DELETE ON audit_log FROM hublanka_app;
