import type { Server } from 'node:http';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaService } from '../src/prisma/prisma.service';
import { colomboToday } from '../src/shipment/shipment.util';
import { createTestApp } from './utils/create-test-app';
import {
  createTestMasterData,
  deleteTestMasterData,
  type TestMasterData,
} from './utils/create-test-master-data';

const DEV_PASSWORD = 'DevPassword123!';
const RUN_ID = Date.now();

async function loginAs(server: Server, email: string): Promise<string> {
  const res = await request(server)
    .post('/api/v1/auth/login')
    .send({ email, password: DEV_PASSWORD });
  if (res.status !== 200) {
    throw new Error(`Seed user ${email} could not log in (status ${res.status})`);
  }
  return res.body.accessToken as string;
}

/** BR-06: BOX/WEIGHT entry and edit while Pending — the cargo module's sole reason to exist. */
describe('Cargo handling (e2e)', () => {
  let app: INestApplication;
  let server: Server;
  let prisma: PrismaService;
  let executiveToken: string;
  let managerToken: string;
  let directorToken: string;
  let masterData: TestMasterData;
  const createdShipmentIds: string[] = [];

  beforeAll(async () => {
    app = await createTestApp();
    server = app.getHttpServer() as Server;
    prisma = app.get(PrismaService);
    executiveToken = await loginAs(server, 'executive@hublanka.dev');
    managerToken = await loginAs(server, 'manager@hublanka.dev');
    directorToken = await loginAs(server, 'director@hublanka.dev');

    const manager = await prisma.user.findUniqueOrThrow({
      where: { email: 'manager@hublanka.dev' },
    });
    masterData = await createTestMasterData(prisma, manager.id, `cg${RUN_ID}`);
  });

  afterAll(async () => {
    await prisma.shipmentCancellationRequest.deleteMany({
      where: { shipmentId: { in: createdShipmentIds } },
    });
    // See cutoff.e2e-spec.ts: a live CutoffCronService sharing this database
    // can raise a real alert for one of these shipments mid-run.
    await prisma.cutoffAlert.deleteMany({ where: { shipmentId: { in: createdShipmentIds } } });
    await prisma.shipment.deleteMany({ where: { id: { in: createdShipmentIds } } });
    await deleteTestMasterData(prisma, masterData);
    await app.close();
  });

  async function createShipment(
    token: string,
  ): Promise<{ id: string; version: number; boxCount: number | null; weightKg: string | null }> {
    const res = await request(server)
      .post('/api/v1/shipments')
      .set('Authorization', `Bearer ${token}`)
      .send({
        airlineId: masterData.airlineId,
        shipperId: masterData.shipperId,
        consigneeId: masterData.consigneeId,
        commodityId: masterData.commodityId,
        destinationAirportId: masterData.airportId,
        flightNo: 'EK123',
        mawbNo: '176-0000-0001',
        flightDate: colomboToday(),
        depTime: '03:05',
      });
    expect(res.status).toBe(201);
    createdShipmentIds.push(res.body.id);
    return res.body as {
      id: string;
      version: number;
      boxCount: number | null;
      weightKg: string | null;
    };
  }

  it('rejects with no token', async () => {
    const res = await request(server).patch('/api/v1/shipments/does-not-matter/cargo').send({});
    expect(res.status).toBe(401);
  });

  it('Director cannot enter box/weight (no cargo.boxweight.enter)', async () => {
    const shipment = await createShipment(managerToken);
    const res = await request(server)
      .patch(`/api/v1/shipments/${shipment.id}/cargo`)
      .set('Authorization', `Bearer ${directorToken}`)
      .send({ version: 0, boxCount: 5 });
    expect(res.status).toBe(403);
  });

  it('Executive enters box and weight on a Pending shipment', async () => {
    const shipment = await createShipment(executiveToken);
    const res = await request(server)
      .patch(`/api/v1/shipments/${shipment.id}/cargo`)
      .set('Authorization', `Bearer ${executiveToken}`)
      .send({ version: 0, boxCount: 12, weightKg: '444.523' });
    expect(res.status).toBe(200);
    expect(res.body.boxCount).toBe(12);
    // decimal.js (Prisma's Decimal) strips insignificant trailing zeros on
    // toString() — the stored/computed VALUE is exact either way, this
    // just avoids picking a fixture where that would obscure the assertion.
    expect(res.body.weightKg).toBe('444.523');
    expect(res.body.version).toBe(1);
  });

  it('a stale version returns 409 with the exact confirmed message', async () => {
    const shipment = await createShipment(managerToken);
    await request(server)
      .patch(`/api/v1/shipments/${shipment.id}/cargo`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ version: 0, boxCount: 3 });

    const staleRes = await request(server)
      .patch(`/api/v1/shipments/${shipment.id}/cargo`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ version: 0, boxCount: 4 });
    expect(staleRes.status).toBe(409);
    expect(staleRes.body.error.message).toBe(
      'This shipment was updated by another user. Please review the latest information before saving.',
    );
  });

  it('is blocked once the shipment is Completed', async () => {
    const shipment = await createShipment(managerToken);
    await request(server)
      .post(`/api/v1/shipments/${shipment.id}/complete`)
      .set('Authorization', `Bearer ${managerToken}`);

    const res = await request(server)
      .patch(`/api/v1/shipments/${shipment.id}/cargo`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ version: 0, boxCount: 5 });
    expect(res.status).toBe(422);
  });

  it('is blocked once the shipment is Cancelled — stricter than the general update lock', async () => {
    const shipment = await createShipment(executiveToken);
    const requestRes = await request(server)
      .post(`/api/v1/shipments/${shipment.id}/cancellation-request`)
      .set('Authorization', `Bearer ${executiveToken}`)
      .send({ reason: 'Cargo test cancellation' });
    await request(server)
      .post(`/api/v1/shipments/cancellation-requests/${requestRes.body.id}/approve`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({});

    const res = await request(server)
      .patch(`/api/v1/shipments/${shipment.id}/cargo`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ version: 0, boxCount: 5 });
    expect(res.status).toBe(422);
  });

  it('every cargo edit writes an audit row', async () => {
    const shipment = await createShipment(managerToken);
    await request(server)
      .patch(`/api/v1/shipments/${shipment.id}/cargo`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ version: 0, boxCount: 7 });

    const auditRow = await prisma.auditLog.findFirst({
      where: { entityType: 'shipment', action: 'shipment.update', entityId: shipment.id },
    });
    expect(auditRow).not.toBeNull();
  });
});
