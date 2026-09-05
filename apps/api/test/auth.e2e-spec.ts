import type { Server } from 'node:http';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PasswordHasherService } from '../src/identity/password-hasher.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { createTestApp } from './utils/create-test-app';

describe('Auth (e2e)', () => {
  let app: INestApplication;
  let server: Server;
  let prisma: PrismaService;

  const testEmail = 'e2e-auth-test@hublanka.dev';
  const testPassword = 'CorrectHorseBatteryStaple1!';
  let userId: string;

  beforeAll(async () => {
    app = await createTestApp();
    server = app.getHttpServer() as Server;
    prisma = app.get(PrismaService);
    const passwordHasher = app.get(PasswordHasherService);

    await prisma.user.deleteMany({ where: { email: testEmail } });
    const passwordHash = await passwordHasher.hash(testPassword);
    const user = await prisma.user.create({
      data: { email: testEmail, passwordHash, fullName: 'E2E Test User' },
    });
    userId = user.id;
  });

  afterAll(async () => {
    // audit_log itself is intentionally left alone: the restricted runtime
    // role this test connects as cannot DELETE from it (the exact grant
    // restriction this phase adds — see audit-log-grants.e2e-spec.ts), so
    // leftover rows from this suite are expected and correct.
    await prisma.refreshToken.deleteMany({ where: { userId } });
    await prisma.user.delete({ where: { id: userId } });
    await app.close();
  });

  it('rejects login with a wrong password', async () => {
    const res = await request(server)
      .post('/api/v1/auth/login')
      .send({ email: testEmail, password: 'wrong-password' });
    expect(res.status).toBe(401);
  });

  it('rejects login with an unknown email using the same generic message', async () => {
    const res = await request(server)
      .post('/api/v1/auth/login')
      .send({ email: 'nobody-e2e@hublanka.dev', password: 'whatever123' });
    expect(res.status).toBe(401);
    expect(res.body.error.message).toBe('Invalid email or password');
  });

  it('logs in successfully, returns an access token, and sets a refresh cookie', async () => {
    const res = await request(server)
      .post('/api/v1/auth/login')
      .send({ email: testEmail, password: testPassword });

    expect(res.status).toBe(200);
    expect(typeof res.body.accessToken).toBe('string');
    expect(res.body.user.email).toBe(testEmail);
    expect(res.headers['set-cookie']).toBeDefined();
  });

  it('GET /me returns the current user with a valid access token', async () => {
    const login = await request(server)
      .post('/api/v1/auth/login')
      .send({ email: testEmail, password: testPassword });

    const res = await request(server)
      .get('/api/v1/me')
      .set('Authorization', `Bearer ${login.body.accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.email).toBe(testEmail);
    expect(Array.isArray(res.body.permissions)).toBe(true);
  });

  it('rejects GET /me with no token', async () => {
    const res = await request(server).get('/api/v1/me');
    expect(res.status).toBe(401);
  });

  it('locks the account after repeated failed attempts', async () => {
    await prisma.user.update({
      where: { id: userId },
      data: { failedLoginCount: 0, lockedUntil: null },
    });

    for (let attempt = 0; attempt < 5; attempt += 1) {
      await request(server)
        .post('/api/v1/auth/login')
        .send({ email: testEmail, password: 'wrong' });
    }

    const res = await request(server)
      .post('/api/v1/auth/login')
      .send({ email: testEmail, password: testPassword });

    expect(res.status).toBe(401);
    expect(res.body.error.message).toMatch(/locked/i);

    await prisma.user.update({
      where: { id: userId },
      data: { failedLoginCount: 0, lockedUntil: null },
    });
  });

  it('rotates the refresh token and detects reuse of the superseded one', async () => {
    const agent = request.agent(server);
    const login = await agent
      .post('/api/v1/auth/login')
      .send({ email: testEmail, password: testPassword });
    const originalCookie = login.headers['set-cookie'];
    if (!originalCookie) {
      throw new Error('Login did not set a refresh cookie');
    }

    const rotated = await agent.post('/api/v1/auth/refresh');
    expect(rotated.status).toBe(200);
    expect(typeof rotated.body.accessToken).toBe('string');

    // The cookie captured at login is now the superseded (revoked) token —
    // presenting it again must revoke the whole family, not silently succeed.
    const reuse = await request(server).post('/api/v1/auth/refresh').set('Cookie', originalCookie);
    expect(reuse.status).toBe(401);

    // Confirms the whole family was revoked: even the token from the
    // rotation above no longer works.
    const afterReuse = await agent.post('/api/v1/auth/refresh');
    expect(afterReuse.status).toBe(401);
  });

  it('logs out and revokes the session', async () => {
    const agent = request.agent(server);
    const login = await agent
      .post('/api/v1/auth/login')
      .send({ email: testEmail, password: testPassword });

    const logoutRes = await agent
      .post('/api/v1/auth/logout')
      .set('Authorization', `Bearer ${login.body.accessToken}`);
    expect(logoutRes.status).toBe(204);

    const refreshAfterLogout = await agent.post('/api/v1/auth/refresh');
    expect(refreshAfterLogout.status).toBe(401);
  });
});
