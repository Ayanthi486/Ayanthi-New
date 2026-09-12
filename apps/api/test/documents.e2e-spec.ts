import type { Server } from 'node:http';
import { INestApplication, type INestApplicationContext } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { DocumentRenderQueueService } from '../src/documents/rendering/document-render-queue.service';
import { DocumentRenderWorker } from '../src/documents/rendering/document-render.worker';
import { PrinterAdapter } from '../src/printing/printer-adapter';
import { PrismaService } from '../src/prisma/prisma.service';
import { colomboToday } from '../src/shipment/shipment.util';
import { WorkerModule } from '../src/worker.module';
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

describe('Documents (e2e)', () => {
  let app: INestApplication;
  let workerApp: INestApplicationContext;
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
    masterData = await createTestMasterData(prisma, manager.id, `doc${RUN_ID}`);

    // Real rendering, no fake: the worker is a genuine Nest application
    // context (same as worker-main.ts), processing BullMQ jobs with the
    // real PuppeteerDocumentRenderer + LocalDiskStorageAdapter.
    workerApp = await NestFactory.createApplicationContext(WorkerModule, { logger: false });
    workerApp.get(DocumentRenderWorker).start();

    // Warm-up: the worker's first render lazily launches headless Chromium,
    // which on this machine took long enough to blow past a normal test's
    // 30s timeout. Absorbing that one-time cost here (inside the 60s hook
    // budget) keeps every actual test fast and un-flaky.
    await app
      .get(DocumentRenderQueueService)
      .renderAndAwait('<html><body>warmup</body></html>', 60_000);
  }, 90_000);

  afterAll(async () => {
    await workerApp.get(DocumentRenderWorker).close();
    await workerApp.close();
    await prisma.shipmentDocument.deleteMany({ where: { shipmentId: { in: createdShipmentIds } } });
    // A live CutoffCronService (the docker-compose worker, or any other
    // worker process sharing this database) can raise a real CutoffAlert
    // for one of these shipments while the suite runs — delete it first or
    // the shipment delete below fails its FK constraint (see cutoff.e2e-spec.ts's
    // identical ordering).
    await prisma.cutoffAlert.deleteMany({ where: { shipmentId: { in: createdShipmentIds } } });
    await prisma.shipment.deleteMany({ where: { id: { in: createdShipmentIds } } });
    await deleteTestMasterData(prisma, masterData);
    await app.close();
  }, 30_000);

  async function createShipment(): Promise<string> {
    const res = await request(server)
      .post('/api/v1/shipments')
      .set('Authorization', `Bearer ${executiveToken}`)
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
        depTime: '06:00',
      });
    expect(res.status).toBe(201);
    createdShipmentIds.push(res.body.id as string);
    return res.body.id as string;
  }

  async function enterCargo(shipmentId: string): Promise<void> {
    const res = await request(server)
      .patch(`/api/v1/shipments/${shipmentId}/cargo`)
      .set('Authorization', `Bearer ${executiveToken}`)
      .send({ version: 0, boxCount: 26, weightKg: '444.50' });
    expect(res.status).toBe(200);
  }

  it('rejects with no token', async () => {
    const res = await request(server).get('/api/v1/shipments/does-not-matter/documents/readiness');
    expect(res.status).toBe(401);
  });

  // --- AC-04: BR-07 blocking rule, exact confirmed message -----------------
  it('is blocked with the exact confirmed message before BOX/WEIGHT exist', async () => {
    const shipmentId = await createShipment();

    const readiness = await request(server)
      .get(`/api/v1/shipments/${shipmentId}/documents/readiness`)
      .set('Authorization', `Bearer ${executiveToken}`);
    expect(readiness.body).toEqual({ ready: false, missingFields: ['boxCount', 'weightKg'] });

    const createAttempt = await request(server)
      .post(`/api/v1/shipments/${shipmentId}/documents/SECURITY_CLEARANCE`)
      .set('Authorization', `Bearer ${executiveToken}`);
    expect(createAttempt.status).toBe(422);
    expect(createAttempt.body.error.message).toBe(
      'Cannot generate document. Please enter Box and Weight information.',
    );
  });

  it('Director can read readiness (documents.view.readonly); cannot create a document', async () => {
    const shipmentId = await createShipment();
    const readonlyRes = await request(server)
      .get(`/api/v1/shipments/${shipmentId}/documents/readiness`)
      .set('Authorization', `Bearer ${directorToken}`);
    expect(readonlyRes.status).toBe(200);

    const createAttempt = await request(server)
      .post(`/api/v1/shipments/${shipmentId}/documents/AWB_STICKER`)
      .set('Authorization', `Bearer ${directorToken}`);
    expect(createAttempt.status).toBe(403);
  });

  // --- Build order item 1: AWB Sticker — no PDF, no Download ---------------
  // Security Clearance/AWB Sticker/CDN are Executive-only (direct request)
  // — every request in this describe block uses executiveToken, never
  // managerToken, on purpose.
  describe('AWB Sticker (BR-62, no stored file)', () => {
    it('creates a DRAFT populated from the shipment, edits fieldData, issues with no stored file', async () => {
      const shipmentId = await createShipment();
      await enterCargo(shipmentId);

      const created = await request(server)
        .post(`/api/v1/shipments/${shipmentId}/documents/AWB_STICKER`)
        .set('Authorization', `Bearer ${executiveToken}`);
      expect(created.status).toBe(201);
      expect(created.body.viewModel.origin).toBe('CMB');
      expect(created.body.viewModel.boxCount).toBe(26);

      const updated = await request(server)
        .patch(`/api/v1/shipments/${shipmentId}/documents/AWB_STICKER`)
        .set('Authorization', `Bearer ${executiveToken}`)
        .send({ fieldData: { carrierName: 'EMIRATES SKY CARGO' } });
      expect(updated.status).toBe(200);
      expect(updated.body.fieldData.carrierName).toBe('EMIRATES SKY CARGO');

      const printPayload = await request(server)
        .get(`/api/v1/shipments/${shipmentId}/documents/AWB_STICKER/print`)
        .set('Authorization', `Bearer ${executiveToken}`);
      expect(printPayload.status).toBe(200);
      expect(printPayload.body.pageSize).toBe('12cm x 8cm');
      expect(printPayload.body.html).toContain('EMIRATES SKY CARGO');

      const issued = await request(server)
        .post(`/api/v1/shipments/${shipmentId}/documents/AWB_STICKER/issue`)
        .set('Authorization', `Bearer ${executiveToken}`);
      expect(issued.status).toBe(201);
      expect(issued.body.status).toBe('ISSUED');
      expect(issued.body.hasStoredFile).toBe(false);
    });

    // ARCHITECTURE §13: business logic must go through PrinterAdapter, never
    // a concrete Zebra/PDF class directly — spying on the abstract token
    // (whichever concrete adapter PRINTER_ADAPTER selects) proves that.
    it('routes through the PrinterAdapter abstraction at Issue, at the confirmed 12cm x 8cm size', async () => {
      const printSpy = vi.spyOn(app.get(PrinterAdapter), 'print');
      const shipmentId = await createShipment();
      await enterCargo(shipmentId);
      await request(server)
        .post(`/api/v1/shipments/${shipmentId}/documents/AWB_STICKER`)
        .set('Authorization', `Bearer ${executiveToken}`);

      await request(server)
        .post(`/api/v1/shipments/${shipmentId}/documents/AWB_STICKER/issue`)
        .set('Authorization', `Bearer ${executiveToken}`);

      expect(printSpy).toHaveBeenCalledWith(
        expect.objectContaining({ pageSize: '12cm x 8cm', html: expect.any(String) }),
      );
      printSpy.mockRestore();
    });
  });

  // --- Build order item 2: Security Clearance — real Puppeteer PDF --------
  // Security Clearance/AWB Sticker/CDN are Executive-only (direct request)
  // — every request in this describe block uses executiveToken, never
  // managerToken, on purpose.
  describe('Security Clearance (real PDF via the worker)', () => {
    it('issues and produces a downloadable stored PDF', async () => {
      const shipmentId = await createShipment();
      await enterCargo(shipmentId);
      await request(server)
        .post(`/api/v1/shipments/${shipmentId}/documents/SECURITY_CLEARANCE`)
        .set('Authorization', `Bearer ${executiveToken}`);
      await request(server)
        .patch(`/api/v1/shipments/${shipmentId}/documents/SECURITY_CLEARANCE`)
        .set('Authorization', `Bearer ${executiveToken}`)
        .send({
          // fullName/designation/nic are no longer manual fieldData — they're
          // auto-populated from the preparer's account/Profile (viewModel).
          // Only the handover/taken-charge officer's own fields stay manual.
          fieldData: { handoverEmployeeName: 'S.M Liyanage', handoverNic: '800602017V' },
        });

      const issued = await request(server)
        .post(`/api/v1/shipments/${shipmentId}/documents/SECURITY_CLEARANCE/issue`)
        .set('Authorization', `Bearer ${executiveToken}`);
      expect(issued.status).toBe(201);
      expect(issued.body.status).toBe('ISSUED');
      expect(issued.body.hasStoredFile).toBe(true);

      const download = await request(server)
        .get(`/api/v1/documents/${issued.body.id}/file`)
        .set('Authorization', `Bearer ${executiveToken}`);
      expect(download.status).toBe(200);
      expect(download.headers['content-type']).toContain('application/pdf');
      // %PDF- magic bytes confirm this is a genuine rendered PDF, not a stub.
      expect((download.body as Buffer).subarray(0, 5).toString('latin1')).toBe('%PDF-');
    }, 30_000);

    it('an Issued document is immutable — further edits rejected (423)', async () => {
      const shipmentId = await createShipment();
      await enterCargo(shipmentId);
      await request(server)
        .post(`/api/v1/shipments/${shipmentId}/documents/SECURITY_CLEARANCE`)
        .set('Authorization', `Bearer ${executiveToken}`);
      await request(server)
        .post(`/api/v1/shipments/${shipmentId}/documents/SECURITY_CLEARANCE/issue`)
        .set('Authorization', `Bearer ${executiveToken}`);

      const editAttempt = await request(server)
        .patch(`/api/v1/shipments/${shipmentId}/documents/SECURITY_CLEARANCE`)
        .set('Authorization', `Bearer ${executiveToken}`)
        .send({ fieldData: { handoverEmployeeName: 'too late' } });
      expect(editAttempt.status).toBe(423);
    }, 30_000);

    it('editing the shipment afterwards opens a new DRAFT v2 — the issued v1 is untouched', async () => {
      const shipmentId = await createShipment();
      await enterCargo(shipmentId);
      await request(server)
        .post(`/api/v1/shipments/${shipmentId}/documents/SECURITY_CLEARANCE`)
        .set('Authorization', `Bearer ${executiveToken}`);
      const issuedV1 = await request(server)
        .post(`/api/v1/shipments/${shipmentId}/documents/SECURITY_CLEARANCE/issue`)
        .set('Authorization', `Bearer ${executiveToken}`);
      expect(issuedV1.body.version).toBe(1);

      const shipmentEdit = await request(server)
        .patch(`/api/v1/shipments/${shipmentId}`)
        .set('Authorization', `Bearer ${executiveToken}`)
        .send({ version: 1, cusdecNo: 'CUS-CHANGED' });
      expect(shipmentEdit.status).toBe(200);

      const latest = await request(server)
        .get(`/api/v1/shipments/${shipmentId}/documents/SECURITY_CLEARANCE`)
        .set('Authorization', `Bearer ${executiveToken}`);
      expect(latest.body.version).toBe(2);
      expect(latest.body.status).toBe('DRAFT');

      const v1Row = await prisma.shipmentDocument.findUniqueOrThrow({
        where: { shipmentId_type_version: { shipmentId, type: 'SECURITY_CLEARANCE', version: 1 } },
      });
      expect(v1Row.status).toBe('ISSUED');
    }, 30_000);

    it('a direct file-URL attempt with no token at all is rejected; Manager/Director have zero access to this type', async () => {
      const shipmentId = await createShipment();
      await enterCargo(shipmentId);
      await request(server)
        .post(`/api/v1/shipments/${shipmentId}/documents/SECURITY_CLEARANCE`)
        .set('Authorization', `Bearer ${executiveToken}`);
      const issued = await request(server)
        .post(`/api/v1/shipments/${shipmentId}/documents/SECURITY_CLEARANCE/issue`)
        .set('Authorization', `Bearer ${executiveToken}`);

      const res = await request(server).get(`/api/v1/documents/${issued.body.id}/file`);
      expect(res.status).toBe(401);

      // Neither Manager's documents.manage nor Director's
      // documents.view.readonly cover this Executive-only type.
      const managerRes = await request(server)
        .get(`/api/v1/documents/${issued.body.id}/file`)
        .set('Authorization', `Bearer ${managerToken}`);
      expect(managerRes.status).toBe(403);

      const directorRes = await request(server)
        .get(`/api/v1/documents/${issued.body.id}/file`)
        .set('Authorization', `Bearer ${directorToken}`);
      expect(directorRes.status).toBe(403);
    }, 30_000);
  });

  // --- Direct request: Security Clearance/AWB Sticker/CDN are Executive-only, full stop ---
  describe.each(['SECURITY_CLEARANCE', 'AWB_STICKER', 'CDN'] as const)(
    '%s is Executive-only',
    (type) => {
      it('Manager (documents.manage) cannot create, view, or edit this type', async () => {
        const shipmentId = await createShipment();
        await enterCargo(shipmentId);

        const createAttempt = await request(server)
          .post(`/api/v1/shipments/${shipmentId}/documents/${type}`)
          .set('Authorization', `Bearer ${managerToken}`);
        expect(createAttempt.status).toBe(403);

        const created = await request(server)
          .post(`/api/v1/shipments/${shipmentId}/documents/${type}`)
          .set('Authorization', `Bearer ${executiveToken}`);
        expect(created.status).toBe(201);

        const getAttempt = await request(server)
          .get(`/api/v1/shipments/${shipmentId}/documents/${type}`)
          .set('Authorization', `Bearer ${managerToken}`);
        expect(getAttempt.status).toBe(403);

        const editAttempt = await request(server)
          .patch(`/api/v1/shipments/${shipmentId}/documents/${type}`)
          .set('Authorization', `Bearer ${managerToken}`)
          .send({ fieldData: {} });
        expect(editAttempt.status).toBe(403);

        const issueAttempt = await request(server)
          .post(`/api/v1/shipments/${shipmentId}/documents/${type}/issue`)
          .set('Authorization', `Bearer ${managerToken}`);
        expect(issueAttempt.status).toBe(403);
      });

      it('Director (documents.view.readonly) cannot even view this type', async () => {
        const shipmentId = await createShipment();
        await enterCargo(shipmentId);
        await request(server)
          .post(`/api/v1/shipments/${shipmentId}/documents/${type}`)
          .set('Authorization', `Bearer ${executiveToken}`);

        const getAttempt = await request(server)
          .get(`/api/v1/shipments/${shipmentId}/documents/${type}`)
          .set('Authorization', `Bearer ${directorToken}`);
        expect(getAttempt.status).toBe(403);
      });
    },
  );

  // --- Build order items 3 & 4: ADF and AWB are now upload-only, not generated ---
  // CUSDEC (added later) reuses the exact same upload-only infrastructure.
  const UPLOAD_PDF_BYTES = Buffer.from('%PDF-1.4\n%fake ADF/AWB/CUSDEC for e2e testing\n');
  const NOT_A_PDF_BYTES = Buffer.from('this is not actually a pdf file');

  describe.each(['ADF', 'AWB', 'CUSDEC'] as const)('%s (upload-only document)', (type) => {
    it('rejects the generate/edit/issue/print routes — those apply to generated types only', async () => {
      const shipmentId = await createShipment();
      await enterCargo(shipmentId);

      const createAttempt = await request(server)
        .post(`/api/v1/shipments/${shipmentId}/documents/${type}`)
        .set('Authorization', `Bearer ${managerToken}`);
      expect(createAttempt.status).toBe(422);

      const issueAttempt = await request(server)
        .post(`/api/v1/shipments/${shipmentId}/documents/${type}/issue`)
        .set('Authorization', `Bearer ${managerToken}`);
      expect(issueAttempt.status).toBe(422);

      const printAttempt = await request(server)
        .get(`/api/v1/shipments/${shipmentId}/documents/${type}/print`)
        .set('Authorization', `Bearer ${managerToken}`);
      expect(printAttempt.status).toBe(422);
    });

    it('uploads a PDF as version 1, ISSUED immediately, with a stored file', async () => {
      const shipmentId = await createShipment();
      await enterCargo(shipmentId);

      const uploaded = await request(server)
        .post(`/api/v1/shipments/${shipmentId}/documents/${type}/upload`)
        .set('Authorization', `Bearer ${managerToken}`)
        .attach('file', UPLOAD_PDF_BYTES, { filename: 'doc.pdf', contentType: 'application/pdf' });

      expect(uploaded.status).toBe(201);
      expect(uploaded.body.version).toBe(1);
      expect(uploaded.body.status).toBe('ISSUED');
      expect(uploaded.body.hasStoredFile).toBe(true);

      const fileRes = await request(server)
        .get(`/api/v1/documents/${uploaded.body.id}/file`)
        .set('Authorization', `Bearer ${managerToken}`);
      expect(fileRes.status).toBe(200);
    });

    it('rejects a non-PDF upload', async () => {
      const shipmentId = await createShipment();
      await enterCargo(shipmentId);

      const res = await request(server)
        .post(`/api/v1/shipments/${shipmentId}/documents/${type}/upload`)
        .set('Authorization', `Bearer ${managerToken}`)
        .attach('file', NOT_A_PDF_BYTES, { filename: 'doc.pdf', contentType: 'application/pdf' });

      expect(res.status).toBe(422);
    });

    it('replacing the file creates a new version rather than overwriting', async () => {
      const shipmentId = await createShipment();
      await enterCargo(shipmentId);

      await request(server)
        .post(`/api/v1/shipments/${shipmentId}/documents/${type}/upload`)
        .set('Authorization', `Bearer ${managerToken}`)
        .attach('file', UPLOAD_PDF_BYTES, { filename: 'doc.pdf', contentType: 'application/pdf' });

      const second = await request(server)
        .post(`/api/v1/shipments/${shipmentId}/documents/${type}/upload`)
        .set('Authorization', `Bearer ${managerToken}`)
        .attach('file', UPLOAD_PDF_BYTES, { filename: 'doc-v2.pdf', contentType: 'application/pdf' });

      expect(second.status).toBe(201);
      expect(second.body.version).toBe(2);

      const latest = await request(server)
        .get(`/api/v1/shipments/${shipmentId}/documents/${type}`)
        .set('Authorization', `Bearer ${managerToken}`);
      expect(latest.body.version).toBe(2);
    });

    it('Director cannot upload (no documents.manage)', async () => {
      const shipmentId = await createShipment();
      await enterCargo(shipmentId);

      const res = await request(server)
        .post(`/api/v1/shipments/${shipmentId}/documents/${type}/upload`)
        .set('Authorization', `Bearer ${directorToken}`)
        .attach('file', UPLOAD_PDF_BYTES, { filename: 'doc.pdf', contentType: 'application/pdf' });

      expect(res.status).toBe(403);
    });
  });

  // --- Build order item 5: CDN — statutory SLPA format, hardest -----------
  // Security Clearance/AWB Sticker/CDN are Executive-only (direct request).
  describe('CDN (statutory SLPA format)', () => {
    it('populates from the shipment and issues a real stored PDF', async () => {
      const shipmentId = await createShipment();
      await enterCargo(shipmentId);
      await request(server)
        .post(`/api/v1/shipments/${shipmentId}/documents/CDN`)
        .set('Authorization', `Bearer ${executiveToken}`);
      await request(server)
        .patch(`/api/v1/shipments/${shipmentId}/documents/CDN`)
        .set('Authorization', `Bearer ${executiveToken}`)
        .send({ fieldData: { lorryTrailerNo: 'ABC-1234', declarantName: 'Dulanjana Madushan' } });

      const issued = await request(server)
        .post(`/api/v1/shipments/${shipmentId}/documents/CDN/issue`)
        .set('Authorization', `Bearer ${executiveToken}`);
      expect(issued.status).toBe(201);
      expect(issued.body.hasStoredFile).toBe(true);
    }, 30_000);
  });

  it('every issued document writes an audit row', async () => {
    const shipmentId = await createShipment();
    await enterCargo(shipmentId);
    await request(server)
      .post(`/api/v1/shipments/${shipmentId}/documents/AWB_STICKER`)
      .set('Authorization', `Bearer ${executiveToken}`);
    const issued = await request(server)
      .post(`/api/v1/shipments/${shipmentId}/documents/AWB_STICKER/issue`)
      .set('Authorization', `Bearer ${executiveToken}`);

    const auditRow = await prisma.auditLog.findFirst({
      where: {
        entityType: 'shipment_document',
        action: 'shipment_document.update',
        entityId: issued.body.id,
      },
    });
    expect(auditRow).not.toBeNull();
  });

  // Reachable only by a data-integrity edge case, not through any real API
  // flow (SetCargoRequest can't null out an already-set boxCount/weightKg
  // — see cargo.ts) — this is the server-side backstop for that edge case,
  // exercised the only way it can be: writing directly around the API.
  it('Print is blocked with the exact confirmed message if BOX/WEIGHT go missing on an existing DRAFT', async () => {
    const shipmentId = await createShipment();
    await enterCargo(shipmentId);
    await request(server)
      .post(`/api/v1/shipments/${shipmentId}/documents/SECURITY_CLEARANCE`)
      .set('Authorization', `Bearer ${executiveToken}`);

    await prisma.shipment.update({
      where: { id: shipmentId },
      data: { boxCount: null, weightKg: null },
    });

    const printAttempt = await request(server)
      .get(`/api/v1/shipments/${shipmentId}/documents/SECURITY_CLEARANCE/print`)
      .set('Authorization', `Bearer ${executiveToken}`);
    expect(printAttempt.status).toBe(422);
    expect(printAttempt.body.error.message).toBe(
      'Cannot generate document. Please enter Box and Weight information.',
    );
  });

  // Two Issue calls racing (double-click, or two tabs) must never both
  // succeed — exactly one Issued document, never two stored files silently
  // overwriting each other's storageKey reference.
  it('a concurrent double-Issue never produces two successes — the loser gets 423, not a silent overwrite', async () => {
    const shipmentId = await createShipment();
    await enterCargo(shipmentId);
    await request(server)
      .post(`/api/v1/shipments/${shipmentId}/documents/AWB_STICKER`)
      .set('Authorization', `Bearer ${executiveToken}`);

    const [first, second] = await Promise.all([
      request(server)
        .post(`/api/v1/shipments/${shipmentId}/documents/AWB_STICKER/issue`)
        .set('Authorization', `Bearer ${executiveToken}`),
      request(server)
        .post(`/api/v1/shipments/${shipmentId}/documents/AWB_STICKER/issue`)
        .set('Authorization', `Bearer ${executiveToken}`),
    ]);

    const statuses = [first.status, second.status].sort();
    expect(statuses).toEqual([201, 423]);

    const rows = await prisma.shipmentDocument.findMany({
      where: { shipmentId, type: 'AWB_STICKER' },
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]?.status).toBe('ISSUED');
  }, 30_000);
});
