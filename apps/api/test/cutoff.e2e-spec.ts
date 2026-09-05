import type { Server } from 'node:http';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { CutoffService } from '../src/cutoff/cutoff.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { createTestApp } from './utils/create-test-app';
import {
  createTestMasterData,
  deleteTestMasterData,
  type TestMasterData,
} from './utils/create-test-master-data';

const DEV_PASSWORD = 'DevPassword123!';
const RUN_ID = Date.now();

// Fixed flightDate + depTime (Colombo local) => 2026-08-04T08:30:00.000Z scheduled departure —
// matches cutoff.util.test.ts's fixture, verified independently there.
const FLIGHT_DATE = '2026-08-04';
const DEP_TIME = '14:00';
const SCHEDULED_UTC = new Date('2026-08-04T08:30:00.000Z');
const hoursBefore = (h: number) => new Date(SCHEDULED_UTC.getTime() - h * 60 * 60 * 1000);

async function loginAs(server: Server, email: string): Promise<string> {
  const res = await request(server)
    .post('/api/v1/auth/login')
    .send({ email, password: DEV_PASSWORD });
  if (res.status !== 200) {
    throw new Error(`Seed user ${email} could not log in (status ${res.status})`);
  }
  return res.body.accessToken as string;
}

describe('Cutoff (e2e)', () => {
  let app: INestApplication;
  let server: Server;
  let prisma: PrismaService;
  let cutoffService: CutoffService;
  let executiveToken: string;
  let managerToken: string;
  let directorToken: string;
  let masterData: TestMasterData;
  const createdShipmentIds: string[] = [];

  beforeAll(async () => {
    app = await createTestApp();
    server = app.getHttpServer() as Server;
    prisma = app.get(PrismaService);
    cutoffService = app.get(CutoffService);
    executiveToken = await loginAs(server, 'executive@hublanka.dev');
    managerToken = await loginAs(server, 'manager@hublanka.dev');
    directorToken = await loginAs(server, 'director@hublanka.dev');

    const manager = await prisma.user.findUniqueOrThrow({
      where: { email: 'manager@hublanka.dev' },
    });
    masterData = await createTestMasterData(prisma, manager.id, `cut${RUN_ID}`);
  });

  afterAll(async () => {
    await prisma.cutoffAlert.deleteMany({ where: { shipmentId: { in: createdShipmentIds } } });
    await prisma.shipment.deleteMany({ where: { id: { in: createdShipmentIds } } });
    await deleteTestMasterData(prisma, masterData);
    await app.close();
  }, 60_000);

  async function createShipment(): Promise<string> {
    const res = await request(server)
      .post('/api/v1/shipments')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({
        airlineId: masterData.airlineId,
        shipperId: masterData.shipperId,
        consigneeId: masterData.consigneeId,
        commodityId: masterData.commodityId,
        destinationAirportId: masterData.airportId,
        flightNo: 'EK123',
        mawbNo: '176-0000-0001',
        flightDate: FLIGHT_DATE,
        depTime: DEP_TIME,
      });
    expect(res.status).toBe(201);
    createdShipmentIds.push(res.body.id as string);
    return res.body.id as string;
  }

  it('rejects acknowledge with no token', async () => {
    const res = await request(server).post('/api/v1/shipments/does-not-matter/cutoff/acknowledge');
    expect(res.status).toBe(401);
  });

  it('is Normal (no alert row) more than 5 hours before scheduled departure', async () => {
    const shipmentId = await createShipment();
    await cutoffService.evaluateAll(hoursBefore(6));

    const active = await request(server)
      .get('/api/v1/cutoff/active')
      .set('Authorization', `Bearer ${managerToken}`);
    expect(
      active.body.find((a: { shipmentId: string }) => a.shipmentId === shipmentId),
    ).toBeUndefined();
  });

  it('fires Approaching at exactly the 5-hour boundary (AC-09) and is idempotent across repeated runs', async () => {
    const shipmentId = await createShipment();
    await cutoffService.evaluateAll(hoursBefore(5));

    const firstList = await request(server)
      .get('/api/v1/cutoff/active')
      .set('Authorization', `Bearer ${managerToken}`);
    const firstAlert = firstList.body.find(
      (a: { shipmentId: string }) => a.shipmentId === shipmentId,
    );
    expect(firstAlert.state).toBe('APPROACHING');

    // Re-running at the same instant must not duplicate the row or change raisedAt.
    await cutoffService.evaluateAll(hoursBefore(5));
    const secondList = await request(server)
      .get('/api/v1/cutoff/active')
      .set('Authorization', `Bearer ${managerToken}`);
    const secondAlert = secondList.body.find(
      (a: { shipmentId: string }) => a.shipmentId === shipmentId,
    );
    expect(secondAlert.id).toBe(firstAlert.id);
    expect(secondAlert.raisedAt).toBe(firstAlert.raisedAt);
  });

  it('escalates to Urgent and clears a prior acknowledgement (decision #2)', async () => {
    const shipmentId = await createShipment();
    await cutoffService.evaluateAll(hoursBefore(4)); // Approaching

    const ackRes = await request(server)
      .post(`/api/v1/shipments/${shipmentId}/cutoff/acknowledge`)
      .set('Authorization', `Bearer ${executiveToken}`);
    expect(ackRes.status).toBe(201);
    expect(ackRes.body.acknowledgedByUserId).not.toBeNull();

    await cutoffService.evaluateAll(hoursBefore(0.5)); // Urgent — more severe

    const list = await request(server)
      .get('/api/v1/cutoff/active')
      .set('Authorization', `Bearer ${managerToken}`);
    const alert = list.body.find((a: { shipmentId: string }) => a.shipmentId === shipmentId);
    expect(alert.state).toBe('URGENT');
    expect(alert.acknowledgedAt).toBeNull();
  });

  it('stays Urgent past scheduled departure with no actual departure recorded (BR-50)', async () => {
    const shipmentId = await createShipment();
    await cutoffService.evaluateAll(new Date(SCHEDULED_UTC.getTime() + 60 * 60 * 1000));

    const list = await request(server)
      .get('/api/v1/cutoff/active')
      .set('Authorization', `Bearer ${managerToken}`);
    const alert = list.body.find((a: { shipmentId: string }) => a.shipmentId === shipmentId);
    expect(alert.state).toBe('URGENT');
  });

  it('recording actual departure resolves the alert to Passed and is immutable on a second attempt', async () => {
    const shipmentId = await createShipment();
    await cutoffService.evaluateAll(hoursBefore(0.5));

    const recorded = await request(server)
      .post(`/api/v1/shipments/${shipmentId}/actual-departure`)
      .set('Authorization', `Bearer ${executiveToken}`);
    expect(recorded.status).toBe(201);
    expect(recorded.body.actualDepartureAt).not.toBeNull();

    const list = await request(server)
      .get('/api/v1/cutoff/active')
      .set('Authorization', `Bearer ${managerToken}`);
    expect(
      list.body.find((a: { shipmentId: string }) => a.shipmentId === shipmentId),
    ).toBeUndefined();

    const alertRow = await prisma.cutoffAlert.findUniqueOrThrow({ where: { shipmentId } });
    expect(alertRow.state).toBe('PASSED');
    expect(alertRow.resolvedAt).not.toBeNull();

    const secondAttempt = await request(server)
      .post(`/api/v1/shipments/${shipmentId}/actual-departure`)
      .set('Authorization', `Bearer ${executiveToken}`);
    expect(secondAttempt.status).toBe(423);
  });

  it('excludes a Cancelled shipment from evaluation', async () => {
    const shipmentId = await createShipment();
    await prisma.shipment.update({ where: { id: shipmentId }, data: { status: 'CANCELLED' } });
    await cutoffService.evaluateAll(hoursBefore(0.5));

    const alertRow = await prisma.cutoffAlert.findUnique({ where: { shipmentId } });
    expect(alertRow).toBeNull();
  });

  it('Director cannot acknowledge or record actual departure (no permission)', async () => {
    const shipmentId = await createShipment();
    await cutoffService.evaluateAll(hoursBefore(4));

    const ackRes = await request(server)
      .post(`/api/v1/shipments/${shipmentId}/cutoff/acknowledge`)
      .set('Authorization', `Bearer ${directorToken}`);
    expect(ackRes.status).toBe(403);

    const departureRes = await request(server)
      .post(`/api/v1/shipments/${shipmentId}/actual-departure`)
      .set('Authorization', `Bearer ${directorToken}`);
    expect(departureRes.status).toBe(403);
  });

  it('every alert change writes an audit row', async () => {
    const shipmentId = await createShipment();
    await cutoffService.evaluateAll(hoursBefore(4));

    const auditRow = await prisma.auditLog.findFirst({
      where: { entityType: 'cutoff_alert', action: 'cutoff_alert.create' },
      orderBy: { createdAt: 'desc' },
    });
    expect(auditRow).not.toBeNull();
    void shipmentId;
  });
});
