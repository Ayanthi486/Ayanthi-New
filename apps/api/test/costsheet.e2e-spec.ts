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

interface TestCostSheet {
  id: string;
  shipmentId: string;
  status: 'DRAFT' | 'RELEASED' | 'APPROVED';
  total: string;
  version: number;
  approvedByUserId: string | null;
  approvedAt: string | null;
}

describe('Cost Sheet (e2e)', () => {
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
    masterData = await createTestMasterData(prisma, manager.id, `cs${RUN_ID}`);
  });

  afterAll(async () => {
    await prisma.costSheetLine.deleteMany({
      where: { costSheet: { shipmentId: { in: createdShipmentIds } } },
    });
    await prisma.costSheet.deleteMany({ where: { shipmentId: { in: createdShipmentIds } } });
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
        depTime: '03:05',
      });
    expect(res.status).toBe(201);
    createdShipmentIds.push(res.body.id as string);
    return res.body.id as string;
  }

  async function createCostSheet(token: string, shipmentId: string): Promise<TestCostSheet> {
    const res = await request(server)
      .post('/api/v1/costsheets')
      .set('Authorization', `Bearer ${token}`)
      .send({ shipmentId, snNo: `SN-${RUN_ID}` });
    expect(res.status).toBe(201);
    return res.body as TestCostSheet;
  }

  it('rejects create with no token', async () => {
    const res = await request(server).post('/api/v1/costsheets').send({});
    expect(res.status).toBe(401);
  });

  it('Director cannot prepare a Cost Sheet (no costsheet.prepare)', async () => {
    const shipmentId = await createShipment(directorToken);
    const res = await request(server)
      .post('/api/v1/costsheets')
      .set('Authorization', `Bearer ${directorToken}`)
      .send({ shipmentId });
    expect(res.status).toBe(403);
  });

  it('Director can view a Cost Sheet (costsheet.view)', async () => {
    const shipmentId = await createShipment(executiveToken);
    await createCostSheet(executiveToken, shipmentId);

    const res = await request(server)
      .get(`/api/v1/costsheets/by-shipment/${shipmentId}`)
      .set('Authorization', `Bearer ${directorToken}`);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('DRAFT');
  });

  it('rejects a second Cost Sheet for the same shipment', async () => {
    const shipmentId = await createShipment(executiveToken);
    await createCostSheet(executiveToken, shipmentId);

    const res = await request(server)
      .post('/api/v1/costsheets')
      .set('Authorization', `Bearer ${executiveToken}`)
      .send({ shipmentId });
    expect(res.status).toBe(409);
  });

  it('a new Cost Sheet has all 11 lines present and empty, total 0.00', async () => {
    const shipmentId = await createShipment(executiveToken);
    const costSheet = await createCostSheet(executiveToken, shipmentId);

    const res = await request(server)
      .get(`/api/v1/costsheets/${costSheet.id}`)
      .set('Authorization', `Bearer ${executiveToken}`);
    expect(res.body.lines).toHaveLength(11);
    expect(res.body.lines.every((l: { amount: string | null }) => l.amount === null)).toBe(true);
    expect(res.body.total).toBe('0.00');
  });

  // --- Reconciliation: DEVELOPMENT_PLAN.md Phase 4's company sample -----
  it('reconciles the company reference total: 1,800.00 + 12,209.54 + 1,300 + 1,000 + 1,320 = 17,629.54', async () => {
    const shipmentId = await createShipment(executiveToken);
    const costSheet = await createCostSheet(executiveToken, shipmentId);

    const res = await request(server)
      .patch(`/api/v1/costsheets/${costSheet.id}`)
      .set('Authorization', `Bearer ${executiveToken}`)
      .send({
        version: 0,
        lines: {
          SL_CUSTOMS_RECEIPTS: '1800.00',
          TRANSPORT: '12209.54',
          LABOUR: '1300',
          INSPECTION: '1000',
          OPERATIONAL: '1320',
        },
      });
    expect(res.status).toBe(200);
    expect(res.body.total).toBe('17629.54');
  });

  // --- AC-15: cannot approve before release; approval records a signature ---
  describe('release -> approve workflow (AC-15, BR-59/60/61)', () => {
    it('Executive cannot approve directly, and cannot approve before release', async () => {
      const shipmentId = await createShipment(executiveToken);
      const costSheet = await createCostSheet(executiveToken, shipmentId);

      const executiveApprove = await request(server)
        .post(`/api/v1/costsheets/${costSheet.id}/approve`)
        .set('Authorization', `Bearer ${executiveToken}`);
      expect(executiveApprove.status).toBe(403);

      const managerApproveBeforeRelease = await request(server)
        .post(`/api/v1/costsheets/${costSheet.id}/approve`)
        .set('Authorization', `Bearer ${managerToken}`);
      expect(managerApproveBeforeRelease.status).toBe(422);
    });

    it('Executive releases; both Executive and Manager can edit after release', async () => {
      const shipmentId = await createShipment(executiveToken);
      const costSheet = await createCostSheet(executiveToken, shipmentId);

      const releaseRes = await request(server)
        .post(`/api/v1/costsheets/${costSheet.id}/release`)
        .set('Authorization', `Bearer ${executiveToken}`);
      expect(releaseRes.status).toBe(201);
      expect(releaseRes.body.status).toBe('RELEASED');

      const executiveEdit = await request(server)
        .patch(`/api/v1/costsheets/${costSheet.id}`)
        .set('Authorization', `Bearer ${executiveToken}`)
        .send({ version: 0, remarks: 'Executive correction after release' });
      expect(executiveEdit.status).toBe(200);
      expect(executiveEdit.body.remarks).toBe('Executive correction after release');

      const managerEdit = await request(server)
        .patch(`/api/v1/costsheets/${costSheet.id}`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ version: 1, remarks: 'Manager correction after release' });
      expect(managerEdit.status).toBe(200);
      expect(managerEdit.body.remarks).toBe('Manager correction after release');
    });

    it('Manager approves a Released Cost Sheet, recording who and when', async () => {
      const shipmentId = await createShipment(executiveToken);
      const costSheet = await createCostSheet(executiveToken, shipmentId);
      await request(server)
        .post(`/api/v1/costsheets/${costSheet.id}/release`)
        .set('Authorization', `Bearer ${executiveToken}`);

      const approveRes = await request(server)
        .post(`/api/v1/costsheets/${costSheet.id}/approve`)
        .set('Authorization', `Bearer ${managerToken}`);
      expect(approveRes.status).toBe(201);
      expect(approveRes.body.status).toBe('APPROVED');
      expect(approveRes.body.approvedByUserId).not.toBeNull();
      expect(approveRes.body.approvedAt).not.toBeNull();

      const auditRow = await prisma.auditLog.findFirst({
        where: { entityType: 'cost_sheet', action: 'cost_sheet.update', entityId: costSheet.id },
        orderBy: { createdAt: 'desc' },
      });
      expect(auditRow).not.toBeNull();
      expect((auditRow?.after as { status: string } | null)?.status).toBe('APPROVED');
    });

    it('an Approved Cost Sheet rejects Executive edits (423) but Manager can still edit', async () => {
      const shipmentId = await createShipment(executiveToken);
      const costSheet = await createCostSheet(executiveToken, shipmentId);
      await request(server)
        .post(`/api/v1/costsheets/${costSheet.id}/release`)
        .set('Authorization', `Bearer ${executiveToken}`);
      await request(server)
        .post(`/api/v1/costsheets/${costSheet.id}/approve`)
        .set('Authorization', `Bearer ${managerToken}`);

      const executiveEdit = await request(server)
        .patch(`/api/v1/costsheets/${costSheet.id}`)
        .set('Authorization', `Bearer ${executiveToken}`)
        .send({ version: 0, remarks: 'too late' });
      expect(executiveEdit.status).toBe(423);

      const managerEdit = await request(server)
        .patch(`/api/v1/costsheets/${costSheet.id}`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ version: 0, remarks: 'Manager correction after approval' });
      expect(managerEdit.status).toBe(200);
      expect(managerEdit.body.remarks).toBe('Manager correction after approval');
    });
  });

  it('a stale version on PATCH returns 409 with the exact confirmed message', async () => {
    const shipmentId = await createShipment(executiveToken);
    const costSheet = await createCostSheet(executiveToken, shipmentId);

    const firstEdit = await request(server)
      .patch(`/api/v1/costsheets/${costSheet.id}`)
      .set('Authorization', `Bearer ${executiveToken}`)
      .send({ version: 0, remarks: 'first' });
    expect(firstEdit.status).toBe(200);
    expect(firstEdit.body.version).toBe(1);

    const staleEdit = await request(server)
      .patch(`/api/v1/costsheets/${costSheet.id}`)
      .set('Authorization', `Bearer ${executiveToken}`)
      .send({ version: 0, remarks: 'stale' });
    expect(staleEdit.status).toBe(409);
    expect(staleEdit.body.error.message).toBe(
      'This shipment was updated by another user. Please review the latest information before saving.',
    );
  });

  it('every mutating action writes an audit row inside the same transaction', async () => {
    const shipmentId = await createShipment(executiveToken);
    const costSheet = await createCostSheet(executiveToken, shipmentId);

    const auditRow = await prisma.auditLog.findFirst({
      where: { entityType: 'cost_sheet', action: 'cost_sheet.create', entityId: costSheet.id },
    });
    expect(auditRow).not.toBeNull();
    expect(auditRow?.actorUserId).not.toBeNull();
  });
});
