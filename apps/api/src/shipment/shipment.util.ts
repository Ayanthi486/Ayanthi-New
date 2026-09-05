import type { Shipment as SharedShipment, ShipmentStatus } from '@hub-lanka/shared';

export interface ShipmentRow {
  id: string;
  shipmentNo: string;
  mawbNo: string | null;
  houseAwbNo: string | null;
  airlineId: string;
  airline: { name: string };
  flightNo: string | null;
  destinationAirportId: string | null;
  destinationAirport: { code: string } | null;
  shipperId: string;
  shipper: { name: string };
  consigneeId: string;
  consignee: { name: string };
  commodityId: string;
  commodity: { name: string };
  flightDate: Date;
  handlingDate: Date | null;
  depTime: Date;
  cusdecNo: string | null;
  boxCount: number | null;
  weightKg: { toString(): string } | null;
  appliedBuyingRate: { toString(): string } | null;
  appliedBuyingRateId: string | null;
  actualDepartureAt: Date | null;
  status: ShipmentStatus;
  version: number;
  createdByUserId: string;
  createdAt: Date;
  updatedAt: Date;
}

/** Shared by shipment/cargo services so a shipment read always resolves its master-data names the same way. */
export const SHIPMENT_WITH_NAMES_INCLUDE = {
  airline: { select: { name: true } },
  shipper: { select: { name: true } },
  consignee: { select: { name: true } },
  commodity: { select: { name: true } },
  destinationAirport: { select: { code: true } },
} as const;

/** ARCHITECTURE §20's exact confirmed message — the frontend branches on this. Shared by shipment/cargo services since both do the same optimistic-lock check. */
export const OPTIMISTIC_LOCK_CONFLICT_MESSAGE =
  'This shipment was updated by another user. Please review the latest information before saving.';

/** Fixed, no-DST offset — Sri Lanka has used UTC+5:30 year-round since 1996. */
export const COLOMBO_OFFSET_MS = (5 * 60 + 30) * 60_000;

/** `YYYY-MM-DD` for the current calendar date in Asia/Colombo (BR-15). */
export function colomboToday(): string {
  return new Date(Date.now() + COLOMBO_OFFSET_MS).toISOString().slice(0, 10);
}

export function addDays(dateOnly: string, days: number): string {
  const date = new Date(`${dateOnly}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** Parses a `YYYY-MM-DD` wire value into the UTC-midnight Date Prisma's `@db.Date` expects. */
export function parseDateOnly(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

/** Parses a 24-hour `HH:mm` wire value into the Date Prisma's `@db.Time` expects. */
export function parseTime24(value: string): Date {
  return new Date(`1970-01-01T${value}:00.000Z`);
}

function formatDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function formatTime24(date: Date): string {
  return date.toISOString().slice(11, 16);
}

export function toSharedShipment(row: ShipmentRow): SharedShipment {
  return {
    id: row.id,
    shipmentNo: row.shipmentNo,
    mawbNo: row.mawbNo,
    houseAwbNo: row.houseAwbNo,
    airlineId: row.airlineId,
    airlineName: row.airline.name,
    flightNo: row.flightNo,
    destinationAirportId: row.destinationAirportId,
    destinationAirportCode: row.destinationAirport ? row.destinationAirport.code : null,
    shipperId: row.shipperId,
    shipperName: row.shipper.name,
    consigneeId: row.consigneeId,
    consigneeName: row.consignee.name,
    commodityId: row.commodityId,
    commodityName: row.commodity.name,
    flightDate: formatDateOnly(row.flightDate),
    handlingDate: row.handlingDate ? formatDateOnly(row.handlingDate) : null,
    depTime: formatTime24(row.depTime),
    cusdecNo: row.cusdecNo,
    boxCount: row.boxCount,
    weightKg: row.weightKg ? row.weightKg.toString() : null,
    appliedBuyingRate: row.appliedBuyingRate ? row.appliedBuyingRate.toString() : null,
    appliedBuyingRateId: row.appliedBuyingRateId,
    actualDepartureAt: row.actualDepartureAt ? row.actualDepartureAt.toISOString() : null,
    status: row.status,
    version: row.version,
    createdByUserId: row.createdByUserId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
