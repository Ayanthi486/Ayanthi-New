import { describe, expect, it } from 'vitest';
import type { AnalyticsShipmentRow } from '@hub-lanka/shared';
import {
  bucketKey,
  resolveExchangeRate,
  summarize,
  toAnalyticsRow,
  toCsv,
  type ShipmentReportViewRow,
} from './analytics.util';

const BASE_ROW: ShipmentReportViewRow = {
  shipment_id: 'shipment-1',
  shipment_no: 'HUB 000001',
  flight_date: new Date('2026-08-04T00:00:00.000Z'),
  status: 'PENDING',
  weight_kg: { toString: () => '500.000' },
  commodity_id: 'commodity-1',
  commodity_name: 'Edible Fish',
  airline_id: 'airline-1',
  airline_name: 'Emirates',
  shipper_id: 'shipper-1',
  shipper_name: 'Acme Exports',
  chargeable_weight_kg: { toString: () => '500.000' },
  invoice_exchange_rate: null,
  revenue_usd: { toString: () => '0' },
  revenue_lkr: { toString: () => '0' },
  buying_cost_usd: { toString: () => '0' },
  opex_lkr: { toString: () => '0' },
};

describe('resolveExchangeRate — OQ-5', () => {
  it('uses the invoice-recorded rate when present', () => {
    expect(resolveExchangeRate({ toString: () => '340.5000' }, 300).toString()).toBe('340.5');
  });

  it('falls back to the configured default when the shipment has no invoice rate', () => {
    expect(resolveExchangeRate(null, 300).toString()).toBe('300');
  });
});

describe('toAnalyticsRow — BR-38 profit arithmetic', () => {
  it('reproduces PRD §8 reference-invoice revenue exactly, netted against a buying cost and opex', () => {
    // Revenue figures are the reference invoice's own confirmed totals
    // (PRD §8: Freight 500x4.75=2375.00, MAWB Fee 26.50, Screening
    // 444.50x0.021=9.33/3178.40, Handling 35.00, Security 36.26 ->
    // USD 2,482.09 / LKR 845,152.99 at exchange rate 340.50). The reference
    // invoice does not disclose the airline's internal buying rate, so the
    // buying cost (500kg chargeable x an illustrative 4.00 USD/kg) and
    // operational expenses are synthetic, isolating this test to the
    // conversion/netting arithmetic this module owns.
    const row: ShipmentReportViewRow = {
      ...BASE_ROW,
      invoice_exchange_rate: { toString: () => '340.50' },
      revenue_usd: { toString: () => '2482.09' },
      revenue_lkr: { toString: () => '845152.99' },
      buying_cost_usd: { toString: () => '2000.00' },
      opex_lkr: { toString: () => '50000.00' },
    };

    const result = toAnalyticsRow(row, 300);

    expect(result.exchangeRateUsed).toBe('340.5');
    expect(result.revenueUsd).toBe('2482.09');
    expect(result.revenueLkr).toBe('845152.99');
    expect(result.buyingCostUsd).toBe('2000.00');
    // 2000.00 x 340.50
    expect(result.buyingCostLkr).toBe('681000.00');
    // 845152.99 - 681000.00 - 50000.00
    expect(result.profitLkr).toBe('114152.99');
  });

  it('uses the configured fallback and treats a missing buying cost as zero', () => {
    const row: ShipmentReportViewRow = {
      ...BASE_ROW,
      chargeable_weight_kg: null,
      invoice_exchange_rate: null,
      revenue_usd: { toString: () => '100.00' },
      revenue_lkr: { toString: () => '34050.00' },
      buying_cost_usd: { toString: () => '0' },
      opex_lkr: { toString: () => '0' },
    };

    const result = toAnalyticsRow(row, 340.5);

    expect(result.exchangeRateUsed).toBe('340.5');
    expect(result.buyingCostLkr).toBe('0.00');
    expect(result.profitLkr).toBe('34050.00');
  });
});

describe('bucketKey — PRD §10 time dimension', () => {
  it('day is the flightDate unchanged', () => {
    expect(bucketKey('2026-08-04', 'day')).toBe('2026-08-04');
  });

  it('month truncates to YYYY-MM', () => {
    expect(bucketKey('2026-08-04', 'month')).toBe('2026-08');
  });

  it('year truncates to YYYY', () => {
    expect(bucketKey('2026-08-04', 'year')).toBe('2026');
  });

  it('week is the ISO-8601 week — 2024-01-01 (a Monday) starts week 1', () => {
    expect(bucketKey('2024-01-01', 'week')).toBe('2024-W01');
  });

  it('week assigns a year-boundary Sunday to the prior ISO year (2023-01-01 -> 2022-W52)', () => {
    expect(bucketKey('2023-01-01', 'week')).toBe('2022-W52');
  });
});

describe('summarize — ARCHITECTURE §17 reconciliation', () => {
  function row(overrides: Partial<AnalyticsShipmentRow>): AnalyticsShipmentRow {
    return {
      shipmentId: 'id',
      shipmentNo: 'HUB 000001',
      flightDate: '2026-08-04',
      status: 'PENDING',
      weightKg: '100.000',
      commodityId: 'c1',
      commodityName: 'Fish',
      airlineId: 'a1',
      airlineName: 'Emirates',
      shipperId: 's1',
      shipperName: 'Acme',
      chargeableWeightKg: '100.000',
      exchangeRateUsed: '340.50',
      revenueUsd: '100.00',
      revenueLkr: '34050.00',
      buyingCostUsd: '40.00',
      buyingCostLkr: '13620.00',
      opexLkr: '1000.00',
      profitLkr: '19430.00',
      ...overrides,
    };
  }

  it('groups by commodity and the group sums equal the totals row (drill-through reconciliation)', () => {
    const rows = [
      row({ shipmentId: 's1', commodityId: 'c1', commodityName: 'Fish' }),
      row({ shipmentId: 's2', commodityId: 'c1', commodityName: 'Fish' }),
      row({
        shipmentId: 's3',
        commodityId: 'c2',
        commodityName: 'Textiles',
        revenueLkr: '20000.00',
      }),
    ];

    const { groups, totals } = summarize(rows, 'commodity');

    expect(groups).toHaveLength(2);
    const fish = groups.find((g) => g.key === 'c1');
    expect(fish?.shipmentCount).toBe(2);
    expect(fish?.revenueLkr).toBe('68100.00');

    const summedRevenue = groups.reduce((sum, g) => sum + Number(g.revenueLkr), 0);
    expect(summedRevenue.toFixed(2)).toBe(totals.revenueLkr);
    expect(totals.shipmentCount).toBe(3);
  });

  it('groups by time using the requested period', () => {
    const rows = [
      row({ shipmentId: 's1', flightDate: '2026-08-04' }),
      row({ shipmentId: 's2', flightDate: '2026-08-20' }),
      row({ shipmentId: 's3', flightDate: '2026-09-01' }),
    ];

    const { groups } = summarize(rows, 'time', 'month');

    expect(groups.map((g) => g.key)).toEqual(['2026-08', '2026-09']);
    expect(groups[0]?.shipmentCount).toBe(2);
  });
});

describe('toCsv', () => {
  it('quotes fields containing commas, quotes or newlines', () => {
    const csv = toCsv(
      ['A', 'B'],
      [
        ['plain', 'has,comma'],
        ['has "quote"', 'line\nbreak'],
      ],
    );
    const lines = csv.split('\r\n');
    expect(lines[0]).toBe('A,B');
    expect(lines[1]).toBe('plain,"has,comma"');
    expect(lines[2]).toBe('"has ""quote""","line\nbreak"');
  });
});
