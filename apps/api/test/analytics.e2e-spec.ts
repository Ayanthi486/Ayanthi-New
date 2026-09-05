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

interface AnalyticsRow {
  shipmentId: string;
  weightKg: string | null;
  exchangeRateUsed: string | null;
  revenueUsd: string;
  revenueLkr: string;
  buyingCostUsd: string;
  buyingCostLkr: string;
  opexLkr: string;
  profitLkr: string;
}

describe('Analytics (e2e)', () => {
  let app: INestApplication;
  let server: Server;
  let prisma: PrismaService;
  let executiveToken: string;
  let managerToken: string;
  let directorToken: string;
  let masterData: TestMasterData;
  const createdShipmentIds: string[] = [];
  const createdAirlineIds: string[] = [];

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
    masterData = await createTestMasterData(prisma, manager.id, `an${RUN_ID}`);
  }, 60_000);

  afterAll(async () => {
    await prisma.invoiceLine.deleteMany({
      where: { invoice: { shipmentId: { in: createdShipmentIds } } },
    });
    await prisma.invoice.deleteMany({ where: { shipmentId: { in: createdShipmentIds } } });
    await prisma.costSheetLine.deleteMany({
      where: { costSheet: { shipmentId: { in: createdShipmentIds } } },
    });
    await prisma.costSheet.deleteMany({ where: { shipmentId: { in: createdShipmentIds } } });
    // See cutoff.e2e-spec.ts: a live CutoffCronService sharing this database
    // can raise a real alert for one of these shipments mid-run.
    await prisma.cutoffAlert.deleteMany({ where: { shipmentId: { in: createdShipmentIds } } });
    await prisma.shipment.deleteMany({ where: { id: { in: createdShipmentIds } } });
    await prisma.rateTable.deleteMany({ where: { airlineId: { in: createdAirlineIds } } });
    await prisma.airline.deleteMany({ where: { id: { in: createdAirlineIds } } });
    await deleteTestMasterData(prisma, masterData);
    await app.close();
  }, 60_000);

  async function createShipment(flightDate: string = colomboToday()): Promise<string> {
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
        flightDate,
        depTime: '10:00',
      });
    expect(res.status).toBe(201);
    createdShipmentIds.push(res.body.id as string);
    return res.body.id as string;
  }

  async function createInvoiceWithLines(
    shipmentId: string,
    extra: Record<string, unknown>,
    lines: { description: string; weightBasis: string; rateUsd: string }[],
  ): Promise<{ totalUsd: string; totalLkr: string }> {
    const createRes = await request(server)
      .post('/api/v1/invoices')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ shipmentId, ...extra });
    expect(createRes.status).toBe(201);

    const patchRes = await request(server)
      .patch(`/api/v1/invoices/${createRes.body.id}`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ version: createRes.body.version, lines });
    expect(patchRes.status).toBe(200);
    return {
      totalUsd: patchRes.body.totalUsd as string,
      totalLkr: patchRes.body.totalLkr as string,
    };
  }

  async function fetchShipmentRow(shipmentId: string): Promise<AnalyticsRow> {
    const res = await request(server)
      .get('/api/v1/analytics/shipments')
      .query({ commodityId: masterData.commodityId })
      .set('Authorization', `Bearer ${managerToken}`);
    expect(res.status).toBe(200);
    const row = (res.body as AnalyticsRow[]).find((r) => r.shipmentId === shipmentId);
    if (!row) throw new Error(`No analytics row for shipment ${shipmentId}`);
    return row;
  }

  it('rejects with no token', async () => {
    const shipmentsRes = await request(server).get('/api/v1/analytics/shipments');
    expect(shipmentsRes.status).toBe(401);
    const summaryRes = await request(server)
      .get('/api/v1/analytics/summary')
      .query({ groupBy: 'commodity' });
    expect(summaryRes.status).toBe(401);
  });

  it('Executive cannot view analytics (no analytics.view, OQ-8)', async () => {
    const res = await request(server)
      .get('/api/v1/analytics/shipments')
      .set('Authorization', `Bearer ${executiveToken}`);
    expect(res.status).toBe(403);
  });

  it('Director can view analytics (analytics.view)', async () => {
    const res = await request(server)
      .get('/api/v1/analytics/shipments')
      .set('Authorization', `Bearer ${directorToken}`);
    expect(res.status).toBe(200);
  });

  describe('BR-38 profit pipeline', () => {
    it('revenue, buying cost (via the applied rate), opex and profit all tie to the source modules', async () => {
      const shipmentId = await createShipment();

      const rateRes = await request(server)
        .post('/api/v1/rates')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          airlineId: masterData.airlineId,
          rateUsdPerKg: '4.00',
          effectiveFrom: colomboToday(),
        });
      expect(rateRes.status).toBe(201);
      const captureRes = await request(server)
        .post(`/api/v1/shipments/${shipmentId}/buying-rate`)
        .set('Authorization', `Bearer ${managerToken}`);
      expect(captureRes.status).toBe(201);

      const { totalUsd, totalLkr } = await createInvoiceWithLines(
        shipmentId,
        { chargeableWeightKg: '500.00', exchangeRate: '340.50' },
        [
          { description: 'FREIGHT CHARGES', weightBasis: 'CHARGEABLE', rateUsd: '4.75' },
          { description: 'MAWB FEE', weightBasis: 'FLAT', rateUsd: '26.50' },
        ],
      );
      expect(totalUsd).toBe('2401.50');
      expect(totalLkr).toBe('817710.75');

      const costSheetRes = await request(server)
        .post('/api/v1/costsheets')
        .set('Authorization', `Bearer ${executiveToken}`)
        .send({ shipmentId });
      expect(costSheetRes.status).toBe(201);
      const costSheetPatch = await request(server)
        .patch(`/api/v1/costsheets/${costSheetRes.body.id}`)
        .set('Authorization', `Bearer ${executiveToken}`)
        .send({
          version: costSheetRes.body.version,
          lines: { TRANSPORT: '10000.00', LABOUR: '5000.00' },
        });
      expect(costSheetPatch.status).toBe(200);
      expect(costSheetPatch.body.total).toBe('15000.00');

      const row = await fetchShipmentRow(shipmentId);
      expect(row.exchangeRateUsed).toBe('340.5');
      expect(row.revenueUsd).toBe('2401.50');
      expect(row.revenueLkr).toBe('817710.75');
      // 500.00 chargeable kg x 4.00 USD/kg applied rate.
      expect(row.buyingCostUsd).toBe('2000.00');
      // 2000.00 x 340.50
      expect(row.buyingCostLkr).toBe('681000.00');
      expect(row.opexLkr).toBe('15000.00');
      // 817710.75 - 681000.00 - 15000.00
      expect(row.profitLkr).toBe('121710.75');
    });
  });

  it('a shipment with no invoice contributes weight but zero revenue/cost/profit', async () => {
    const shipmentId = await createShipment();
    const cargoRes = await request(server)
      .patch(`/api/v1/shipments/${shipmentId}/cargo`)
      .set('Authorization', `Bearer ${executiveToken}`)
      .send({ version: 0, boxCount: 5, weightKg: '300.500' });
    expect(cargoRes.status).toBe(200);

    const row = await fetchShipmentRow(shipmentId);
    expect(row.weightKg).toBe('300.5');
    expect(row.revenueUsd).toBe('0.00');
    expect(row.buyingCostUsd).toBe('0.00');
    expect(row.opexLkr).toBe('0.00');
    expect(row.profitLkr).toBe('0.00');
  });

  it('excludes a Cancelled shipment', async () => {
    const shipmentId = await createShipment();
    await prisma.shipment.update({ where: { id: shipmentId }, data: { status: 'CANCELLED' } });

    const res = await request(server)
      .get('/api/v1/analytics/shipments')
      .query({ commodityId: masterData.commodityId })
      .set('Authorization', `Bearer ${managerToken}`);
    expect(res.status).toBe(200);
    expect((res.body as AnalyticsRow[]).find((r) => r.shipmentId === shipmentId)).toBeUndefined();
  });

  it('drill-through reconciliation: /summary totals equal the /shipments rows for the same filters', async () => {
    const dateA = colomboToday();
    const dateB = addDays(colomboToday(), 5);
    const shipmentA = await createShipment(dateA);
    const shipmentB = await createShipment(dateB);

    await createInvoiceWithLines(shipmentA, { exchangeRate: '300.00' }, [
      { description: 'HANDLING', weightBasis: 'FLAT', rateUsd: '100.00' },
    ]);
    await createInvoiceWithLines(shipmentB, { exchangeRate: '300.00' }, [
      { description: 'HANDLING', weightBasis: 'FLAT', rateUsd: '100.00' },
    ]);

    // Same filters on both endpoints — the drill-through list is not narrowed
    // to just shipmentA/shipmentB, so it may also include other shipments
    // this test file created under the same commodity/date range (e.g. the
    // BR-38 fixture, also dated today); the point is that whatever the list
    // returns, the summary's totals reconcile against it exactly.
    const listRes = await request(server)
      .get('/api/v1/analytics/shipments')
      .query({ commodityId: masterData.commodityId, dateFrom: dateA, dateTo: dateB })
      .set('Authorization', `Bearer ${managerToken}`);
    expect(listRes.status).toBe(200);
    const rows = listRes.body as AnalyticsRow[];
    expect(rows.map((r) => r.shipmentId)).toEqual(expect.arrayContaining([shipmentA, shipmentB]));
    const summedRevenueLkr = rows.reduce((sum, r) => sum + Number(r.revenueLkr), 0);

    const summaryRes = await request(server)
      .get('/api/v1/analytics/summary')
      .query({
        groupBy: 'time',
        period: 'day',
        commodityId: masterData.commodityId,
        dateFrom: dateA,
        dateTo: dateB,
      })
      .set('Authorization', `Bearer ${managerToken}`);
    expect(summaryRes.status).toBe(200);
    expect(summaryRes.body.groups).toHaveLength(2);
    expect(summaryRes.body.totals.revenueLkr).toBe(summedRevenueLkr.toFixed(2));
    expect(summaryRes.body.totals.shipmentCount).toBe(rows.length);
  });

  it('AC-14: a later Rate Table change does not alter a shipment’s already-reported profit', async () => {
    // Its own airline (not masterData.airlineId, shared by other tests in
    // this file) — a second same-day rate for one airline is itself
    // rejected (BR-04: "must start after the currently open period began"),
    // so this needs an airline with no other rate history.
    const airline = await prisma.airline.create({ data: { name: `E2E AC14 Airline ${RUN_ID}` } });
    createdAirlineIds.push(airline.id);

    const shipmentRes = await request(server)
      .post('/api/v1/shipments')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({
        airlineId: airline.id,
        shipperId: masterData.shipperId,
        consigneeId: masterData.consigneeId,
        commodityId: masterData.commodityId,
        destinationAirportId: masterData.airportId,
        flightNo: 'EK123',
        mawbNo: '176-0000-0001',
        flightDate: colomboToday(),
        depTime: '10:00',
      });
    expect(shipmentRes.status).toBe(201);
    const shipmentId = shipmentRes.body.id as string;
    createdShipmentIds.push(shipmentId);

    await request(server)
      .post('/api/v1/rates')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ airlineId: airline.id, rateUsdPerKg: '4.75', effectiveFrom: colomboToday() });
    await request(server)
      .post(`/api/v1/shipments/${shipmentId}/buying-rate`)
      .set('Authorization', `Bearer ${managerToken}`);
    await createInvoiceWithLines(
      shipmentId,
      { chargeableWeightKg: '500.00', exchangeRate: '340.50' },
      [{ description: 'FREIGHT CHARGES', weightBasis: 'CHARGEABLE', rateUsd: '10.00' }],
    );

    const before = await fetchShipmentRow(shipmentId);

    const laterRateRes = await request(server)
      .post('/api/v1/rates')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({
        airlineId: airline.id,
        rateUsdPerKg: '9.99',
        effectiveFrom: addDays(colomboToday(), 7),
      });
    expect(laterRateRes.status).toBe(201);

    const after = await fetchShipmentRow(shipmentId);
    expect(after.buyingCostUsd).toBe(before.buyingCostUsd);
    expect(after.profitLkr).toBe(before.profitLkr);
  });

  it('exports the drill-through list as CSV', async () => {
    const shipmentId = await createShipment();
    await createInvoiceWithLines(shipmentId, { exchangeRate: '300.00' }, [
      { description: 'HANDLING', weightBasis: 'FLAT', rateUsd: '50.00' },
    ]);

    const res = await request(server)
      .get('/api/v1/analytics/shipments')
      .query({ commodityId: masterData.commodityId, format: 'csv' })
      .set('Authorization', `Bearer ${managerToken}`);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/csv');
    expect(res.text).toContain('Shipment No');
  });
});
