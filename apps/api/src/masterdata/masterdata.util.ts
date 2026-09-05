import type { Airline, Airport, Commodity, Shipper } from '@hub-lanka/shared';

interface NameActiveRow {
  id: string;
  name: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export function toShipper(row: NameActiveRow & { address: string | null }): Shipper {
  return {
    id: row.id,
    name: row.name,
    address: row.address,
    isActive: row.isActive,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export const toConsignee = toShipper;

export function toAirline(row: NameActiveRow): Airline {
  return {
    id: row.id,
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

export function toCommodity(row: NameActiveRow & { createdByUserId: string }): Commodity {
  return {
    id: row.id,
    name: row.name,
    isActive: row.isActive,
    createdByUserId: row.createdByUserId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
