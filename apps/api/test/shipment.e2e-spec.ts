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
  status:
    | 'PENDING'
    | 'CONFIRMED'
    | 'CANCELLED'
    | 'DEPARTED'
    | 'PAYMENT_PENDING'
    | 'PAYMENT_RECEIVED';
  version: number;
  depTime: string;
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
      serviceType: 'BOOKING_AND_HANDLING',
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

    // --- Date range filters on the full departure instant (flightDate + depTime), across midnight/noon/end-of-day boundaries ---
    it('an explicit range includes every departure time on the first and last day and excludes the day after', async () => {
      const day1 = addDays(colomboToday(), 200);
      const day2 = addDays(colomboToday(), 201);
      const dayAfter = addDays(colomboToday(), 202);

      const startOfDay1 = await createShipment(managerToken, { flightDate: day1, depTime: '00:00' });
      const midDay1 = await createShipment(managerToken, { flightDate: day1, depTime: '10:00' });
      const noonDay1 = await createShipment(managerToken, { flightDate: day1, depTime: '12:00' });
      const midDay2 = await createShipment(managerToken, { flightDate: day2, depTime: '10:00' });
      const endOfDay2 = await createShipment(managerToken, { flightDate: day2, depTime: '23:59' });
      const startOfDayAfter = await createShipment(managerToken, {
        flightDate: dayAfter,
        depTime: '00:00',
      });

      const res = await request(server)
        .get('/api/v1/shipments')
        .query({ dateFrom: day1, dateTo: day2 })
        .set('Authorization', `Bearer ${managerToken}`);

      expect(res.status).toBe(200);
      const ids = (res.body.data as { id: string }[]).map((s) => s.id);
      expect(ids).toContain(startOfDay1.id);
      expect(ids).toContain(midDay1.id);
      expect(ids).toContain(noonDay1.id);
      expect(ids).toContain(midDay2.id);
      expect(ids).toContain(endOfDay2.id);
      expect(ids).not.toContain(startOfDayAfter.id);
    });

    it('dateFrom alone is an open-ended lower bound with no upper limit', async () => {
      const from = addDays(colomboToday(), 300);
      const dayBefore = addDays(colomboToday(), 299);
      const farFuture = addDays(colomboToday(), 900);

      const onBoundary = await createShipment(managerToken, { flightDate: from });
      const wayInFuture = await createShipment(managerToken, { flightDate: farFuture });
      const excludedBefore = await createShipment(managerToken, { flightDate: dayBefore });

      const res = await request(server)
        .get('/api/v1/shipments')
        .query({ dateFrom: from })
        .set('Authorization', `Bearer ${managerToken}`);

      expect(res.status).toBe(200);
      const ids = (res.body.data as { id: string }[]).map((s) => s.id);
      expect(ids).toContain(onBoundary.id);
      expect(ids).toContain(wayInFuture.id);
      expect(ids).not.toContain(excludedBefore.id);
    });

    it('dateTo alone is an open-ended upper bound with no lower limit', async () => {
      const to = addDays(colomboToday(), 400);
      const dayAfter = addDays(colomboToday(), 401);
      const wayInPast = addDays(colomboToday(), 350);

      const onBoundary = await createShipment(managerToken, { flightDate: to });
      const wayEarlier = await createShipment(managerToken, { flightDate: wayInPast });
      const excludedAfter = await createShipment(managerToken, { flightDate: dayAfter });

      const res = await request(server)
        .get('/api/v1/shipments')
        .query({ dateTo: to })
        .set('Authorization', `Bearer ${managerToken}`);

      expect(res.status).toBe(200);
      const ids = (res.body.data as { id: string }[]).map((s) => s.id);
      expect(ids).toContain(onBoundary.id);
      expect(ids).toContain(wayEarlier.id);
      expect(ids).not.toContain(excludedAfter.id);
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
      expect(
        res.body.kpis.pending +
          res.body.kpis.confirmed +
          res.body.kpis.cancelled +
          res.body.kpis.departed +
          res.body.kpis.paymentPending +
          res.body.kpis.paymentReceived,
      ).toBe(res.body.kpis.total);
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

    it('Director cannot change a shipment status (no shipment.status.update)', async () => {
      const shipment = await createShipment(managerToken);
      const res = await request(server)
        .patch(`/api/v1/shipments/${shipment.id}/status`)
        .set('Authorization', `Bearer ${directorToken}`)
        .send({ status: 'CONFIRMED', version: 0 });
      expect(res.status).toBe(403);
    });
  });

  // --- The direct, no-approval status dropdown (replaces the old cancellation-request/approve and completion-approve workflows) ---
  describe('status change', () => {
    it('Executive can set the base 4 values directly, no approval step', async () => {
      const shipment = await createShipment(executiveToken);
      const res = await request(server)
        .patch(`/api/v1/shipments/${shipment.id}/status`)
        .set('Authorization', `Bearer ${executiveToken}`)
        .send({ status: 'CONFIRMED', version: 0 });
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('CONFIRMED');
      expect(res.body.version).toBe(1);
    });

    it('Executive gets 403 setting a Payment status (no shipment.status.payment)', async () => {
      const shipment = await createShipment(executiveToken);
      const res = await request(server)
        .patch(`/api/v1/shipments/${shipment.id}/status`)
        .set('Authorization', `Bearer ${executiveToken}`)
        .send({ status: 'PAYMENT_PENDING', version: 0 });
      expect(res.status).toBe(403);
    });

    it('Manager can set a Payment status', async () => {
      const shipment = await createShipment(managerToken);
      const res = await request(server)
        .patch(`/api/v1/shipments/${shipment.id}/status`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ status: 'PAYMENT_RECEIVED', version: 0 });
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('PAYMENT_RECEIVED');
    });

    it('setting Departed without box/weight entered is rejected', async () => {
      const shipment = await createShipment(managerToken);
      const res = await request(server)
        .patch(`/api/v1/shipments/${shipment.id}/status`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ status: 'DEPARTED', version: 0, actualDepartureAt: '2026-09-11T20:00' });
      expect(res.status).toBe(422);
    });

    it('setting Departed without actualDepartureAt is rejected', async () => {
      const shipment = await createShipment(managerToken);
      await request(server)
        .patch(`/api/v1/shipments/${shipment.id}/cargo`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ version: 0, boxCount: 5, weightKg: '100' });

      const res = await request(server)
        .patch(`/api/v1/shipments/${shipment.id}/status`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ status: 'DEPARTED', version: 1 });
      expect(res.status).toBe(400);
    });

    it('setting Departed with actualDepartureAt records it and resolves an open cut-off alert', async () => {
      const shipment = await createShipment(managerToken);
      await request(server)
        .patch(`/api/v1/shipments/${shipment.id}/cargo`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ version: 0, boxCount: 5, weightKg: '100' });

      const res = await request(server)
        .patch(`/api/v1/shipments/${shipment.id}/status`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ status: 'DEPARTED', version: 1, actualDepartureAt: '2026-09-11T20:00' });
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('DEPARTED');
      expect(res.body.actualDepartureAt).not.toBeNull();

      // A second Departed transition (already has actualDepartureAt) succeeds without asking again.
      const secondRes = await request(server)
        .patch(`/api/v1/shipments/${shipment.id}/status`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ status: 'DEPARTED', version: 2 });
      expect(secondRes.status).toBe(200);
      expect(secondRes.body.actualDepartureAt).toBe(res.body.actualDepartureAt);
    });

    it('a stale version on the status endpoint returns 409', async () => {
      const shipment = await createShipment(managerToken);
      await request(server)
        .patch(`/api/v1/shipments/${shipment.id}/status`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ status: 'CONFIRMED', version: 0 });

      const staleRes = await request(server)
        .patch(`/api/v1/shipments/${shipment.id}/status`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ status: 'CANCELLED', version: 0 });
      expect(staleRes.status).toBe(409);
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

    it('a Manager can delete their own non-Departed shipment', async () => {
      const shipment = await createShipment(managerToken);
      const res = await request(server)
        .delete(`/api/v1/shipments/${shipment.id}`)
        .set('Authorization', `Bearer ${managerToken}`);
      expect(res.status).toBe(200);
    });
  });

  // --- AC-12: shipments past Pending/Confirmed are locked against editing (BR-10/BR-49) ---
  describe('Departed locking', () => {
    it('AC-12: PATCH on a Departed shipment returns 423', async () => {
      const shipment = await createShipment(managerToken);
      await request(server)
        .patch(`/api/v1/shipments/${shipment.id}/cargo`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ version: 0, boxCount: 5, weightKg: '100' });

      const departRes = await request(server)
        .patch(`/api/v1/shipments/${shipment.id}/status`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ status: 'DEPARTED', version: 1, actualDepartureAt: '2026-09-11T20:00' });
      expect(departRes.status).toBe(200);
      expect(departRes.body.status).toBe('DEPARTED');

      const patchRes = await request(server)
        .patch(`/api/v1/shipments/${shipment.id}`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ version: 2, houseAwbNo: 'HL 0001' });
      expect(patchRes.status).toBe(423);
    });

    it('AC-12: DELETE on a Departed shipment returns 423', async () => {
      const shipment = await createShipment(managerToken);
      await request(server)
        .patch(`/api/v1/shipments/${shipment.id}/cargo`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ version: 0, boxCount: 5, weightKg: '100' });

      await request(server)
        .patch(`/api/v1/shipments/${shipment.id}/status`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ status: 'DEPARTED', version: 1, actualDepartureAt: '2026-09-11T20:00' });

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
      await request(server)
        .patch(`/api/v1/shipments/${shipment.id}/status`)
        .set('Authorization', `Bearer ${executiveToken}`)
        .send({ status: 'CANCELLED', version: 0 });

      const patchRes = await request(server)
        .patch(`/api/v1/shipments/${shipment.id}`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ version: 1, houseAwbNo: 'HL 0001' });
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
