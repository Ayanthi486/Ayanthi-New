import type { RateTableEntry } from '@hub-lanka/shared';

export interface RateTableRow {
  id: string;
  airlineId: string;
  airline: { name: string };
  rateUsdPerKg: { toString(): string };
  effectiveFrom: Date;
  effectiveTo: Date | null;
  createdByUserId: string;
  createdAt: Date;
}

function formatDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Parses a `YYYY-MM-DD` wire value into the UTC-midnight Date Prisma's `@db.Date` expects. */
export function parseDateOnly(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

export function toRateTableEntry(row: RateTableRow): RateTableEntry {
  return {
    id: row.id,
    airlineId: row.airlineId,
    airlineName: row.airline.name,
    rateUsdPerKg: row.rateUsdPerKg.toString(),
    effectiveFrom: formatDateOnly(row.effectiveFrom),
    effectiveTo: row.effectiveTo ? formatDateOnly(row.effectiveTo) : null,
    createdByUserId: row.createdByUserId,
    createdAt: row.createdAt.toISOString(),
  };
}
