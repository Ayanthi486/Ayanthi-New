import { describe, expect, it } from 'vitest';
import { sumAmounts, toSharedCostSheet, type CostSheetRow } from './costsheet.util';

describe('costsheet.util', () => {
  describe('sumAmounts', () => {
    it('reconciles the company reference figure: 1,800.00 + 12,209.54 + 1,300 + 1,000 + 1,320 = 17,629.54', () => {
      const lines = [
        { lineType: 'SL_CUSTOMS_RECEIPTS' as const, amount: { toString: () => '1800.00' } },
        { lineType: 'TRANSPORT' as const, amount: { toString: () => '12209.54' } },
        { lineType: 'LABOUR' as const, amount: { toString: () => '1300' } },
        { lineType: 'INSPECTION' as const, amount: { toString: () => '1000' } },
        { lineType: 'OPERATIONAL' as const, amount: { toString: () => '1320' } },
        { lineType: 'OTHER' as const, amount: null },
      ];

      expect(sumAmounts(lines)).toBe('17629.54');
    });

    it('treats null lines as zero, not an error', () => {
      const lines = [
        { lineType: 'SL_CUSTOMS_RECEIPTS' as const, amount: null },
        { lineType: 'TRANSPORT' as const, amount: null },
      ];
      expect(sumAmounts(lines)).toBe('0.00');
    });
  });

  describe('toSharedCostSheet', () => {
    const baseRow: CostSheetRow = {
      id: 'cs-1',
      shipmentId: 'shipment-1',
      shipment: { shipmentNo: 'HUB 000001' },
      snNo: 'SN-42',
      status: 'DRAFT',
      remarks: null,
      shiftLeaderSignature: null,
      version: 0,
      createdByUserId: 'user-1',
      releasedByUserId: null,
      releasedAt: null,
      approvedByUserId: null,
      approvedAt: null,
      createdAt: new Date('2026-06-01T00:00:00.000Z'),
      updatedAt: new Date('2026-06-02T00:00:00.000Z'),
      lines: [{ lineType: 'TRANSPORT', amount: { toString: () => '1234.50' } }],
    };

    it('denormalizes the shipment number and computes total', () => {
      const shared = toSharedCostSheet(baseRow);
      expect(shared.shipmentNo).toBe('HUB 000001');
      expect(shared.total).toBe('1234.50');
      expect(shared.lines[0]).toEqual({ lineType: 'TRANSPORT', amount: '1234.50' });
    });
  });
});
