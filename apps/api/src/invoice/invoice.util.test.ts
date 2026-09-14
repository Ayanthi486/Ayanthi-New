import { describe, expect, it } from 'vitest';
import { Prisma } from '../generated/prisma/client';
import {
  computeAirlineBuyingCost,
  computeDueDate,
  computeLineAmounts,
  computeTotals,
  toSharedInvoice,
  type InvoiceRow,
} from './invoice.util';

/**
 * The real invoice's five lines (AWB 157 0659 8944,
 * references/company-process/invoice.pdf). Security's rate is PRD §8's
 * stated true precision (36.2594); see the test below for why its LKR
 * figure has a known ~1-cent gap against the one real specimen.
 */
const REAL_LINES = [
  { description: 'FREIGHT CHARGES', weightBasis: 'CHARGEABLE' as const, rateUsd: '4.75' },
  { description: 'MAWB FEE', weightBasis: 'FLAT' as const, rateUsd: '26.50' },
  // Displays as 0.02 on the invoice but computes at the true 0.021 (PRD §8's precision warning).
  { description: 'SCREENING CHARGES', weightBasis: 'GROSS' as const, rateUsd: '0.021' },
  { description: 'HANDLING CHARGES', weightBasis: 'FLAT' as const, rateUsd: '35.00' },
  { description: 'SECURITY CHARGES', weightBasis: 'FLAT' as const, rateUsd: '36.2594' },
];

