import type { Server } from 'node:http';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaService } from '../src/prisma/prisma.service';
import { createTestApp } from './utils/create-test-app';

const DEV_PASSWORD = 'DevPassword123!';
const RUN_ID = Date.now();

/** A pseudo-unique 3-letter uppercase code, since Airport.code is now globally unique. */
function testAirportCode(salt: number): string {
  const n = (RUN_ID + salt) % (26 * 26 * 26);
  const a = String.fromCharCode(65 + Math.floor(n / (26 * 26)));
  const b = String.fromCharCode(65 + Math.floor((n / 26) % 26));
  const c = String.fromCharCode(65 + (n % 26));
  return `${a}${b}${c}`;
}

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
  const createdFlightIds: string[] = [];

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
    await prisma.flight.deleteMany({ where: { id: { in: createdFlightIds } } });
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

    it('Executive can create a shipper (masterdata.shipper.create — broader than masterdata.manage)', async () => {
      const res = await request(server)
        .post('/api/v1/masterdata/shippers')
        .set('Authorization', `Bearer ${executiveToken}`)
        .send({ name: `Exec Shipper ${RUN_ID}` });
      expect(res.status).toBe(201);
      createdShipperIds.push(res.body.id);
    });

    it("Executive cannot deactivate a shipper (that's masterdata.manage, Manager only)", async () => {
      const createRes = await request(server)
        .post('/api/v1/masterdata/shippers')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ name: `E2E Shipper Deactivate ${RUN_ID}` });
      createdShipperIds.push(createRes.body.id);

      const deleteRes = await request(server)
        .delete(`/api/v1/masterdata/shippers/${createRes.body.id}`)
        .set('Authorization', `Bearer ${executiveToken}`);
      expect(deleteRes.status).toBe(403);
    });

    it('Director cannot create a shipper (masterdata.view only)', async () => {
      const res = await request(server)
        .post('/api/v1/masterdata/shippers')
        .set('Authorization', `Bearer ${directorToken}`)
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

      const airline = await prisma.airline.create({ data: { code: 'E2', name: `E2E Airline ${RUN_ID}` } });
      createdAirlineIds.push(airline.id);
      const consignee = await prisma.consignee.create({
        data: { name: `E2E Consignee ${RUN_ID}` },
      });
      const commodity = await prisma.commodity.create({
        data: {
          name: `E2E Commodity ${RUN_ID}`,
          code: '000001',
          delayHours: new Date('1970-01-01T00:00:00.000Z'),
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
        .send({ name: `E2E Commodity Exec ${RUN_ID}`, code: '000002', delayHours: '02:00' });
      expect(res.status).toBe(201);
      createdCommodityIds.push(res.body.id);
    });

    it("Executive cannot deactivate a commodity (that's masterdata.manage, Manager only)", async () => {
      const res = await request(server)
        .post('/api/v1/masterdata/commodities')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ name: `E2E Commodity Deactivate ${RUN_ID}`, code: '000003', delayHours: '02:00' });
      createdCommodityIds.push(res.body.id);

      const deleteRes = await request(server)
        .delete(`/api/v1/masterdata/commodities/${res.body.id}`)
        .set('Authorization', `Bearer ${executiveToken}`);
      expect(deleteRes.status).toBe(403);
    });
  });

  describe('airport (destination): broader create permission, format, and one-time code', () => {
    it('Executive can create a destination (masterdata.airport.create)', async () => {
      const code = testAirportCode(1);
      const res = await request(server)
        .post('/api/v1/masterdata/airports')
        .set('Authorization', `Bearer ${executiveToken}`)
        .send({ code, name: `E2E Destination Exec ${RUN_ID}` });
      expect(res.status).toBe(201);
      expect(res.body.code).toBe(code);
      createdAirportIds.push(res.body.id);
    });

    it("Executive cannot deactivate a destination (that's masterdata.manage, Manager only)", async () => {
      const code = testAirportCode(2);
      const res = await request(server)
        .post('/api/v1/masterdata/airports')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ code, name: `E2E Destination Deactivate ${RUN_ID}` });
      createdAirportIds.push(res.body.id);

      const deleteRes = await request(server)
        .delete(`/api/v1/masterdata/airports/${res.body.id}`)
        .set('Authorization', `Bearer ${executiveToken}`);
      expect(deleteRes.status).toBe(403);
    });

    it('normalizes a lowercase code to uppercase', async () => {
      const code = testAirportCode(3);
      const res = await request(server)
        .post('/api/v1/masterdata/airports')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ code: code.toLowerCase(), name: `E2E Destination Lower ${RUN_ID}` });
      expect(res.status).toBe(201);
      expect(res.body.code).toBe(code);
      createdAirportIds.push(res.body.id);
    });

    it('rejects a code that is not exactly 3 letters', async () => {
      const res = await request(server)
        .post('/api/v1/masterdata/airports')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ code: 'AB1', name: `E2E Destination Bad Code ${RUN_ID}` });
      expect(res.status).toBe(400);
    });

    it('rejects adding the same destination code twice (one time only)', async () => {
      const code = testAirportCode(4);
      const first = await request(server)
        .post('/api/v1/masterdata/airports')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ code, name: `E2E Destination First ${RUN_ID}` });
      expect(first.status).toBe(201);
      createdAirportIds.push(first.body.id);

      const second = await request(server)
        .post('/api/v1/masterdata/airports')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ code, name: `E2E Destination Second ${RUN_ID}` });
      expect(second.status).toBe(409);
    });
  });

  /**
   * The "flight adding feature": a reusable airline + flight number +
   * confirmed departure time, added once and then selected on the Add
   * Shipment form instead of re-entering Dep Time per shipment.
   */
  describe('flight: reusable confirmed departure time', () => {
    it('Manager creates a flight with a confirmed departure time, visible to Executive via masterdata.view', async () => {
      const airline = await prisma.airline.create({ data: { code: 'EK', name: 'Emirates' } });
      createdAirlineIds.push(airline.id);

      const createRes = await request(server)
        .post('/api/v1/masterdata/flights')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ airlineId: airline.id, flightNo: '0356', depTime: '21:10' });
      expect(createRes.status).toBe(201);
      expect(createRes.body.depTime).toBe('21:10');
      expect(createRes.body.flightNo).toBe('0356');
      expect(createRes.body.airlineId).toBe(airline.id);
      createdFlightIds.push(createRes.body.id);

      const listRes = await request(server)
        .get('/api/v1/masterdata/flights')
        .set('Authorization', `Bearer ${executiveToken}`);
      expect(listRes.status).toBe(200);
      const ids = (listRes.body as { id: string }[]).map((f) => f.id);
      expect(ids).toContain(createRes.body.id);
    });

    it('Executive can create a flight (masterdata.flight.create)', async () => {
      const airline = await prisma.airline.create({ data: { code: 'QR', name: 'Qatar Airways' } });
      createdAirlineIds.push(airline.id);

      const res = await request(server)
        .post('/api/v1/masterdata/flights')
        .set('Authorization', `Bearer ${executiveToken}`)
        .send({ airlineId: airline.id, flightNo: '0786', depTime: '09:00' });
      expect(res.status).toBe(201);
      createdFlightIds.push(res.body.id);
    });

    it("Executive cannot deactivate a flight (that's masterdata.manage, Manager only)", async () => {
      const airline = await prisma.airline.create({ data: { code: 'SQ', name: 'Singapore Airlines' } });
      createdAirlineIds.push(airline.id);
      const createRes = await request(server)
        .post('/api/v1/masterdata/flights')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ airlineId: airline.id, flightNo: '0765', depTime: '14:00' });
      createdFlightIds.push(createRes.body.id);

      const deleteRes = await request(server)
        .delete(`/api/v1/masterdata/flights/${createRes.body.id}`)
        .set('Authorization', `Bearer ${executiveToken}`);
      expect(deleteRes.status).toBe(403);
    });

    it('rejects a flight number that is not exactly 4 digits', async () => {
      const airline = await prisma.airline.create({ data: { code: 'BA', name: 'British Airways' } });
      createdAirlineIds.push(airline.id);

      const res = await request(server)
        .post('/api/v1/masterdata/flights')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ airlineId: airline.id, flightNo: 'BAD1', depTime: '09:00' });
      expect(res.status).toBe(400);
    });

    it('rejects a flight with a non-24h-formatted departure time', async () => {
      const airline = await prisma.airline.create({ data: { code: 'LH', name: 'Lufthansa' } });
      createdAirlineIds.push(airline.id);

      const res = await request(server)
        .post('/api/v1/masterdata/flights')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ airlineId: airline.id, flightNo: '0111', depTime: '9:00 PM' });
      expect(res.status).toBe(400);
    });

    it('deactivating (soft delete) removes it from the default list but keeps the row', async () => {
      const airline = await prisma.airline.create({ data: { code: 'AF', name: 'Air France' } });
      createdAirlineIds.push(airline.id);
      const createRes = await request(server)
        .post('/api/v1/masterdata/flights')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ airlineId: airline.id, flightNo: '0530', depTime: '05:30' });
      const flightId = createRes.body.id as string;
      createdFlightIds.push(flightId);

      const deleteRes = await request(server)
        .delete(`/api/v1/masterdata/flights/${flightId}`)
        .set('Authorization', `Bearer ${managerToken}`);
      expect(deleteRes.status).toBe(200);
      expect(deleteRes.body.isActive).toBe(false);

      const defaultListRes = await request(server)
        .get('/api/v1/masterdata/flights')
        .set('Authorization', `Bearer ${executiveToken}`);
      expect((defaultListRes.body as { id: string }[]).map((f) => f.id)).not.toContain(flightId);

      const stillExists = await prisma.flight.findUnique({ where: { id: flightId } });
      expect(stillExists).not.toBeNull();
    });
  });

  describe('airline: broader create permission, code+name, alphanumeric code format', () => {
    it('Executive can create an airline with a code and a name (masterdata.airline.create)', async () => {
      const res = await request(server)
        .post('/api/v1/masterdata/airlines')
        .set('Authorization', `Bearer ${executiveToken}`)
        .send({ code: 'ek', name: 'Emirates' });
      expect(res.status).toBe(201);
      expect(res.body.code).toBe('EK'); // normalized to uppercase
      expect(res.body.name).toBe('Emirates');
      createdAirlineIds.push(res.body.id);
    });

    it('accepts an alphanumeric code (e.g. G9), not letters-only', async () => {
      const res = await request(server)
        .post('/api/v1/masterdata/airlines')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ code: 'g9', name: 'Air Arabia' });
      expect(res.status).toBe(201);
      expect(res.body.code).toBe('G9');
      createdAirlineIds.push(res.body.id);
    });

    it("Executive cannot deactivate an airline (that's masterdata.manage, Manager only)", async () => {
      const createRes = await request(server)
        .post('/api/v1/masterdata/airlines')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ code: 'UL', name: 'SriLankan Airlines' });
      createdAirlineIds.push(createRes.body.id);

      const deleteRes = await request(server)
        .delete(`/api/v1/masterdata/airlines/${createRes.body.id}`)
        .set('Authorization', `Bearer ${executiveToken}`);
      expect(deleteRes.status).toBe(403);
    });

    it('rejects a code that is not exactly 2 characters', async () => {
      const res = await request(server)
        .post('/api/v1/masterdata/airlines')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ code: 'EMI', name: 'Emirates' });
      expect(res.status).toBe(400);
    });

    it('rejects a missing name', async () => {
      const res = await request(server)
        .post('/api/v1/masterdata/airlines')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ code: 'EK' });
      expect(res.status).toBe(400);
    });
  });
});
