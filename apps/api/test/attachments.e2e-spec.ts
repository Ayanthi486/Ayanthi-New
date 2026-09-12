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

const PDF_BYTES = Buffer.from('%PDF-1.4\n%fake attachment for e2e testing\n');
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

/** Free-form supporting files for a shipment — no fieldData/issue workflow, no box/weight readiness gate, any number per shipment. */
describe('Attachments (e2e)', () => {
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
    masterData = await createTestMasterData(prisma, manager.id, `at${RUN_ID}`);
  });

  afterAll(async () => {
    await prisma.shipmentAttachment.deleteMany({
      where: { shipmentId: { in: createdShipmentIds } },
    });
    await prisma.cutoffAlert.deleteMany({ where: { shipmentId: { in: createdShipmentIds } } });
    await prisma.shipment.deleteMany({ where: { id: { in: createdShipmentIds } } });
    await deleteTestMasterData(prisma, masterData);
    await app.close();
  });

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
        depTime: '03:05',
      });
    expect(res.status).toBe(201);
    createdShipmentIds.push(res.body.id as string);
    return res.body.id as string;
  }

  it('rejects with no token', async () => {
    const res = await request(server).get('/api/v1/shipments/does-not-matter/attachments');
    expect(res.status).toBe(401);
  });

  it('a new shipment has no attachments yet — no box/weight required', async () => {
    const shipmentId = await createShipment();
    const res = await request(server)
      .get(`/api/v1/shipments/${shipmentId}/attachments`)
      .set('Authorization', `Bearer ${executiveToken}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('uploads a PDF, lists it, and downloads it back', async () => {
    const shipmentId = await createShipment();

    const uploaded = await request(server)
      .post(`/api/v1/shipments/${shipmentId}/attachments`)
      .set('Authorization', `Bearer ${executiveToken}`)
      .attach('file', PDF_BYTES, { filename: 'customs-form.pdf', contentType: 'application/pdf' });
    expect(uploaded.status).toBe(201);
    expect(uploaded.body.filename).toBe('customs-form.pdf');
    expect(uploaded.body.contentType).toBe('application/pdf');

    const listed = await request(server)
      .get(`/api/v1/shipments/${shipmentId}/attachments`)
      .set('Authorization', `Bearer ${executiveToken}`);
    expect(listed.status).toBe(200);
    expect(listed.body).toHaveLength(1);
    expect(listed.body[0].id).toBe(uploaded.body.id);

    const fileRes = await request(server)
      .get(`/api/v1/attachments/${uploaded.body.id}/file`)
      .set('Authorization', `Bearer ${executiveToken}`);
    expect(fileRes.status).toBe(200);
  });

  it('accepts a PNG as well as a PDF', async () => {
    const shipmentId = await createShipment();
    const res = await request(server)
      .post(`/api/v1/shipments/${shipmentId}/attachments`)
      .set('Authorization', `Bearer ${executiveToken}`)
      .attach('file', PNG_BYTES, { filename: 'scan.png', contentType: 'image/png' });
    expect(res.status).toBe(201);
    expect(res.body.contentType).toBe('image/png');
  });

  it('rejects a file whose content does not match its declared type', async () => {
    const shipmentId = await createShipment();
    const res = await request(server)
      .post(`/api/v1/shipments/${shipmentId}/attachments`)
      .set('Authorization', `Bearer ${executiveToken}`)
      .attach('file', NOT_A_PDF_BYTES, {
        filename: 'fake.pdf',
        contentType: 'application/pdf',
      });
    expect(res.status).toBe(422);
  });

  it('supports several attachments on the same shipment, each independently removable', async () => {
    const shipmentId = await createShipment();
    const first = await request(server)
      .post(`/api/v1/shipments/${shipmentId}/attachments`)
      .set('Authorization', `Bearer ${managerToken}`)
      .attach('file', PDF_BYTES, { filename: 'a.pdf', contentType: 'application/pdf' });
    const second = await request(server)
      .post(`/api/v1/shipments/${shipmentId}/attachments`)
      .set('Authorization', `Bearer ${managerToken}`)
      .attach('file', PNG_BYTES, { filename: 'b.png', contentType: 'image/png' });

    const listedBoth = await request(server)
      .get(`/api/v1/shipments/${shipmentId}/attachments`)
      .set('Authorization', `Bearer ${managerToken}`);
    expect(listedBoth.body).toHaveLength(2);

    const deleteRes = await request(server)
      .delete(`/api/v1/attachments/${first.body.id}`)
      .set('Authorization', `Bearer ${managerToken}`);
    expect(deleteRes.status).toBe(200);

    const listedAfter = await request(server)
      .get(`/api/v1/shipments/${shipmentId}/attachments`)
      .set('Authorization', `Bearer ${managerToken}`);
    expect(listedAfter.body).toHaveLength(1);
    expect(listedAfter.body[0].id).toBe(second.body.id);
  });

  it('Director can view attachments (documents.view.readonly) but cannot upload or delete', async () => {
    const shipmentId = await createShipment();
    const uploaded = await request(server)
      .post(`/api/v1/shipments/${shipmentId}/attachments`)
      .set('Authorization', `Bearer ${managerToken}`)
      .attach('file', PDF_BYTES, { filename: 'a.pdf', contentType: 'application/pdf' });

    const listRes = await request(server)
      .get(`/api/v1/shipments/${shipmentId}/attachments`)
      .set('Authorization', `Bearer ${directorToken}`);
    expect(listRes.status).toBe(200);

    const uploadAttempt = await request(server)
      .post(`/api/v1/shipments/${shipmentId}/attachments`)
      .set('Authorization', `Bearer ${directorToken}`)
      .attach('file', PDF_BYTES, { filename: 'a.pdf', contentType: 'application/pdf' });
    expect(uploadAttempt.status).toBe(403);

    const deleteAttempt = await request(server)
      .delete(`/api/v1/attachments/${uploaded.body.id}`)
      .set('Authorization', `Bearer ${directorToken}`);
    expect(deleteAttempt.status).toBe(403);
  });

  it('every attachment upload and delete writes an audit row', async () => {
    const shipmentId = await createShipment();
    const uploaded = await request(server)
      .post(`/api/v1/shipments/${shipmentId}/attachments`)
      .set('Authorization', `Bearer ${managerToken}`)
      .attach('file', PDF_BYTES, { filename: 'a.pdf', contentType: 'application/pdf' });

    const createRow = await prisma.auditLog.findFirst({
      where: {
        entityType: 'shipment_attachment',
        action: 'shipment_attachment.create',
        entityId: uploaded.body.id,
      },
    });
    expect(createRow).not.toBeNull();

    await request(server)
      .delete(`/api/v1/attachments/${uploaded.body.id}`)
      .set('Authorization', `Bearer ${managerToken}`);

    const deleteRow = await prisma.auditLog.findFirst({
      where: {
        entityType: 'shipment_attachment',
        action: 'shipment_attachment.delete',
        entityId: uploaded.body.id,
      },
    });
    expect(deleteRow).not.toBeNull();
  });
});