describe('invoice.util', () => {
  describe('computeLineAmounts — AC-13', () => {
    it('reproduces four of the real invoice lines exactly, including the Screening precision trap', () => {
      const context = {
        chargeableWeightKg: '500.00',
        grossWeightKg: '444.50',
        exchangeRate: '340.50',
      };

      const freight = computeLineAmounts({
        weightBasis: 'CHARGEABLE',
        rateUsd: '4.75',
        ...context,
      });
      expect(freight.amountUsd.toFixed(2)).toBe('2375.00');
      expect(freight.amountLkr.toFixed(2)).toBe('808687.50');

      const mawbFee = computeLineAmounts({ weightBasis: 'FLAT', rateUsd: '26.50', ...context });
      expect(mawbFee.amountUsd.toFixed(2)).toBe('26.50');
      expect(mawbFee.amountLkr.toFixed(2)).toBe('9023.25');

      // The precision trap: 444.50 x 0.021 = 9.3345 -> USD rounds to 9.33 (not 8.89,
      // which 444.50 x the *displayed* 0.02 would give); LKR must come from the SAME
      // full-precision 9.3345 x 340.50 = 3,178.397 -> 3,178.40 — not from 9.33 x 340.50
      // (= 3,176.87), which was an earlier, incorrect draft of this function.
      const screening = computeLineAmounts({ weightBasis: 'GROSS', rateUsd: '0.021', ...context });
      expect(screening.amountUsd.toFixed(2)).toBe('9.33');
      expect(screening.amountLkr.toFixed(2)).toBe('3178.40');

      const handling = computeLineAmounts({ weightBasis: 'FLAT', rateUsd: '35.00', ...context });
      expect(handling.amountUsd.toFixed(2)).toBe('35.00');
      expect(handling.amountLkr.toFixed(2)).toBe('11917.50');
    });

    it('Security: USD matches the real invoice (36.26); LKR has a known ~1-cent gap, flagged not silently forced', () => {
      // No 4-decimal rate reproduces the printed 12,346.34 exactly: 36.2594 x 340.50
      // rounds to 12,346.33, and 36.2595 already overshoots to 12,346.36 — there is no
      // rate in between at 4dp precision. This is a genuine anomaly in the one real
      // specimen invoice (see /references/README.md discrepancy §2), not a defect in
      // this function's model — asserting the mathematically consistent 12,346.33 here
      // rather than force-matching the unreproducible printed figure.
      const { amountUsd, amountLkr } = computeLineAmounts({
        rateUsd: '36.2594',
        weightBasis: 'FLAT',
        chargeableWeightKg: null,
        grossWeightKg: null,
        exchangeRate: '340.50',
      });
      expect(amountUsd.toFixed(2)).toBe('36.26');
      expect(amountLkr.toFixed(2)).toBe('12346.33');
    });

    it('regression: LKR must be derived from the full-precision base, not the already-rounded USD amount', () => {
      const { amountUsd, amountLkr } = computeLineAmounts({
        rateUsd: '0.021',
        weightBasis: 'GROSS',
        chargeableWeightKg: '500.00',
        grossWeightKg: '444.50',
        exchangeRate: '340.50',
      });
      const wrongModelLkr = amountUsd.times('340.50').toDecimalPlaces(2);
      expect(amountLkr.toFixed(2)).toBe('3178.40');
      // The incorrect "round USD first, then convert" model this function no longer uses.
      expect(wrongModelLkr.toFixed(2)).toBe('3176.87');
      expect(amountLkr.toFixed(2)).not.toBe(wrongModelLkr.toFixed(2));
    });

    it('sums the four exactly-verified real lines to the correct sub-total', () => {
      const context = {
        chargeableWeightKg: '500.00',
        grossWeightKg: '444.50',
        exchangeRate: '340.50',
      };
      const results = REAL_LINES.slice(0, 4).map((line) =>
        computeLineAmounts({ ...line, ...context }),
      );
      const totals = computeTotals(
        results.map((r) => ({
          id: '',
          sortOrder: 0,
          description: '',
          weightBasis: 'FLAT' as const,
          rateUsd: new Prisma.Decimal(0),
          ...r,
        })),
      );
      expect(totals.totalUsd).toBe('2445.83');
      expect(totals.totalLkr).toBe('832806.65');
    });

    it('FLAT lines use the rate directly, ignoring weight', () => {
      const { amountUsd } = computeLineAmounts({
        rateUsd: '35.00',
        weightBasis: 'FLAT',
        chargeableWeightKg: null,
        grossWeightKg: null,
        exchangeRate: '340.50',
      });
      expect(amountUsd.toFixed(2)).toBe('35.00');
    });

    it('throws when a CHARGEABLE line is computed with no Chargeable Weight set', () => {
      expect(() =>
        computeLineAmounts({
          rateUsd: '4.75',
          weightBasis: 'CHARGEABLE',
          chargeableWeightKg: null,
          grossWeightKg: '444.50',
          exchangeRate: '340.50',
        }),
      ).toThrow(/Chargeable Weight/);
    });

    it('throws when a GROSS line is computed with no shipment weight entered', () => {
      expect(() =>
        computeLineAmounts({
          rateUsd: '0.021',
          weightBasis: 'GROSS',
          chargeableWeightKg: '500.00',
          grossWeightKg: null,
          exchangeRate: '340.50',
        }),
      ).toThrow(/Gross Weight/);
    });

    it('throws when the exchange rate is not yet set', () => {
      expect(() =>
        computeLineAmounts({
          rateUsd: '35.00',
          weightBasis: 'FLAT',
          chargeableWeightKg: null,
          grossWeightKg: null,
          exchangeRate: null,
        }),
      ).toThrow(/exchange rate/);
    });
  });

  describe('computeTotals', () => {
    it('sums an empty line set to zero, not an error', () => {
      expect(computeTotals([])).toEqual({ totalUsd: '0.00', totalLkr: '0.00' });
    });
  });

  describe('computeDueDate', () => {
    it('matches the real invoice: 04 August 2026 + 5 days = 09 August 2026', () => {
      expect(computeDueDate(new Date('2026-08-04T00:00:00.000Z'), 5)).toBe('2026-08-09');
    });

    it('is null until both invoiceDate and termDays exist', () => {
      expect(computeDueDate(null, 5)).toBeNull();
      expect(computeDueDate(new Date('2026-08-04T00:00:00.000Z'), null)).toBeNull();
    });
  });

  describe('computeAirlineBuyingCost — BR-41/BR-66', () => {
    it('is Chargeable Weight x the applied buying rate', () => {
      expect(
        computeAirlineBuyingCost({ toString: () => '500.00' }, { toString: () => '4.75' }),
      ).toBe('2375.00');
    });

    it('is null until both the applied rate and Chargeable Weight exist', () => {
      expect(computeAirlineBuyingCost(null, { toString: () => '4.75' })).toBeNull();
      expect(computeAirlineBuyingCost({ toString: () => '500.00' }, null)).toBeNull();
    });
  });

  describe('toSharedInvoice', () => {
    const baseRow: InvoiceRow = {
      id: 'inv-1',
      shipmentId: 'shipment-1',
      invoiceNo: 'HUB/IU/0676/2026',
      invoiceDate: new Date('2026-08-04T00:00:00.000Z'),
      exchangeRate: { toString: () => '340.50' },
      termDays: 5,
      chargeableWeightKg: { toString: () => '500.00' },
      status: 'DRAFT',
      version: 0,
      createdByUserId: 'user-1',
      issuedByUserId: null,
      issuedAt: null,
      createdAt: new Date('2026-08-01T00:00:00.000Z'),
      updatedAt: new Date('2026-08-01T00:00:00.000Z'),
      shipment: {
        shipmentNo: 'HUB 000001',
        mawbNo: '157 0659 8944',
        airline: { code: 'QR' },
        flightNo: 'QR0655/QR0123',
        flightDate: new Date('2026-08-04T00:00:00.000Z'),
        boxCount: 26,
        weightKg: { toString: () => '444.50' },
        appliedBuyingRate: { toString: () => '4.75' },
        destinationAirport: { code: 'MXP' },
        commodity: { name: 'FRESH FISH' },
        shipper: { name: 'OCEAN LINE SEA FOODS PVT LTD', address: 'MEDA MUKALANA WATTA' },
        consignee: { name: 'SEA FISH ITALIA SRL' },
      },
      lines: [
        {
          id: 'line-1',
          sortOrder: 0,
          description: 'FREIGHT CHARGES',
          weightBasis: 'CHARGEABLE',
          rateUsd: { toString: () => '4.75' },
          amountUsd: { toString: () => '2375.00' },
          amountLkr: { toString: () => '808687.50' },
        },
        {
          id: 'line-2',
          sortOrder: 1,
          description: 'MAWB FEE',
          weightBasis: 'FLAT',
          rateUsd: { toString: () => '26.50' },
          amountUsd: { toString: () => '26.50' },
          amountLkr: { toString: () => '9023.25' },
        },
      ],
    };

    it('resolves header fields live from the shipment relations and computes totals/due date/buying cost', () => {
      const shared = toSharedInvoice(baseRow);
      expect(shared.shipmentNo).toBe('HUB 000001');
      expect(shared.awbNumber).toBe('157 0659 8944');
      expect(shared.flights).toBe('QR 0655/QR0123');
      expect(shared.etdColombo).toBe('2026-08-04');
      expect(shared.grossWeightKg).toBe('444.50');
      expect(shared.dueDate).toBe('2026-08-09');
      expect(shared.totalUsd).toBe('2401.50');
      expect(shared.totalLkr).toBe('817710.75');
      expect(shared.airlineBuyingCostUsd).toBe('2375.00');
    });

    it('resolves each line WT: chargeable weight for CHARGEABLE, blank for FLAT', () => {
      const shared = toSharedInvoice(baseRow);
      expect(shared.lines).toHaveLength(2);
      expect(shared.lines[0]?.weightKg).toBe('500.00');
      expect(shared.lines[1]?.weightKg).toBeNull();
    });
  });
});
