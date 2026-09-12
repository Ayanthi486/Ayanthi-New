import type { Shipment as SharedShipment, ServiceType, ShipmentStatus } from '@hub-lanka/shared';

export interface ShipmentRow {
  id: string;
  shipmentNo: string;
  mawbNo: string | null;
  houseAwbNo: string | null;
  airlineId: string;
  airline: { code: string; name: string };
  flightNo: string | null;
  destinationAirportId: string | null;
  destinationAirport: { code: string } | null;
  shipperId: string;
  shipper: { name: string; address: string | null; contact: string | null };
  consigneeId: string;
  consignee: { name: string; address: string | null; contact: string | null };
  commodityId: string;
  commodity: { name: string; delayHours: Date };
  serviceType: ServiceType;
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
  airline: { select: { code: true, name: true } },
  shipper: { select: { name: true, address: true, contact: true } },
  consignee: { select: { name: true, address: true, contact: true } },
  commodity: { select: { name: true, delayHours: true } },
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

/**
 * Parses a `datetime-local`-shaped wire value (`YYYY-MM-DDTHH:mm`, no
 * timezone) as Asia/Colombo wall-clock time into the true UTC instant it
 * represents — same convention/offset as `cutoff.util.ts`'s
 * `combineFlightDateAndDepTime`, used here for the actual-departure
 * timestamp captured when a shipment's status changes to Departed.
 */
export function parseColomboDateTime(value: string): Date {
  const colomboWallClockAsUtc = new Date(`${value}:00.000Z`);
  return new Date(colomboWallClockAsUtc.getTime() - COLOMBO_OFFSET_MS);
}

function formatDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function formatTime24(date: Date): string {
  return date.toISOString().slice(11, 16);
}

/**
 * Cut-off Time = the shipment's Dep Time minus its Commodity's Delay Hours
 * (e.g. Dep Time 20:00 - Delay Hours 05:00 = Cut-off Time 15:00) — a plain
 * HH:mm wall-clock value, wrapping across midnight like a clock rather than
 * carrying a date component (02:00 - 05:00 = 21:00).
 */
export function computeCutoffTime(depTime: Date, delayHours: Date): string {
  const depMinutes = depTime.getUTCHours() * 60 + depTime.getUTCMinutes();
  const delayMinutes = delayHours.getUTCHours() * 60 + delayHours.getUTCMinutes();
  const cutoffMinutes = (((depMinutes - delayMinutes) % 1440) + 1440) % 1440;
  const hours = Math.floor(cutoffMinutes / 60)
    .toString()
    .padStart(2, '0');
  const minutes = (cutoffMinutes % 60).toString().padStart(2, '0');
  return `${hours}:${minutes}`;
}

export function toSharedShipment(row: ShipmentRow): SharedShipment {
  return {
    id: row.id,
    shipmentNo: row.shipmentNo,
    mawbNo: row.mawbNo,
    houseAwbNo: row.houseAwbNo,
    airlineId: row.airlineId,
    airlineCode: row.airline.code,
    airlineName: row.airline.name,
    flightNo: row.flightNo,
    destinationAirportId: row.destinationAirportId,
    destinationAirportCode: row.destinationAirport ? row.destinationAirport.code : null,
    shipperId: row.shipperId,
    shipperName: row.shipper.name,
    shipperAddress: row.shipper.address,
    shipperContact: row.shipper.contact,
    consigneeId: row.consigneeId,
    consigneeName: row.consignee.name,
    consigneeAddress: row.consignee.address,
    consigneeContact: row.consignee.contact,
    commodityId: row.commodityId,
    commodityName: row.commodity.name,
    serviceType: row.serviceType,
    flightDate: formatDateOnly(row.flightDate),
    handlingDate: row.handlingDate ? formatDateOnly(row.handlingDate) : null,
    depTime: formatTime24(row.depTime),
    cutoffTime: computeCutoffTime(row.depTime, row.commodity.delayHours),
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
