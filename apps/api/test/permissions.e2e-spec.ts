import type { Server } from 'node:http';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp } from './utils/create-test-app';

const DEV_PASSWORD = 'DevPassword123!';

async function loginAs(server: Server, email: string): Promise<string> {
  const res = await request(server)
    .post('/api/v1/auth/login')
    .send({ email, password: DEV_PASSWORD });
  if (res.status !== 200) {
    throw new Error(
      `Seed user ${email} could not log in (status ${res.status}) — has \`pnpm db:seed\` been run against this database?`,
    );
  }
  return res.body.accessToken as string;
}

/**
 * Every mutating endpoint introduced this phase has a permission-denied
 * case (DEVELOPMENT_RULES §8), exercised against the actual seeded roles
 * (`apps/api/prisma/seed.ts` must have run — CI runs it right after
 * migrations; locally: `pnpm db:seed`).
 */
describe('Permission enforcement (e2e)', () => {
  let app: INestApplication;
  let server: Server;
  let executiveToken: string;
  let managerToken: string;

  beforeAll(async () => {
    app = await createTestApp();
    server = app.getHttpServer() as Server;
    executiveToken = await loginAs(server, 'executive@hublanka.dev');
    managerToken = await loginAs(server, 'manager@hublanka.dev');
  });

  afterAll(async () => {
    await app.close();
  });

  it('rejects every request with no token at all', async () => {
    const res = await request(server).get('/api/v1/users');
    expect(res.status).toBe(401);
  });

  it('denies GET /users to a role without identity.user.manage', async () => {
    const res = await request(server)
      .get('/api/v1/users')
      .set('Authorization', `Bearer ${executiveToken}`);
    expect(res.status).toBe(403);
  });

  it('denies POST /users to a role without identity.user.manage', async () => {
    const res = await request(server)
      .post('/api/v1/users')
      .set('Authorization', `Bearer ${executiveToken}`)
      .send({
        email: 'denied-e2e@hublanka.dev',
        password: 'whatever123',
        fullName: 'Denied',
        roleIds: [],
      });
    expect(res.status).toBe(403);
  });

  it('denies PATCH /users/:id to a role without identity.user.manage', async () => {
    const res = await request(server)
      .patch('/api/v1/users/does-not-matter')
      .set('Authorization', `Bearer ${executiveToken}`)
      .send({ fullName: 'x' });
    expect(res.status).toBe(403);
  });

  it('denies role assignment to a role without identity.user.manage', async () => {
    const res = await request(server)
      .post('/api/v1/users/does-not-matter/roles')
      .set('Authorization', `Bearer ${executiveToken}`)
      .send({ roleId: 'does-not-matter' });
    expect(res.status).toBe(403);
  });

  it('denies GET /roles to a role without identity.user.manage', async () => {
    const res = await request(server)
      .get('/api/v1/roles')
      .set('Authorization', `Bearer ${executiveToken}`);
    expect(res.status).toBe(403);
  });

  it('allows GET /users to Manager (holds identity.user.manage)', async () => {
    const res = await request(server)
      .get('/api/v1/users')
      .set('Authorization', `Bearer ${managerToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('allows GET /roles to Manager and returns the seeded permission matrix', async () => {
    const res = await request(server)
      .get('/api/v1/roles')
      .set('Authorization', `Bearer ${managerToken}`);
    expect(res.status).toBe(200);
    const managerRole = res.body.find((role: { name: string }) => role.name === 'Manager');
    expect(managerRole.permissions).toContain('identity.user.manage');
  });
});
