import type { CostSheet as SharedCostSheet, CostSheetLineType } from '@hub-lanka/shared';
import { Prisma } from '../generated/prisma/client';

export interface CostSheetLineRow {
  lineType: CostSheetLineType;
  amount: { toString(): string } | null;
}

export interface CostSheetRow {
  id: string;
  shipmentId: string;
  shipment: { shipmentNo: string };
  snNo: string | null;
  status: 'DRAFT' | 'RELEASED' | 'APPROVED';
  remarks: string | null;
  shiftLeaderSignature: string | null;
  version: number;
  createdByUserId: string;
  releasedByUserId: string | null;
  releasedAt: Date | null;
  approvedByUserId: string | null;
  approvedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  lines: CostSheetLineRow[];
}

/**
 * Decimal-safe sum, never a JS `number` (DEVELOPMENT_RULES §5) — computed
 * on read, never stored as its own column (ARCHITECTURE §25's "derived
 * values are computed, not stored", same as remaining balance/profit).
 */
export function sumAmounts(lines: CostSheetLineRow[]): string {
  const total = lines.reduce(
    (sum, line) => (line.amount ? sum.plus(line.amount.toString()) : sum),
    new Prisma.Decimal(0),
  );
  return total.toFixed(2);
}

export function toSharedCostSheet(row: CostSheetRow): SharedCostSheet {
  return {
    id: row.id,
    shipmentId: row.shipmentId,
    shipmentNo: row.shipment.shipmentNo,
    snNo: row.snNo,
    status: row.status,
    remarks: row.remarks,
    shiftLeaderSignature: row.shiftLeaderSignature,
    lines: row.lines.map((line) => ({
      lineType: line.lineType,
      amount: line.amount ? line.amount.toString() : null,
    })),
    total: sumAmounts(row.lines),
    version: row.version,
    createdByUserId: row.createdByUserId,
    releasedByUserId: row.releasedByUserId,
    releasedAt: row.releasedAt ? row.releasedAt.toISOString() : null,
    approvedByUserId: row.approvedByUserId,
    approvedAt: row.approvedAt ? row.approvedAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
