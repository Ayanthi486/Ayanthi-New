import { execSync } from 'node:child_process';
import path from 'node:path';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { Client } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

/**
 * The one place this phase genuinely needs a real, isolated Postgres
 * rather than the shared CI/Docker-Compose instance (ARCHITECTURE §18,
 * DEVELOPMENT_RULES §8): proving `audit_log` truly rejects UPDATE/DELETE
 * *at the database grant level* means connecting as the actual restricted
 * `hublanka_app` role and asserting a real SQL permission-denied error —
 * not a service-layer assertion, and not something that should leave
 * residual roles/grants behind in a database other tests share. This spec
 * also doubles as a regression test that both migrations apply cleanly to
 * a brand-new database.
 */
describe('audit_log grant restrictions (Testcontainers)', () => {
  let container: StartedPostgreSqlContainer;
  let restrictedUrl: string;

  beforeAll(async () => {
    container = await new PostgreSqlContainer('postgres:17-alpine')
      .withDatabase('hublanka_test')
      .withUsername('hublanka')
      .withPassword('hublanka_test_password')
      .start();

    const privilegedUrl = container.getConnectionUri();

    execSync('pnpm exec prisma migrate deploy', {
      cwd: path.resolve(__dirname, '..'),
      env: { ...process.env, DATABASE_URL: privilegedUrl },
      stdio: 'inherit',
    });

    // Same non-production placeholder password the migration itself
    // creates the role with (see the migration's own comment).
    restrictedUrl = privilegedUrl.replace(
      'hublanka:hublanka_test_password',
      'hublanka_app:hublanka_app_dev_password',
    );
  }, 90_000);

  afterAll(async () => {
    await container.stop();
  });

  it('allows the restricted role to SELECT and INSERT on audit_log', async () => {
    const client = new Client({ connectionString: restrictedUrl });
    await client.connect();
    try {
      const insert = await client.query<{ id: string }>(
        `INSERT INTO audit_log (action, "entityType") VALUES ('test.action', 'Test') RETURNING id`,
      );
      expect(insert.rows[0]?.id).toBeDefined();

      const select = await client.query('SELECT * FROM audit_log WHERE id = $1', [
        insert.rows[0]?.id,
      ]);
      expect(select.rows).toHaveLength(1);
    } finally {
      await client.end();
    }
  });

  it('rejects UPDATE and DELETE on audit_log for the restricted role', async () => {
    const client = new Client({ connectionString: restrictedUrl });
    await client.connect();
    try {
      await expect(client.query(`UPDATE audit_log SET action = 'tampered'`)).rejects.toThrow(
        /permission denied/,
      );
      await expect(client.query('DELETE FROM audit_log')).rejects.toThrow(/permission denied/);
    } finally {
      await client.end();
    }
  });

  it('allows full DML on a non-audit table for the restricted role', async () => {
    const client = new Client({ connectionString: restrictedUrl });
    await client.connect();
    try {
      await client.query(`INSERT INTO role (id, name) VALUES ('tc-test', 'TestcontainerRole')`);
      await client.query(`UPDATE role SET description = 'x' WHERE id = 'tc-test'`);
      const result = await client.query('DELETE FROM role WHERE id = $1', ['tc-test']);
      expect(result.rowCount).toBe(1);
    } finally {
      await client.end();
    }
  });
});
