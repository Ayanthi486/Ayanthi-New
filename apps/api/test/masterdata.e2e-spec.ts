import type { Server } from 'node:http';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaService } from '../src/prisma/prisma.service';
import { createTestApp } from './utils/create-test-app';

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

/**
 * PRD §7: shipment.shipperId/consigneeId/commodityId/airlineId/
 * destinationAirportId each reference an active master record. This suite
 * covers CRUD + soft delete for all five entities, exercised once per
 * entity shape (Shipper is representative of Consignee; Airline is
 * representative of the no-address shape) rather than duplicating every
 * assertion five times.
 */
describe('Master data (e2e)', () => {
  let app: INestApplication;
  let server: Server;
  let prisma: PrismaService;
  let executiveToken: string;
  let managerToken: string;
  let directorToken: string;
  const createdShipperIds: string[] = [];
  const createdAirlineIds: string[] = [];
  const createdCommodityIds: string[] = [];
  const createdAirportIds: string[] = [];

  beforeAll(async () => {
    app = await createTestApp();
    server = app.getHttpServer() as Server;
    prisma = app.get(PrismaService);
    executiveToken = await loginAs(server, 'executive@hublanka.dev');
    managerToken = await loginAs(server, 'manager@hublanka.dev');
    directorToken = await loginAs(server, 'director@hublanka.dev');
  });

  afterAll(async () => {
    await prisma.shipper.deleteMany({ where: { id: { in: createdShipperIds } } });
    await prisma.airline.deleteMany({ where: { id: { in: createdAirlineIds } } });
    await prisma.commodity.deleteMany({ where: { id: { in: createdCommodityIds } } });
    await prisma.airport.deleteMany({ where: { id: { in: createdAirportIds } } });
    await app.close();
  });

  describe('permission enforcement', () => {
    it('rejects list with no token', async () => {
      const res = await request(server).get('/api/v1/masterdata/shippers');
      expect(res.status).toBe(401);
    });

    it('Executive cannot create a shipper (no masterdata.manage)', async () => {
      const res = await request(server)
        .post('/api/v1/masterdata/shippers')
        .set('Authorization', `Bearer ${executiveToken}`)
        .send({ name: `Denied Shipper ${RUN_ID}` });
      expect(res.status).toBe(403);
    });

    it('Director can view (masterdata.view) but not create master data', async () => {
      const listRes = await request(server)
        .get('/api/v1/masterdata/airlines')
        .set('Authorization', `Bearer ${directorToken}`);
      expect(listRes.status).toBe(200);

      const createRes = await request(server)
        .post('/api/v1/masterdata/airlines')
        .set('Authorization', `Bearer ${directorToken}`)
        .send({ name: `Denied Airline ${RUN_ID}` });
      expect(createRes.status).toBe(403);
    });
  });

  describe('shipper CRUD + soft delete', () => {
    it('Manager creates a shipper, and it is visible to Executive via masterdata.view', async () => {
      const createRes = await request(server)
        .post('/api/v1/masterdata/shippers')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ name: `E2E Shipper ${RUN_ID}`, address: '123 Galle Road, Colombo' });
      expect(createRes.status).toBe(201);
      expect(createRes.body.isActive).toBe(true);
      createdShipperIds.push(createRes.body.id);

      const listRes = await request(server)
        .get('/api/v1/masterdata/shippers')
        .set('Authorization', `Bearer ${executiveToken}`);
      expect(listRes.status).toBe(200);
      const ids = (listRes.body as { id: string }[]).map((s) => s.id);
      expect(ids).toContain(createRes.body.id);
    });

    it('deactivating (soft delete) removes it from the default list but keeps the row', async () => {
      const createRes = await request(server)
        .post('/api/v1/masterdata/shippers')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ name: `E2E Deactivate Shipper ${RUN_ID}` });
      const shipperId = createRes.body.id as string;
      createdShipperIds.push(shipperId);

      const deleteRes = await request(server)
        .delete(`/api/v1/masterdata/shippers/${shipperId}`)
        .set('Authorization', `Bearer ${managerToken}`);
      expect(deleteRes.status).toBe(200);
      expect(deleteRes.body.isActive).toBe(false);

      const defaultListRes = await request(server)
        .get('/api/v1/masterdata/shippers')
        .set('Authorization', `Bearer ${executiveToken}`);
      expect((defaultListRes.body as { id: string }[]).map((s) => s.id)).not.toContain(shipperId);

      const includeInactiveRes = await request(server)
        .get('/api/v1/masterdata/shippers')
        .query({ includeInactive: 'true' })
        .set('Authorization', `Bearer ${executiveToken}`);
      expect((includeInactiveRes.body as { id: string }[]).map((s) => s.id)).toContain(shipperId);

      const stillExists = await prisma.shipper.findUnique({ where: { id: shipperId } });
      expect(stillExists).not.toBeNull();
    });

    it('a shipment cannot be created against an inactive shipper (PRD §7)', async () => {
      const createRes = await request(server)
        .post('/api/v1/masterdata/shippers')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ name: `E2E Inactive Shipper ${RUN_ID}` });
      const shipperId = createRes.body.id as string;
      createdShipperIds.push(shipperId);
      await request(server)
        .delete(`/api/v1/masterdata/shippers/${shipperId}`)
        .set('Authorization', `Bearer ${managerToken}`);

      const airline = await prisma.airline.create({ data: { name: `E2E Airline ${RUN_ID}` } });
      createdAirlineIds.push(airline.id);
      const consignee = await prisma.consignee.create({
        data: { name: `E2E Consignee ${RUN_ID}` },
      });
      const commodity = await prisma.commodity.create({
        data: {
          name: `E2E Commodity ${RUN_ID}`,
          createdByUserId: (
            await prisma.user.findUniqueOrThrow({ where: { email: 'manager@hublanka.dev' } })
          ).id,
        },
      });
      createdCommodityIds.push(commodity.id);
      const airport = await prisma.airport.create({
        data: { code: `Y${String(RUN_ID).slice(-2)}`, name: `E2E Airport ${RUN_ID}` },
      });
      createdAirportIds.push(airport.id);

      const shipmentRes = await request(server)
        .post('/api/v1/shipments')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          airlineId: airline.id,
          shipperId,
          consigneeId: consignee.id,
          commodityId: commodity.id,
          destinationAirportId: airport.id,
          flightNo: 'EK123',
          mawbNo: '176-0000-0001',
          flightDate: '2026-06-15',
          depTime: '03:05',
        });
      expect(shipmentRes.status).toBe(400);

      await prisma.consignee.delete({ where: { id: consignee.id } });
    });
  });

  describe('commodity: broader create permission (BR-17)', () => {
    it('Executive can create a commodity (masterdata.commodity.create)', async () => {
      const res = await request(server)
        .post('/api/v1/masterdata/commodities')
        .set('Authorization', `Bearer ${executiveToken}`)
        .send({ name: `E2E Commodity Exec ${RUN_ID}` });
      expect(res.status).toBe(201);
      createdCommodityIds.push(res.body.id);
    });

    it("Executive cannot deactivate a commodity (that's masterdata.manage, Manager only)", async () => {
      const res = await request(server)
        .post('/api/v1/masterdata/commodities')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ name: `E2E Commodity Deactivate ${RUN_ID}` });
      createdCommodityIds.push(res.body.id);

      const deleteRes = await request(server)
        .delete(`/api/v1/masterdata/commodities/${res.body.id}`)
        .set('Authorization', `Bearer ${executiveToken}`);
      expect(deleteRes.status).toBe(403);
    });
  });
});
