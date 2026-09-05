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

// Minimal-but-real magic bytes for each allowed kind.
const PDF_BYTES = Buffer.from('%PDF-1.4\n%fake receipt for e2e testing\n');
const PNG_BYTES = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x01, 0x02]);
const NOT_A_PDF_BYTES = Buffer.from('this is not actually a pdf file');

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
  version: number;
}

interface TestPayment {
  id: string;
  hasReceipt: boolean;
}

describe('Payment (e2e)', () => {
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
    masterData = await createTestMasterData(prisma, manager.id, `pay${RUN_ID}`);
  });

  afterAll(async () => {
    await prisma.payment.deleteMany({
      where: { invoice: { shipmentId: { in: createdShipmentIds } } },
    });
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
        flightDate: colomboToday(),
        depTime: '05:00',
      });
    expect(res.status).toBe(201);
    createdShipmentIds.push(res.body.id as string);
    return res.body.id as string;
  }

  /** An Issued invoice with a single FLAT 100.00 USD line — a clean, round totalUsd for payment math. */
  async function createIssuedInvoice(): Promise<TestInvoice> {
    const shipmentId = await createShipment();
    const created = await request(server)
      .post('/api/v1/invoices')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ shipmentId, exchangeRate: '340.50', invoiceDate: colomboToday() });
    expect(created.status).toBe(201);

    const withLine = await request(server)
      .patch(`/api/v1/invoices/${created.body.id}`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({
        version: created.body.version,
        lines: [{ description: 'TEST CHARGE', weightBasis: 'FLAT', rateUsd: '100.00' }],
      });
    expect(withLine.status).toBe(200);
    expect(withLine.body.totalUsd).toBe('100.00');

    const issued = await request(server)
      .post(`/api/v1/invoices/${created.body.id}/issue`)
      .set('Authorization', `Bearer ${managerToken}`)
      .set('Idempotency-Key', randomUUID());
    expect(issued.status).toBe(201);
    expect(issued.body.status).toBe('ISSUED');

    return issued.body as TestInvoice;
  }

  it('rejects recording with no token', async () => {
    const res = await request(server).post('/api/v1/invoices/does-not-matter/payments').send({});
    expect(res.status).toBe(401);
  });

  it('Executive cannot record a payment (no payment.record)', async () => {
    const invoice = await createIssuedInvoice();
    const res = await request(server)
      .post(`/api/v1/invoices/${invoice.id}/payments`)
      .set('Authorization', `Bearer ${executiveToken}`)
      .field('amount', '50.00')
      .field('currency', 'USD')
      .field('paymentDate', colomboToday());
    expect(res.status).toBe(403);
  });

  it('Director can list payments (payment.view.readonly); Executive cannot', async () => {
    const invoice = await createIssuedInvoice();

    const directorRes = await request(server)
      .get(`/api/v1/invoices/${invoice.id}/payments`)
      .set('Authorization', `Bearer ${directorToken}`);
    expect(directorRes.status).toBe(200);

    const executiveRes = await request(server)
      .get(`/api/v1/invoices/${invoice.id}/payments`)
      .set('Authorization', `Bearer ${executiveToken}`);
    expect(executiveRes.status).toBe(403);
  });

  // --- Decision #4: payments only against an Issued invoice ---------------
  it('rejects recording a payment against a Draft invoice', async () => {
    const shipmentId = await createShipment();
    const draft = await request(server)
      .post('/api/v1/invoices')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ shipmentId });
    expect(draft.status).toBe(201);

    const res = await request(server)
      .post(`/api/v1/invoices/${draft.body.id}/payments`)
      .set('Authorization', `Bearer ${managerToken}`)
      .field('amount', '10.00')
      .field('currency', 'USD')
      .field('paymentDate', colomboToday());
    expect(res.status).toBe(422);
  });

  // --- AC-16/AC-17 ----------------------------------------------------------
  describe('partial payments accumulate to fully paid, without touching shipment status', () => {
    it('a USD partial payment then an LKR partial payment reach exactly 0 remaining', async () => {
      const invoice = await createIssuedInvoice();

      const first = await request(server)
        .post(`/api/v1/invoices/${invoice.id}/payments`)
        .set('Authorization', `Bearer ${managerToken}`)
        .field('amount', '60.00')
        .field('currency', 'USD')
        .field('paymentDate', colomboToday());
      expect(first.status).toBe(201);

      const afterFirst = await request(server)
        .get(`/api/v1/invoices/${invoice.id}/payments`)
        .set('Authorization', `Bearer ${managerToken}`);
      expect(afterFirst.body.summary.remainingUsd).toBe('40.00');
      expect(afterFirst.body.summary.isFullyPaid).toBe(false);

      // 40.00 USD at 340.50 = 13,620.00 LKR exactly.
      const second = await request(server)
        .post(`/api/v1/invoices/${invoice.id}/payments`)
        .set('Authorization', `Bearer ${managerToken}`)
        .field('amount', '13620.00')
        .field('currency', 'LKR')
        .field('paymentDate', colomboToday());
      expect(second.status).toBe(201);

      const afterSecond = await request(server)
        .get(`/api/v1/invoices/${invoice.id}/payments`)
        .set('Authorization', `Bearer ${managerToken}`);
      expect(afterSecond.body.summary.remainingUsd).toBe('0.00');
      expect(afterSecond.body.summary.isFullyPaid).toBe(true);
      expect(afterSecond.body.payments).toHaveLength(2);

      // AC-17: the shipment's own status is untouched by full payment.
      const shipmentRes = await request(server)
        .get(`/api/v1/shipments/${invoice.shipmentId}`)
        .set('Authorization', `Bearer ${managerToken}`);
      expect(shipmentRes.body.status).toBe('PENDING');
    });

    it('rejects a payment that would exceed the invoice total', async () => {
      const invoice = await createIssuedInvoice();

      const overpay = await request(server)
        .post(`/api/v1/invoices/${invoice.id}/payments`)
        .set('Authorization', `Bearer ${managerToken}`)
        .field('amount', '100.01')
        .field('currency', 'USD')
        .field('paymentDate', colomboToday());
      expect(overpay.status).toBe(422);
    });
  });

  // --- Idempotency ------------------------------------------------------
  it('a replayed Idempotency-Key returns the same payment, not a duplicate', async () => {
    const invoice = await createIssuedInvoice();
    const key = randomUUID();

    const first = await request(server)
      .post(`/api/v1/invoices/${invoice.id}/payments`)
      .set('Authorization', `Bearer ${managerToken}`)
      .set('Idempotency-Key', key)
      .field('amount', '25.00')
      .field('currency', 'USD')
      .field('paymentDate', colomboToday());
    expect(first.status).toBe(201);

    const replay = await request(server)
      .post(`/api/v1/invoices/${invoice.id}/payments`)
      .set('Authorization', `Bearer ${managerToken}`)
      .set('Idempotency-Key', key)
      .field('amount', '25.00')
      .field('currency', 'USD')
      .field('paymentDate', colomboToday());
    expect(replay.status).toBe(201);
    expect(replay.body.id).toBe(first.body.id);

    const list = await request(server)
      .get(`/api/v1/invoices/${invoice.id}/payments`)
      .set('Authorization', `Bearer ${managerToken}`);
    expect(list.body.payments).toHaveLength(1);
  });

  // --- Receipts -----------------------------------------------------------
  describe('receipt upload and private-serving', () => {
    it('uploads a PDF receipt and downloads the same bytes back', async () => {
      const invoice = await createIssuedInvoice();

      const recorded = await request(server)
        .post(`/api/v1/invoices/${invoice.id}/payments`)
        .set('Authorization', `Bearer ${managerToken}`)
        .field('amount', '30.00')
        .field('currency', 'USD')
        .field('paymentDate', colomboToday())
        .attach('receipt', PDF_BYTES, { filename: 'receipt.pdf', contentType: 'application/pdf' });
      expect(recorded.status).toBe(201);
      const payment = recorded.body as TestPayment;
      expect(payment.hasReceipt).toBe(true);

      const download = await request(server)
        .get(`/api/v1/payments/${payment.id}/receipt`)
        .set('Authorization', `Bearer ${managerToken}`);
      expect(download.status).toBe(200);
      expect(download.headers['content-type']).toContain('application/pdf');
      expect(Buffer.compare(download.body as Buffer, PDF_BYTES)).toBe(0);
    });

    it('accepts a PNG receipt too', async () => {
      const invoice = await createIssuedInvoice();
      const recorded = await request(server)
        .post(`/api/v1/invoices/${invoice.id}/payments`)
        .set('Authorization', `Bearer ${managerToken}`)
        .field('amount', '15.00')
        .field('currency', 'USD')
        .field('paymentDate', colomboToday())
        .attach('receipt', PNG_BYTES, { filename: 'receipt.png', contentType: 'image/png' });
      expect(recorded.status).toBe(201);
      expect((recorded.body as TestPayment).hasReceipt).toBe(true);
    });

    it('rejects a file whose magic bytes do not match its declared MIME type', async () => {
      const invoice = await createIssuedInvoice();
      const res = await request(server)
        .post(`/api/v1/invoices/${invoice.id}/payments`)
        .set('Authorization', `Bearer ${managerToken}`)
        .field('amount', '5.00')
        .field('currency', 'USD')
        .field('paymentDate', colomboToday())
        .attach('receipt', NOT_A_PDF_BYTES, {
          filename: 'receipt.pdf',
          contentType: 'application/pdf',
        });
      expect(res.status).toBe(422);
    });

    it('Executive cannot download a receipt (no payment.view*)', async () => {
      const invoice = await createIssuedInvoice();
      const recorded = await request(server)
        .post(`/api/v1/invoices/${invoice.id}/payments`)
        .set('Authorization', `Bearer ${managerToken}`)
        .field('amount', '10.00')
        .field('currency', 'USD')
        .field('paymentDate', colomboToday())
        .attach('receipt', PDF_BYTES, { filename: 'receipt.pdf', contentType: 'application/pdf' });

      const res = await request(server)
        .get(`/api/v1/payments/${recorded.body.id}/receipt`)
        .set('Authorization', `Bearer ${executiveToken}`);
      expect(res.status).toBe(403);
    });
  });

  it('every recorded payment writes an audit row inside the same transaction', async () => {
    const invoice = await createIssuedInvoice();
    const recorded = await request(server)
      .post(`/api/v1/invoices/${invoice.id}/payments`)
      .set('Authorization', `Bearer ${managerToken}`)
      .field('amount', '10.00')
      .field('currency', 'USD')
      .field('paymentDate', colomboToday());

    const auditRow = await prisma.auditLog.findFirst({
      where: { entityType: 'payment', action: 'payment.create', entityId: recorded.body.id },
    });
    expect(auditRow).not.toBeNull();
    expect(auditRow?.actorUserId).not.toBeNull();
  });
});
