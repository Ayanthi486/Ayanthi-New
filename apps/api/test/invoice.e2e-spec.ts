import type { Server } from 'node:http';
import { randomUUID } from 'node:crypto';
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

interface TestInvoice {
  id: string;
  shipmentId: string;
  status: 'DRAFT' | 'ISSUED';
  totalUsd: string;
  totalLkr: string;
  version: number;
  issuedByUserId: string | null;
  issuedAt: string | null;
}

/** The real invoice's five lines (AWB 157 0659 8944, references/company-process/invoice.pdf). */
const REAL_LINES = [
  { description: 'FREIGHT CHARGES', weightBasis: 'CHARGEABLE', rateUsd: '4.75' },
  { description: 'MAWB FEE', weightBasis: 'FLAT', rateUsd: '26.50' },
  { description: 'SCREENING CHARGES', weightBasis: 'GROSS', rateUsd: '0.021' },
  { description: 'HANDLING CHARGES', weightBasis: 'FLAT', rateUsd: '35.00' },
  { description: 'SECURITY CHARGES', weightBasis: 'FLAT', rateUsd: '36.2594' },
];

describe('Invoice (e2e)', () => {
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
    masterData = await createTestMasterData(prisma, manager.id, `inv${RUN_ID}`);
  });

  afterAll(async () => {
    await prisma.invoiceLine.deleteMany({
      where: { invoice: { shipmentId: { in: createdShipmentIds } } },
    });
    await prisma.invoice.deleteMany({ where: { shipmentId: { in: createdShipmentIds } } });
    // See cutoff.e2e-spec.ts: a live CutoffCronService sharing this database
    // can raise a real alert for one of these shipments mid-run.
    await prisma.cutoffAlert.deleteMany({ where: { shipmentId: { in: createdShipmentIds } } });
    await prisma.shipment.deleteMany({ where: { id: { in: createdShipmentIds } } });
    await deleteTestMasterData(prisma, masterData);
    await app.close();
  });

  async function createShipment(token: string): Promise<string> {
    const res = await request(server)
      .post('/api/v1/shipments')
      .set('Authorization', `Bearer ${token}`)
      .send({
        airlineId: masterData.airlineId,
        shipperId: masterData.shipperId,
        consigneeId: masterData.consigneeId,
        commodityId: masterData.commodityId,
        destinationAirportId: masterData.airportId,
        serviceType: 'BOOKING_AND_HANDLING',
        flightNo: 'EK123',
        mawbNo: '176-0000-0001',
        flightDate: colomboToday(),
        depTime: '04:00',
      });
    expect(res.status).toBe(201);
    createdShipmentIds.push(res.body.id as string);
    return res.body.id as string;
  }

  /** Executive enters the real invoice's gross weight so GROSS-basis lines can be computed. */
  async function enterGrossWeight(shipmentId: string): Promise<void> {
    const res = await request(server)
      .patch(`/api/v1/shipments/${shipmentId}/cargo`)
      .set('Authorization', `Bearer ${executiveToken}`)
      .send({ version: 0, boxCount: 26, weightKg: '444.50' });
    expect(res.status).toBe(200);
  }

  async function createInvoice(
    token: string,
    shipmentId: string,
    extra: Record<string, unknown> = {},
  ): Promise<TestInvoice> {
    const res = await request(server)
      .post('/api/v1/invoices')
      .set('Authorization', `Bearer ${token}`)
      .send({ shipmentId, ...extra });
    expect(res.status).toBe(201);
    return res.body as TestInvoice;
  }

  it('rejects create with no token', async () => {
    const res = await request(server).post('/api/v1/invoices').send({});
    expect(res.status).toBe(401);
  });

  it('Executive cannot create an Invoice (no invoice.manage)', async () => {
    const shipmentId = await createShipment(executiveToken);
    const res = await request(server)
      .post('/api/v1/invoices')
      .set('Authorization', `Bearer ${executiveToken}`)
      .send({ shipmentId });
    expect(res.status).toBe(403);
  });

  it('Director cannot create an Invoice (no invoice.manage)', async () => {
    const shipmentId = await createShipment(managerToken);
    const res = await request(server)
      .post('/api/v1/invoices')
      .set('Authorization', `Bearer ${directorToken}`)
      .send({ shipmentId });
    expect(res.status).toBe(403);
  });

  it('Director can read an Invoice (invoice.view.readonly); Executive cannot (decision #11)', async () => {
    const shipmentId = await createShipment(managerToken);
    await createInvoice(managerToken, shipmentId);

    const directorRes = await request(server)
      .get(`/api/v1/invoices/by-shipment/${shipmentId}`)
      .set('Authorization', `Bearer ${directorToken}`);
    expect(directorRes.status).toBe(200);

    const executiveRes = await request(server)
      .get(`/api/v1/invoices/by-shipment/${shipmentId}`)
      .set('Authorization', `Bearer ${executiveToken}`);
    expect(executiveRes.status).toBe(403);
  });

  it('rejects a second Invoice for the same shipment', async () => {
    const shipmentId = await createShipment(managerToken);
    await createInvoice(managerToken, shipmentId);

    const res = await request(server)
      .post('/api/v1/invoices')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ shipmentId });
    expect(res.status).toBe(409);
  });

  // --- AC-13: the real invoice's five lines ------------------------------
  describe('AC-13 reconciliation (real invoice, AWB 157 0659 8944)', () => {
    it('Freight/MAWB Fee/Screening/Handling reconcile exactly; Security has a flagged ~1-cent gap (README §2)', async () => {
      const shipmentId = await createShipment(executiveToken);
      await enterGrossWeight(shipmentId);
      const invoice = await createInvoice(managerToken, shipmentId, {
        chargeableWeightKg: '500.00',
        exchangeRate: '340.50',
        invoiceNo: `HUB/IU/${RUN_ID}`,
        invoiceDate: colomboToday(),
        termDays: 5,
      });

      const res = await request(server)
        .patch(`/api/v1/invoices/${invoice.id}`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ version: invoice.version, lines: REAL_LINES });
      expect(res.status).toBe(200);

      // decimal.js (Prisma's Decimal) strips insignificant trailing zeros on
      // toString() — same documented behaviour as cargo.e2e-spec.ts's weightKg
      // and costsheet.util.ts's per-line amount. The stored/computed VALUE is
      // exact either way; totalUsd/totalLkr below use toFixed(2) and always
      // show 2dp, since those go through computeTotals explicitly.
      const lines = res.body.lines as {
        description: string;
        amountUsd: string;
        amountLkr: string;
      }[];
      expect(lines[0]).toMatchObject({
        description: 'FREIGHT CHARGES',
        amountUsd: '2375',
        amountLkr: '808687.5',
      });
      expect(lines[1]).toMatchObject({
        description: 'MAWB FEE',
        amountUsd: '26.5',
        amountLkr: '9023.25',
      });
      // The precision trap: 444.50 x 0.021 = 9.3345 -> USD 9.33, LKR from the SAME
      // full-precision base (9.3345 x 340.50 = 3178.397) -> 3,178.40 exactly.
      expect(lines[2]).toMatchObject({
        description: 'SCREENING CHARGES',
        amountUsd: '9.33',
        amountLkr: '3178.4',
      });
      expect(lines[3]).toMatchObject({
        description: 'HANDLING CHARGES',
        amountUsd: '35',
        amountLkr: '11917.5',
      });
      // Security's USD matches the printed 36.26; its LKR (12346.33) is the
      // mathematically consistent figure, one cent under the printed 12,346.34 —
      // see references/README.md discrepancy §2. Not force-matched.
      expect(lines[4]).toMatchObject({
        description: 'SECURITY CHARGES',
        amountUsd: '36.26',
        amountLkr: '12346.33',
      });

      expect(res.body.totalUsd).toBe('2482.09');
      expect(res.body.totalLkr).toBe('845152.98');
    });

    it('WT (Kgs) resolves per line: chargeable weight, gross weight, or blank for FLAT', async () => {
      const shipmentId = await createShipment(executiveToken);
      await enterGrossWeight(shipmentId);
      const invoice = await createInvoice(managerToken, shipmentId, {
        chargeableWeightKg: '500.00',
        exchangeRate: '340.50',
      });

      const res = await request(server)
        .patch(`/api/v1/invoices/${invoice.id}`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ version: invoice.version, lines: REAL_LINES });

      const lines = res.body.lines as { description: string; weightKg: string | null }[];
      expect(lines[0]?.weightKg).toBe('500'); // CHARGEABLE (decimal.js strips trailing zeros)
      expect(lines[1]?.weightKg).toBeNull(); // FLAT
      expect(lines[2]?.weightKg).toBe('444.5'); // GROSS
    });
  });

  it('BR-41/BR-66: airlineBuyingCostUsd is Chargeable Weight x the applied buying rate', async () => {
    const shipmentId = await createShipment(executiveToken);
    await enterGrossWeight(shipmentId);

    const rateRes = await request(server)
      .post('/api/v1/rates')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({
        airlineId: masterData.airlineId,
        rateUsdPerKg: '4.75',
        effectiveFrom: colomboToday(),
      });
    expect(rateRes.status).toBe(201);
    const captureRes = await request(server)
      .post(`/api/v1/shipments/${shipmentId}/buying-rate`)
      .set('Authorization', `Bearer ${managerToken}`);
    expect(captureRes.status).toBe(201);

    const invoice = await createInvoice(managerToken, shipmentId, { chargeableWeightKg: '500.00' });

    const res = await request(server)
      .get(`/api/v1/invoices/${invoice.id}`)
      .set('Authorization', `Bearer ${managerToken}`);
    expect(res.body.airlineBuyingCostUsd).toBe('2375.00');
  });

  it('a stale version on PATCH returns 409 with the exact confirmed message', async () => {
    const shipmentId = await createShipment(managerToken);
    const invoice = await createInvoice(managerToken, shipmentId);

    const firstEdit = await request(server)
      .patch(`/api/v1/invoices/${invoice.id}`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ version: 0, invoiceNo: `HUB/IU/${RUN_ID}-A` });
    expect(firstEdit.status).toBe(200);
    expect(firstEdit.body.version).toBe(1);

    const staleEdit = await request(server)
      .patch(`/api/v1/invoices/${invoice.id}`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ version: 0, invoiceNo: `HUB/IU/${RUN_ID}-B` });
    expect(staleEdit.status).toBe(409);
    expect(staleEdit.body.error.message).toBe(
      'This shipment was updated by another user. Please review the latest information before saving.',
    );
  });

  describe('issue (DRAFT -> ISSUED), immutability and idempotency', () => {
    it('issues a Draft invoice, then rejects further edits (423)', async () => {
      const shipmentId = await createShipment(managerToken);
      const invoice = await createInvoice(managerToken, shipmentId);

      const issueRes = await request(server)
        .post(`/api/v1/invoices/${invoice.id}/issue`)
        .set('Authorization', `Bearer ${managerToken}`)
        .set('Idempotency-Key', randomUUID());
      expect(issueRes.status).toBe(201);
      expect(issueRes.body.status).toBe('ISSUED');
      expect(issueRes.body.issuedByUserId).not.toBeNull();
      expect(issueRes.body.issuedAt).not.toBeNull();

      const editRes = await request(server)
        .patch(`/api/v1/invoices/${invoice.id}`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ version: issueRes.body.version, invoiceNo: 'too late' });
      expect(editRes.status).toBe(423);
    });

    it('a replayed Idempotency-Key on an already-issued invoice returns the same result, not a duplicate/error', async () => {
      const shipmentId = await createShipment(managerToken);
      const invoice = await createInvoice(managerToken, shipmentId);
      const key = randomUUID();

      const firstIssue = await request(server)
        .post(`/api/v1/invoices/${invoice.id}/issue`)
        .set('Authorization', `Bearer ${managerToken}`)
        .set('Idempotency-Key', key);
      expect(firstIssue.status).toBe(201);

      const replay = await request(server)
        .post(`/api/v1/invoices/${invoice.id}/issue`)
        .set('Authorization', `Bearer ${managerToken}`)
        .set('Idempotency-Key', key);
      expect(replay.status).toBe(201);
      expect(replay.body.id).toBe(firstIssue.body.id);
      expect(replay.body.issuedAt).toBe(firstIssue.body.issuedAt);
    });

    it('a second issue attempt with a different key on an already-issued invoice is rejected', async () => {
      const shipmentId = await createShipment(managerToken);
      const invoice = await createInvoice(managerToken, shipmentId);

      await request(server)
        .post(`/api/v1/invoices/${invoice.id}/issue`)
        .set('Authorization', `Bearer ${managerToken}`)
        .set('Idempotency-Key', randomUUID());

      const secondIssue = await request(server)
        .post(`/api/v1/invoices/${invoice.id}/issue`)
        .set('Authorization', `Bearer ${managerToken}`)
        .set('Idempotency-Key', randomUUID());
      expect(secondIssue.status).toBe(422);
    });
  });

  it('every mutating action writes an audit row inside the same transaction', async () => {
    const shipmentId = await createShipment(managerToken);
    const invoice = await createInvoice(managerToken, shipmentId);

    const auditRow = await prisma.auditLog.findFirst({
      where: { entityType: 'invoice', action: 'invoice.create', entityId: invoice.id },
    });
    expect(auditRow).not.toBeNull();
    expect(auditRow?.actorUserId).not.toBeNull();
  });
});
