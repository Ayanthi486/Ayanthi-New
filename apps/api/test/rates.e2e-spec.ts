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

async function loginAs(server: Server, email: string): Promise<string> {
  const res = await request(server)
    .post('/api/v1/auth/login')
    .send({ email, password: DEV_PASSWORD });
  if (res.status !== 200) {
    throw new Error(`Seed user ${email} could not log in (status ${res.status})`);
  }
  return res.body.accessToken as string;
}

describe('Rate Table (e2e)', () => {
  let app: INestApplication;
  let server: Server;
  let prisma: PrismaService;
  let executiveToken: string;
  let managerToken: string;
  let masterData: TestMasterData;
  const createdShipmentIds: string[] = [];
  // Ad-hoc airlines created by individual tests below (each test needs its
  // own airline so rate periods don't interfere with each other) — deleted
  // in afterAll, after shipments, to satisfy the FK.
  const createdAirlineIds: string[] = [];

  beforeAll(async () => {
    app = await createTestApp();
    server = app.getHttpServer() as Server;
    prisma = app.get(PrismaService);
    executiveToken = await loginAs(server, 'executive@hublanka.dev');
    managerToken = await loginAs(server, 'manager@hublanka.dev');

    const manager = await prisma.user.findUniqueOrThrow({
      where: { email: 'manager@hublanka.dev' },
    });
    masterData = await createTestMasterData(prisma, manager.id, `rt${RUN_ID}`);
  });

  afterAll(async () => {
    // See cutoff.e2e-spec.ts: a live CutoffCronService sharing this database
    // can raise a real alert for one of these shipments mid-run.
    await prisma.cutoffAlert.deleteMany({ where: { shipmentId: { in: createdShipmentIds } } });
    await prisma.shipment.deleteMany({ where: { id: { in: createdShipmentIds } } });
    await prisma.rateTable.deleteMany({ where: { airlineId: { in: createdAirlineIds } } });
    await prisma.airline.deleteMany({ where: { id: { in: createdAirlineIds } } });
    await deleteTestMasterData(prisma, masterData);
    await app.close();
  });

  async function createAdHocAirline(name: string): Promise<string> {
    const airline = await prisma.airline.create({ data: { name } });
    createdAirlineIds.push(airline.id);
    return airline.id;
  }

  async function createShipment(
    airlineId: string = masterData.airlineId,
  ): Promise<{ id: string; appliedBuyingRate: string | null }> {
    const res = await request(server)
      .post('/api/v1/shipments')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({
        airlineId,
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
    return res.body as { id: string; appliedBuyingRate: string | null };
  }

  it('rejects rate creation with no token', async () => {
    const res = await request(server).post('/api/v1/rates').send({});
    expect(res.status).toBe(401);
  });

  it('Executive cannot manage the Rate Table (no rate.table.manage)', async () => {
    const res = await request(server)
      .post('/api/v1/rates')
      .set('Authorization', `Bearer ${executiveToken}`)
      .send({
        airlineId: masterData.airlineId,
        rateUsdPerKg: '4.75',
        effectiveFrom: colomboToday(),
      });
    expect(res.status).toBe(403);
  });

  it('Executive cannot capture a buying rate onto a shipment (no rate.buying.enter)', async () => {
    const shipment = await createShipment();
    const res = await request(server)
      .post(`/api/v1/shipments/${shipment.id}/buying-rate`)
      .set('Authorization', `Bearer ${executiveToken}`);
    expect(res.status).toBe(403);
  });

  it('capturing a buying rate with no configured rate is a business-rule error', async () => {
    const airlineId = await createAdHocAirline(`E2E No-Rate Airline ${RUN_ID}`);
    const shipment = await createShipment(airlineId);

    const res = await request(server)
      .post(`/api/v1/shipments/${shipment.id}/buying-rate`)
      .set('Authorization', `Bearer ${managerToken}`);
    expect(res.status).toBe(422);
  });

  it('Manager creates a rate period and captures it onto a Pending shipment', async () => {
    const airlineId = await createAdHocAirline(`E2E Capture Airline ${RUN_ID}`);

    const createRateRes = await request(server)
      .post('/api/v1/rates')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ airlineId, rateUsdPerKg: '4.75', effectiveFrom: colomboToday() });
    expect(createRateRes.status).toBe(201);
    expect(createRateRes.body.effectiveTo).toBeNull();

    const shipment = await createShipment(airlineId);
    const captureRes = await request(server)
      .post(`/api/v1/shipments/${shipment.id}/buying-rate`)
      .set('Authorization', `Bearer ${managerToken}`);
    expect(captureRes.status).toBe(201);
    expect(captureRes.body.appliedBuyingRate).toBe('4.75');
    expect(captureRes.body.appliedBuyingRateId).toBe(createRateRes.body.id);
  });

  // --- AC-14: a later rate change never rewrites a shipment's already-applied rate ---
  it("AC-14: changing this week's rate does not change a previous shipment's applied rate", async () => {
    const airlineId = await createAdHocAirline(`E2E AC14 Airline ${RUN_ID}`);

    const weekOneRateRes = await request(server)
      .post('/api/v1/rates')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ airlineId, rateUsdPerKg: '4.15', effectiveFrom: addDays(colomboToday(), -14) });
    expect(weekOneRateRes.status).toBe(201);

    const shipment = await createShipment(airlineId);
    const captureRes = await request(server)
      .post(`/api/v1/shipments/${shipment.id}/buying-rate`)
      .set('Authorization', `Bearer ${managerToken}`);
    expect(captureRes.status).toBe(201);
    expect(captureRes.body.appliedBuyingRate).toBe('4.15');

    // The current week's rate changes for the same airline...
    const weekTwoRateRes = await request(server)
      .post('/api/v1/rates')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ airlineId, rateUsdPerKg: '5.55', effectiveFrom: colomboToday() });
    expect(weekTwoRateRes.status).toBe(201);

    // ...but the earlier shipment's already-applied rate must be unchanged.
    const getRes = await request(server)
      .get(`/api/v1/shipments/${shipment.id}`)
      .set('Authorization', `Bearer ${managerToken}`);
    expect(getRes.body.appliedBuyingRate).toBe('4.15');

    // A brand-new shipment created now resolves the new rate, not the old one.
    const newShipment = await createShipment(airlineId);
    const newCaptureRes = await request(server)
      .post(`/api/v1/shipments/${newShipment.id}/buying-rate`)
      .set('Authorization', `Bearer ${managerToken}`);
    expect(newCaptureRes.body.appliedBuyingRate).toBe('5.55');
  });

  it("creating a new rate period auto-closes the airline's previously open period", async () => {
    const airlineId = await createAdHocAirline(`E2E AutoClose Airline ${RUN_ID}`);

    const firstRateRes = await request(server)
      .post('/api/v1/rates')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ airlineId, rateUsdPerKg: '3.00', effectiveFrom: addDays(colomboToday(), -7) });
    expect(firstRateRes.body.effectiveTo).toBeNull();

    await request(server)
      .post('/api/v1/rates')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ airlineId, rateUsdPerKg: '3.50', effectiveFrom: colomboToday() });

    const listRes = await request(server)
      .get('/api/v1/rates')
      .query({ airlineId })
      .set('Authorization', `Bearer ${managerToken}`);

    const firstPeriod = (listRes.body as { id: string; effectiveTo: string | null }[]).find(
      (r) => r.id === firstRateRes.body.id,
    );
    expect(firstPeriod?.effectiveTo).toBe(addDays(colomboToday(), -1));
  });

  it("rejects a new period starting on or before the airline's currently open period", async () => {
    const airlineId = await createAdHocAirline(`E2E Overlap Airline ${RUN_ID}`);
    await request(server)
      .post('/api/v1/rates')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ airlineId, rateUsdPerKg: '3.00', effectiveFrom: colomboToday() });

    const res = await request(server)
      .post('/api/v1/rates')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ airlineId, rateUsdPerKg: '3.50', effectiveFrom: colomboToday() });
    expect(res.status).toBe(422);
  });

  it('the buying rate can only be captured while the shipment is Pending', async () => {
    const airlineId = await createAdHocAirline(`E2E PendingOnly Airline ${RUN_ID}`);
    await request(server)
      .post('/api/v1/rates')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ airlineId, rateUsdPerKg: '4.75', effectiveFrom: colomboToday() });

    const shipment = await createShipment(airlineId);
    await request(server)
      .post(`/api/v1/shipments/${shipment.id}/complete`)
      .set('Authorization', `Bearer ${managerToken}`);

    const res = await request(server)
      .post(`/api/v1/shipments/${shipment.id}/buying-rate`)
      .set('Authorization', `Bearer ${managerToken}`);
    expect(res.status).toBe(422);
  });
});
