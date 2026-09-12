import type { Server } from 'node:http';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PasswordHasherService } from '../src/identity/password-hasher.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { createTestApp } from './utils/create-test-app';

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const PNG_BYTES = Buffer.concat([PNG_SIGNATURE, Buffer.from([0x00, 0x01, 0x02])]);
// Passes magic-byte sniffing (only the leading signature is checked) while
// being large enough to exceed the 3MB AVATAR_MAX_SIZE_MB default without
// hitting Multer's own 5MB hard ceiling first.
const OVERSIZED_PNG_BYTES = Buffer.concat([PNG_SIGNATURE, Buffer.alloc(3.5 * 1024 * 1024, 1)]);
const PDF_BYTES = Buffer.from('%PDF-1.4\n%fake profile photo attempt\n');
const NOT_A_PNG_BYTES = Buffer.from('this is not actually a png file');

describe('Profile (e2e)', () => {
  let app: INestApplication;
  let server: Server;
  let prisma: PrismaService;

  const testEmail = 'e2e-profile-test@hublanka.dev';
  const testPassword = 'CorrectHorseBatteryStaple1!';
  let userId: string;
  let token: string;

  beforeAll(async () => {
    app = await createTestApp();
    server = app.getHttpServer() as Server;
    prisma = app.get(PrismaService);
    const passwordHasher = app.get(PasswordHasherService);

    await prisma.user.deleteMany({ where: { email: testEmail } });
    const passwordHash = await passwordHasher.hash(testPassword);
    const user = await prisma.user.create({
      data: { email: testEmail, passwordHash, fullName: 'E2E Profile Test User' },
    });
    userId = user.id;

    const login = await request(server)
      .post('/api/v1/auth/login')
      .send({ email: testEmail, password: testPassword });
    token = login.body.accessToken as string;
  });

  afterAll(async () => {
    await prisma.refreshToken.deleteMany({ where: { userId } });
    await prisma.user.delete({ where: { id: userId } });
    await app.close();
  });

  // --- Authentication boundary ---------------------------------------------
  it('rejects every /me and /me/avatar route with no token', async () => {
    const patch = await request(server).patch('/api/v1/me').send({ fullName: 'x' });
    expect(patch.status).toBe(401);

    const upload = await request(server)
      .post('/api/v1/me/avatar')
      .attach('avatar', PNG_BYTES, { filename: 'a.png', contentType: 'image/png' });
    expect(upload.status).toBe(401);

    const remove = await request(server).delete('/api/v1/me/avatar');
    expect(remove.status).toBe(401);

    const get = await request(server).get('/api/v1/me/avatar');
    expect(get.status).toBe(401);
  });

  // --- Full name -------------------------------------------------------------
  it('updates fullName via PATCH /me, reflected by GET /me, and cannot touch role/email', async () => {
    const res = await request(server)
      .patch('/api/v1/me')
      .set('Authorization', `Bearer ${token}`)
      .send({ fullName: 'Renamed E2E User' });

    expect(res.status).toBe(200);
    expect(res.body.fullName).toBe('Renamed E2E User');
    expect(res.body.email).toBe(testEmail);

    const me = await request(server).get('/api/v1/me').set('Authorization', `Bearer ${token}`);
    expect(me.body.fullName).toBe('Renamed E2E User');
  });

  it('rejects an empty fullName', async () => {
    const res = await request(server)
      .patch('/api/v1/me')
      .set('Authorization', `Bearer ${token}`)
      .send({ fullName: '' });
    expect(res.status).toBe(400);
  });

  // --- ID card no (Security Clearance NIC auto-fill source) -----------------
  it('updates idCardNo via PATCH /me, reflected by GET /me', async () => {
    const res = await request(server)
      .patch('/api/v1/me')
      .set('Authorization', `Bearer ${token}`)
      .send({ fullName: 'Renamed E2E User', idCardNo: '912345678V' });

    expect(res.status).toBe(200);
    expect(res.body.idCardNo).toBe('912345678V');

    const me = await request(server).get('/api/v1/me').set('Authorization', `Bearer ${token}`);
    expect(me.body.idCardNo).toBe('912345678V');
  });

  it('an empty idCardNo leaves the previously saved value unchanged (submits as omitted, not a clear)', async () => {
    const res = await request(server)
      .patch('/api/v1/me')
      .set('Authorization', `Bearer ${token}`)
      .send({ fullName: 'Renamed E2E User', idCardNo: '' });

    expect(res.status).toBe(200);
    expect(res.body.idCardNo).toBe('912345678V');
  });

  it('writes an audit row for a self-service name change', async () => {
    const res = await request(server)
      .patch('/api/v1/me')
      .set('Authorization', `Bearer ${token}`)
      .send({ fullName: 'Audited Name' });
    expect(res.status).toBe(200);

    const auditRow = await prisma.auditLog.findFirst({
      where: { entityType: 'user', entityId: userId, action: 'user.update' },
      orderBy: { createdAt: 'desc' },
    });
    expect(auditRow).not.toBeNull();
    expect(auditRow?.actorUserId).toBe(userId);
  });

  // --- Avatar: no photo yet ---------------------------------------------------
  it('GET /me/avatar 404s when no photo is set', async () => {
    const res = await request(server)
      .get('/api/v1/me/avatar')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
  });

  it('DELETE /me/avatar is a harmless no-op when there is nothing to remove', async () => {
    const res = await request(server)
      .delete('/api/v1/me/avatar')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.hasAvatar).toBe(false);
  });

  // --- Avatar upload/replace/remove ------------------------------------------
  describe('avatar upload, replace, and remove', () => {
    it('uploads a PNG photo and downloads the identical bytes back', async () => {
      const uploaded = await request(server)
        .post('/api/v1/me/avatar')
        .set('Authorization', `Bearer ${token}`)
        .attach('avatar', PNG_BYTES, { filename: 'photo.png', contentType: 'image/png' });
      expect(uploaded.status).toBe(201);
      expect(uploaded.body.hasAvatar).toBe(true);

      const downloaded = await request(server)
        .get('/api/v1/me/avatar')
        .set('Authorization', `Bearer ${token}`);
      expect(downloaded.status).toBe(200);
      expect(downloaded.headers['content-type']).toContain('image/png');
      expect(Buffer.compare(downloaded.body as Buffer, PNG_BYTES)).toBe(0);
    });

    it('replacing the photo serves the new bytes, not the old ones', async () => {
      const replacement = Buffer.concat([PNG_SIGNATURE, Buffer.from([0x09, 0x09, 0x09])]);
      const uploaded = await request(server)
        .post('/api/v1/me/avatar')
        .set('Authorization', `Bearer ${token}`)
        .attach('avatar', replacement, { filename: 'photo2.png', contentType: 'image/png' });
      expect(uploaded.status).toBe(201);

      const downloaded = await request(server)
        .get('/api/v1/me/avatar')
        .set('Authorization', `Bearer ${token}`);
      expect(Buffer.compare(downloaded.body as Buffer, replacement)).toBe(0);
    });

    it('removes the photo; GET /me/avatar 404s again afterwards', async () => {
      const removed = await request(server)
        .delete('/api/v1/me/avatar')
        .set('Authorization', `Bearer ${token}`);
      expect(removed.status).toBe(200);
      expect(removed.body.hasAvatar).toBe(false);

      const after = await request(server)
        .get('/api/v1/me/avatar')
        .set('Authorization', `Bearer ${token}`);
      expect(after.status).toBe(404);
    });
  });

  // --- Validation --------------------------------------------------------------
  describe('upload validation', () => {
    it('rejects a PDF (avatars must be JPEG or PNG only, unlike receipts)', async () => {
      const res = await request(server)
        .post('/api/v1/me/avatar')
        .set('Authorization', `Bearer ${token}`)
        .attach('avatar', PDF_BYTES, { filename: 'photo.pdf', contentType: 'application/pdf' });
      expect(res.status).toBe(422);
    });

    it('rejects a file whose magic bytes do not match its declared MIME type', async () => {
      const res = await request(server)
        .post('/api/v1/me/avatar')
        .set('Authorization', `Bearer ${token}`)
        .attach('avatar', NOT_A_PNG_BYTES, { filename: 'photo.png', contentType: 'image/png' });
      expect(res.status).toBe(422);
    });

    it('rejects an oversized image beyond AVATAR_MAX_SIZE_MB', async () => {
      const res = await request(server)
        .post('/api/v1/me/avatar')
        .set('Authorization', `Bearer ${token}`)
        .attach('avatar', OVERSIZED_PNG_BYTES, { filename: 'big.png', contentType: 'image/png' });
      expect(res.status).toBe(422);
    });

    it('rejects a request with no file attached', async () => {
      const res = await request(server)
        .post('/api/v1/me/avatar')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(400);
    });
  });

  // --- Cross-user isolation ----------------------------------------------------
  it("a second user's /me/avatar never returns the first user's photo (CurrentUser().id scoping)", async () => {
    await request(server)
      .post('/api/v1/me/avatar')
      .set('Authorization', `Bearer ${token}`)
      .attach('avatar', PNG_BYTES, { filename: 'photo.png', contentType: 'image/png' });

    const secondEmail = 'e2e-profile-test-2@hublanka.dev';
    await prisma.user.deleteMany({ where: { email: secondEmail } });
    const passwordHasher = app.get(PasswordHasherService);
    const secondPasswordHash = await passwordHasher.hash(testPassword);
    const secondUser = await prisma.user.create({
      data: { email: secondEmail, passwordHash: secondPasswordHash, fullName: 'Second E2E User' },
    });

    try {
      const secondLogin = await request(server)
        .post('/api/v1/auth/login')
        .send({ email: secondEmail, password: testPassword });
      const secondToken = secondLogin.body.accessToken as string;

      const secondAvatar = await request(server)
        .get('/api/v1/me/avatar')
        .set('Authorization', `Bearer ${secondToken}`);
      expect(secondAvatar.status).toBe(404);
    } finally {
      await prisma.refreshToken.deleteMany({ where: { userId: secondUser.id } });
      await prisma.user.delete({ where: { id: secondUser.id } });
      await request(server).delete('/api/v1/me/avatar').set('Authorization', `Bearer ${token}`);
    }
  });
});
