import type { PrismaService } from '../../src/prisma/prisma.service';

export interface TestMasterData {
  airlineId: string;
  shipperId: string;
  consigneeId: string;
  commodityId: string;
  airportId: string;
}

/** Creates one of each master-data entity directly via Prisma (bypassing the API — these tests exercise shipment/cargo/rates, not masterdata CRUD itself). */
export async function createTestMasterData(
  prisma: PrismaService,
  createdByUserId: string,
  suffix: string,
): Promise<TestMasterData> {
  const [airline, shipper, consignee, commodity, airport] = await Promise.all([
    prisma.airline.create({
      data: { code: `E${suffix.slice(-1)}`.toUpperCase(), name: `E2E Airline ${suffix}` },
    }),
    prisma.shipper.create({ data: { name: `E2E Shipper ${suffix}` } }),
    prisma.consignee.create({ data: { name: `E2E Consignee ${suffix}` } }),
    prisma.commodity.create({
      data: {
        name: `E2E Commodity ${suffix}`,
        code: '000001',
        delayHours: new Date('1970-01-01T00:00:00.000Z'),
        createdByUserId,
      },
    }),
    prisma.airport.create({
      data: { code: `X${suffix.slice(-2)}`, name: `E2E Airport ${suffix}` },
    }),
  ]);

  return {
    airlineId: airline.id,
    shipperId: shipper.id,
    consigneeId: consignee.id,
    commodityId: commodity.id,
    airportId: airport.id,
  };
}

export async function deleteTestMasterData(
  prisma: PrismaService,
  data: TestMasterData,
): Promise<void> {
  await prisma.rateTable.deleteMany({ where: { airlineId: data.airlineId } });
  await prisma.airline.deleteMany({ where: { id: data.airlineId } });
  await prisma.shipper.deleteMany({ where: { id: data.shipperId } });
  await prisma.consignee.deleteMany({ where: { id: data.consigneeId } });
  await prisma.commodity.deleteMany({ where: { id: data.commodityId } });
  await prisma.airport.deleteMany({ where: { id: data.airportId } });
}
