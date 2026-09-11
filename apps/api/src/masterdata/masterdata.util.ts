import type { Airline, Airport, Commodity, Flight, Shipper } from '@hub-lanka/shared';
import { formatTime24 } from '../shipment/shipment.util';

interface NameActiveRow {
  id: string;
  name: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export function toShipper(
  row: NameActiveRow & { address: string | null; contact: string | null },
): Shipper {
  return {
    id: row.id,
    name: row.name,
    address: row.address,
    contact: row.contact,
    isActive: row.isActive,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export const toConsignee = toShipper;

export function toAirline(row: NameActiveRow & { code: string }): Airline {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    isActive: row.isActive,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toAirport(row: NameActiveRow & { code: string }): Airport {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    isActive: row.isActive,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toCommodity(
  row: NameActiveRow & { code: string; delayHours: Date; createdByUserId: string },
): Commodity {
  return {
    id: row.id,
    name: row.name,
    code: row.code,
    delayHours: formatTime24(row.delayHours),
    isActive: row.isActive,
    createdByUserId: row.createdByUserId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toFlight(
  row: {
    id: string;
    airlineId: string;
    airline: { name: string };
    flightNo: string;
    depTime: Date;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
  },
): Flight {
  return {
    id: row.id,
    airlineId: row.airlineId,
    airlineName: row.airline.name,
    flightNo: row.flightNo,
    depTime: formatTime24(row.depTime),
    isActive: row.isActive,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
