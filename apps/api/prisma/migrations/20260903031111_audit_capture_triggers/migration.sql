-- Automatic audit capture (ARCHITECTURE §10 layer 1), implemented as a
-- database trigger rather than a Prisma Client extension.
--
-- A Prisma Client extension was tried first and empirically failed: Node's
-- AsyncLocalStorage context reliably survives a `create` query through
-- Prisma 7's driver-adapter round trip, but does NOT reliably survive
-- `update`/`delete` — confirmed by direct repro (two sequential `create`
-- calls through an audited transaction succeeded; the first `update` or
-- `delete` call afterward always lost the AsyncLocalStorage context set
-- moments earlier in the very same async chain). That would have silently
-- broken audit capture for most real mutations (login lockout tracking,
-- user deactivation, role unassignment are all UPDATE/DELETE). A trigger
-- sidesteps the problem entirely: it fires as part of the SAME statement
-- and transaction by Postgres's own construction, with no dependency on
-- any JS-level async context surviving the driver's internals — and it is
-- unconditional, so unlike the extension attempt it cannot be bypassed by
-- a mutation that forgot to opt in.
--
-- Actor context (who/where) is passed from the application via
-- `SET LOCAL` session variables at the start of each transaction
-- (AuditService#auditedTransaction) — LOCAL so they never leak past that
-- transaction. This is Prisma's own documented reference pattern for this
-- exact problem (see prisma/prisma-client-extensions, audit-log-context
-- example), adapted to this schema.

CREATE OR REPLACE FUNCTION audit_capture() RETURNS trigger AS $$
DECLARE
  v_actor_user_id text;
  v_ip text;
  v_user_agent text;
  v_entity_id text;
BEGIN
  v_actor_user_id := NULLIF(current_setting('app.actor_user_id', true), '');
  v_ip := NULLIF(current_setting('app.actor_ip', true), '');
  v_user_agent := NULLIF(current_setting('app.actor_user_agent', true), '');

  IF TG_OP = 'INSERT' THEN
    v_entity_id := (to_jsonb(NEW) ->> 'id');
    INSERT INTO audit_log (action, "entityType", "entityId", before, after, "actorUserId", "ipAddress", "userAgent")
    VALUES (TG_TABLE_NAME || '.create', TG_TABLE_NAME, v_entity_id, NULL, to_jsonb(NEW), v_actor_user_id, v_ip, v_user_agent);
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    v_entity_id := (to_jsonb(NEW) ->> 'id');
    INSERT INTO audit_log (action, "entityType", "entityId", before, after, "actorUserId", "ipAddress", "userAgent")
    VALUES (TG_TABLE_NAME || '.update', TG_TABLE_NAME, v_entity_id, to_jsonb(OLD), to_jsonb(NEW), v_actor_user_id, v_ip, v_user_agent);
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    v_entity_id := (to_jsonb(OLD) ->> 'id');
    INSERT INTO audit_log (action, "entityType", "entityId", before, after, "actorUserId", "ipAddress", "userAgent")
    VALUES (TG_TABLE_NAME || '.delete', TG_TABLE_NAME, v_entity_id, to_jsonb(OLD), NULL, v_actor_user_id, v_ip, v_user_agent);
    RETURN OLD;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Attached to every identity/RBAC table except refresh_token (session
-- plumbing — excluded on purpose, see AuditService for the explicit
-- semantic events that cover authentication activity instead) and
-- audit_log itself (would recurse).
CREATE TRIGGER audit_capture_user
  AFTER INSERT OR UPDATE OR DELETE ON "user"
  FOR EACH ROW EXECUTE FUNCTION audit_capture();

CREATE TRIGGER audit_capture_role
  AFTER INSERT OR UPDATE OR DELETE ON role
  FOR EACH ROW EXECUTE FUNCTION audit_capture();

CREATE TRIGGER audit_capture_permission
  AFTER INSERT OR UPDATE OR DELETE ON permission
  FOR EACH ROW EXECUTE FUNCTION audit_capture();

CREATE TRIGGER audit_capture_user_role
  AFTER INSERT OR UPDATE OR DELETE ON user_role
  FOR EACH ROW EXECUTE FUNCTION audit_capture();

CREATE TRIGGER audit_capture_role_permission
  AFTER INSERT OR UPDATE OR DELETE ON role_permission
  FOR EACH ROW EXECUTE FUNCTION audit_capture();
