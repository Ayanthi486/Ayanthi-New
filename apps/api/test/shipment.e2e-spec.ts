import type { Server } from 'node:http';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaService } from '../src/prisma/prisma.service';
import { addDays, colomboToday } from '../src/shipment/shipment.util';
import { createTestApp } from './utils/create-test-app';
import {
  createTestMasterData,
  deleteTestMasterData,
  type TestMasterData,
} from './utils/create-test-master-data';

const DEV_PASSWORD = 'DevPassword123!';
const RUN_ID = Date.now();

async function loginAs(server: Server, email: string, password = DEV_PASSWORD): Promise<string> {
  const res = await request(server).post('/api/v1/auth/login').send({ email, password });
  if (res.status !== 200) {
    throw new Error(
      `Seed user ${email} could not log in (status ${res.status}) — has \`pnpm db:seed\` been run against this database?`,
    );
  }
  return res.body.accessToken as string;
}

interface TestShipment {
  id: string;
  shipmentNo: string;
  mawbNo: string | null;
  boxCount: number | null;
  weightKg: string | null;
  status: 'PENDING' | 'COMPLETED' | 'CANCELLED';
  version: number;
  depTime: string;
}

interface TestCancellationRequest {
  id: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
}

describe('Shipment core (e2e)', () => {
  let app: INestApplication;
  let server: Server;
  let prisma: PrismaService;
  let executiveToken: string;
  let managerToken: string;
  let directorToken: string;
  let masterData: TestMasterData;
  const createdShipmentIds: string[] = [];

  function payload(overrides: Record<string, unknown> = {}): Record<string, unknown> {
    return {
      airlineId: masterData.airlineId,
      shipperId: masterData.shipperId,
      consigneeId: masterData.consigneeId,
      commodityId: masterData.commodityId,
      destinationAirportId: masterData.airportId,
      flightNo: 'EK123',
      mawbNo: '176-0000-0001',
      flightDate: colomboToday(),
      depTime: '03:05',
      ...overrides,
    };
  }

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
    masterData = await createTestMasterData(prisma, manager.id, `shp${RUN_ID}`);
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
    overrides: Record<string, unknown> = {},
  ): Promise<TestShipment> {
    const res = await request(server)
      .post('/api/v1/shipments')
      .set('Authorization', `Bearer ${token}`)
      .send(payload(overrides));
    expect(res.status).toBe(201);
    const shipment = res.body as TestShipment;
    createdShipmentIds.push(shipment.id);
    return shipment;
  }

  // --- AC-03: saves with BOX/WEIGHT empty (BR-05) --------------------------
  it('AC-03: creates a shipment with box and weight omitted', async () => {
    const shipment = await createShipment(managerToken);
    expect(shipment.boxCount).toBeNull();
    expect(shipment.weightKg).toBeNull();
    expect(shipment.status).toBe('PENDING');
    expect(shipment.shipmentNo).toMatch(/^HUB \d{6}$/);
  });

  // --- AC-02: two shipments may share one MAWB (BR-03 regression guard) ----
  it('AC-02: two shipments may share one MAWB', async () => {
    const mawbNo = `176 ${RUN_ID % 10000} 0191`;
    const first = await createShipment(managerToken, { mawbNo });
    const second = await createShipment(managerToken, { mawbNo });
    expect(first.mawbNo).toBe(mawbNo);
    expect(second.mawbNo).toBe(mawbNo);
    expect(first.id).not.toBe(second.id);
  });

  // --- AC-01: concurrent creation never yields a duplicate Shipment ID -----
  it('AC-01: concurrent shipment creation never produces a duplicate Shipment ID', async () => {
    const results = await Promise.all(
      Array.from({ length: 8 }, () => createShipment(managerToken)),
    );
    const shipmentNos = results.map((r) => r.shipmentNo);
    expect(new Set(shipmentNos).size).toBe(shipmentNos.length);
  });

  // --- AC-05 / AC-06: default schedule range + search + explicit dates -----
  describe('schedule query', () => {
    it('AC-05: default list returns only today+tomorrow, sorted by DEP TIME', async () => {
      const today = colomboToday();
      const tomorrow = addDays(today, 1);
      const farFuture = addDays(today, 10);

      await createShipment(managerToken, { flightDate: today, depTime: '22:00' });
      await createShipment(managerToken, { flightDate: today, depTime: '02:00' });
      const tomorrowShipment = await createShipment(managerToken, {
        flightDate: tomorrow,
        depTime: '10:00',
      });
      const farFutureShipment = await createShipment(managerToken, {
        flightDate: farFuture,
        depTime: '10:00',
      });

      const res = await request(server)
        .get('/api/v1/shipments')
        .set('Authorization', `Bearer ${managerToken}`);

      expect(res.status).toBe(200);
      const ids = (res.body.data as { id: string }[]).map((s) => s.id);
      expect(ids).toContain(tomorrowShipment.id);
      expect(ids).not.toContain(farFutureShipment.id);

      const depTimes = (res.body.data as { depTime: string }[]).map((s) => s.depTime);
      const sorted = [...depTimes].sort();
      expect(depTimes).toEqual(sorted);
    });

    it('AC-06: search by Shipment ID returns exactly that shipment', async () => {
      const created = await createShipment(managerToken, {
        flightDate: addDays(colomboToday(), 20),
      });

      const res = await request(server)
        .get('/api/v1/shipments')
        .query({ search: created.shipmentNo, dateFrom: '2000-01-01', dateTo: '2100-01-01' })
        .set('Authorization', `Bearer ${managerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].id).toBe(created.id);
    });

    it('AC-06: explicit date-range filter returns correct results', async () => {
      const targetDate = addDays(colomboToday(), 30);
      const created = await createShipment(managerToken, { flightDate: targetDate });

      const res = await request(server)
        .get('/api/v1/shipments')
        .query({ dateFrom: targetDate, dateTo: targetDate })
        .set('Authorization', `Bearer ${managerToken}`);

      expect(res.status).toBe(200);
      const ids = (res.body.data as { id: string }[]).map((s) => s.id);
      expect(ids).toContain(created.id);
    });

    it('KPIs tie out to the returned list for the same filter', async () => {
      const targetDate = addDays(colomboToday(), 40);
      await createShipment(managerToken, { flightDate: targetDate });
      await createShipment(managerToken, { flightDate: targetDate });

      const res = await request(server)
        .get('/api/v1/shipments')
        .query({ dateFrom: targetDate, dateTo: targetDate })
        .set('Authorization', `Bearer ${managerToken}`);

      expect(res.body.kpis.total).toBe(res.body.data.length);
      expect(res.body.kpis.pending + res.body.kpis.completed + res.body.kpis.cancelled).toBe(
        res.body.kpis.total,
      );
    });
  });

  // --- Permission-denied per mutating endpoint (DEVELOPMENT_RULES §8) ------
  describe('permission enforcement', () => {
    it('rejects create with no token', async () => {
      const res = await request(server).post('/api/v1/shipments').send(payload());
      expect(res.status).toBe(401);
    });

    it('Director cannot update a shipment (no shipment.update)', async () => {
      const shipment = await createShipment(managerToken);
      const res = await request(server)
        .patch(`/api/v1/shipments/${shipment.id}`)
        .set('Authorization', `Bearer ${directorToken}`)
        .send({ version: 0, houseAwbNo: 'HL 9999' });
      expect(res.status).toBe(403);
    });

    it('Executive cannot delete (no shipment.delete.own)', async () => {
      const shipment = await createShipment(executiveToken);
      const res = await request(server)
        .delete(`/api/v1/shipments/${shipment.id}`)
        .set('Authorization', `Bearer ${executiveToken}`);
      expect(res.status).toBe(403);
    });

    it('Director cannot request cancellation (no shipment.cancellation.request)', async () => {
      const shipment = await createShipment(managerToken);
      const res = await request(server)
        .post(`/api/v1/shipments/${shipment.id}/cancellation-request`)
        .set('Authorization', `Bearer ${directorToken}`)
        .send({ reason: 'Customer changed plans' });
      expect(res.status).toBe(403);
    });

    it('Executive cannot approve a cancellation request (no shipment.cancellation.approve)', async () => {
      const res = await request(server)
        .get('/api/v1/shipments/cancellation-requests')
        .set('Authorization', `Bearer ${executiveToken}`);
      expect(res.status).toBe(403);
    });

    it('Executive cannot complete a shipment (no shipment.completion.approve)', async () => {
      const shipment = await createShipment(managerToken);
      const res = await request(server)
        .post(`/api/v1/shipments/${shipment.id}/complete`)
        .set('Authorization', `Bearer ${executiveToken}`);
      expect(res.status).toBe(403);
    });
  });

  // --- AC-10: cancellation requires a reason and Manager approval -----------
  describe('cancellation workflow', () => {
    it('AC-10: a cancellation request without a reason is rejected', async () => {
      const shipment = await createShipment(managerToken);
      const res = await request(server)
        .post(`/api/v1/shipments/${shipment.id}/cancellation-request`)
        .set('Authorization', `Bearer ${executiveToken}`)
        .send({ reason: '' });
      expect(res.status).toBe(400);
    });

    it('Executive requests, Manager approves, shipment becomes Cancelled', async () => {
      const shipment = await createShipment(executiveToken);

      const requestRes = await request(server)
        .post(`/api/v1/shipments/${shipment.id}/cancellation-request`)
        .set('Authorization', `Bearer ${executiveToken}`)
        .send({ reason: 'Customer cancelled the booking' });
      expect(requestRes.status).toBe(201);
      expect(requestRes.body.status).toBe('PENDING');
      const cancellationRequest = requestRes.body as TestCancellationRequest;

      const approveRes = await request(server)
        .post(`/api/v1/shipments/cancellation-requests/${cancellationRequest.id}/approve`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({});
      expect(approveRes.status).toBe(201);
      expect(approveRes.body.status).toBe('APPROVED');

      const getRes = await request(server)
        .get(`/api/v1/shipments/${shipment.id}`)
        .set('Authorization', `Bearer ${managerToken}`);
      expect(getRes.body.status).toBe('CANCELLED');
    });

    it('a rejected cancellation request leaves the shipment Pending and re-requestable', async () => {
      const shipment = await createShipment(executiveToken);

      const requestRes = await request(server)
        .post(`/api/v1/shipments/${shipment.id}/cancellation-request`)
        .set('Authorization', `Bearer ${executiveToken}`)
        .send({ reason: 'Testing rejection path' });
      const cancellationRequest = requestRes.body as TestCancellationRequest;

      const rejectRes = await request(server)
        .post(`/api/v1/shipments/cancellation-requests/${cancellationRequest.id}/reject`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ note: 'Not a valid reason' });
      expect(rejectRes.status).toBe(201);
      expect(rejectRes.body.status).toBe('REJECTED');

      const getRes = await request(server)
        .get(`/api/v1/shipments/${shipment.id}`)
        .set('Authorization', `Bearer ${managerToken}`);
      expect(getRes.body.status).toBe('PENDING');

      const secondRequestRes = await request(server)
        .post(`/api/v1/shipments/${shipment.id}/cancellation-request`)
        .set('Authorization', `Bearer ${executiveToken}`)
        .send({ reason: 'Second attempt' });
      expect(secondRequestRes.status).toBe(201);
    });
  });

  // --- AC-11: Manager delete ownership boundaries (BR-46/47/48) ------------
  describe('delete ownership boundaries', () => {
    let secondManagerToken: string;

    beforeAll(async () => {
      const managerRoleRes = await request(server)
        .get('/api/v1/roles')
        .set('Authorization', `Bearer ${managerToken}`);
      const managerRoleId = (managerRoleRes.body as { id: string; name: string }[]).find(
        (r) => r.name === 'Manager',
      )?.id;

      const email = `e2e-second-manager-${RUN_ID}@hublanka.dev`;
      await request(server)
        .post('/api/v1/users')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          email,
          password: 'SecondManagerPass1!',
          fullName: 'E2E Second Manager',
          roleIds: [managerRoleId],
        });

      secondManagerToken = await loginAs(server, email, 'SecondManagerPass1!');
    });

    afterAll(async () => {
      await prisma.user.deleteMany({
        where: { email: `e2e-second-manager-${RUN_ID}@hublanka.dev` },
      });
    });

    it("AC-11: a Manager cannot delete another Manager's shipment", async () => {
      const shipment = await createShipment(managerToken);
      const res = await request(server)
        .delete(`/api/v1/shipments/${shipment.id}`)
        .set('Authorization', `Bearer ${secondManagerToken}`);
      expect(res.status).toBe(403);
    });

    it("AC-11: a Manager cannot delete an Executive's shipment", async () => {
      const shipment = await createShipment(executiveToken);
      const res = await request(server)
        .delete(`/api/v1/shipments/${shipment.id}`)
        .set('Authorization', `Bearer ${managerToken}`);
      expect(res.status).toBe(403);
    });

    it("AC-11: a Manager cannot delete a Director's shipment", async () => {
      const shipment = await createShipment(directorToken);
      const res = await request(server)
        .delete(`/api/v1/shipments/${shipment.id}`)
        .set('Authorization', `Bearer ${managerToken}`);
      expect(res.status).toBe(403);
    });

    it('a Manager can delete their own non-Completed shipment', async () => {
      const shipment = await createShipment(managerToken);
      const res = await request(server)
        .delete(`/api/v1/shipments/${shipment.id}`)
        .set('Authorization', `Bearer ${managerToken}`);
      expect(res.status).toBe(200);
    });
  });

  // --- AC-12: Completed shipments are locked (BR-10/BR-49) -----------------
  describe('Completed locking', () => {
    it('AC-12: PATCH on a Completed shipment returns 423', async () => {
      const shipment = await createShipment(managerToken);
      const completeRes = await request(server)
        .post(`/api/v1/shipments/${shipment.id}/complete`)
        .set('Authorization', `Bearer ${managerToken}`);
      expect(completeRes.status).toBe(201);
      expect(completeRes.body.status).toBe('COMPLETED');

      const patchRes = await request(server)
        .patch(`/api/v1/shipments/${shipment.id}`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ version: 0, houseAwbNo: 'HL 0001' });
      expect(patchRes.status).toBe(423);
    });

    it('AC-12: DELETE on a Completed shipment returns 423', async () => {
      const shipment = await createShipment(managerToken);
      await request(server)
        .post(`/api/v1/shipments/${shipment.id}/complete`)
        .set('Authorization', `Bearer ${managerToken}`);

      const deleteRes = await request(server)
        .delete(`/api/v1/shipments/${shipment.id}`)
        .set('Authorization', `Bearer ${managerToken}`);
      expect(deleteRes.status).toBe(423);
    });
  });

  // --- BR-12: a Cancelled record is retained, not reopened for editing -----
  describe('Cancelled locking', () => {
    it('PATCH on a Cancelled shipment returns 423', async () => {
      const shipment = await createShipment(executiveToken);
      const requestRes = await request(server)
        .post(`/api/v1/shipments/${shipment.id}/cancellation-request`)
        .set('Authorization', `Bearer ${executiveToken}`)
        .send({ reason: 'Regression coverage for BR-12 lock' });
      const cancellationRequest = requestRes.body as TestCancellationRequest;

      await request(server)
        .post(`/api/v1/shipments/cancellation-requests/${cancellationRequest.id}/approve`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({});

      const patchRes = await request(server)
        .patch(`/api/v1/shipments/${shipment.id}`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ version: 0, houseAwbNo: 'HL 0001' });
      expect(patchRes.status).toBe(423);
    });
  });

  // --- Optimistic concurrency (ARCHITECTURE §20) ----------------------------
  it('a stale version on PATCH returns 409 with the exact confirmed message', async () => {
    const shipment = await createShipment(managerToken);

    const firstEdit = await request(server)
      .patch(`/api/v1/shipments/${shipment.id}`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ version: 0, houseAwbNo: 'HL 0100' });
    expect(firstEdit.status).toBe(200);
    expect(firstEdit.body.version).toBe(1);

    const staleEdit = await request(server)
      .patch(`/api/v1/shipments/${shipment.id}`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ version: 0, houseAwbNo: 'HL 0200' });
    expect(staleEdit.status).toBe(409);
    expect(staleEdit.body.error.message).toBe(
      'This shipment was updated by another user. Please review the latest information before saving.',
    );
  });

  // --- Audit (PRD §11) -------------------------------------------------------
  it('every mutating action writes an audit row inside the same transaction', async () => {
    const shipment = await createShipment(managerToken);

    const auditRow = await prisma.auditLog.findFirst({
      where: { entityType: 'shipment', action: 'shipment.create', entityId: shipment.id },
    });
    expect(auditRow).not.toBeNull();
    expect(auditRow?.actorUserId).not.toBeNull();
  });
});
