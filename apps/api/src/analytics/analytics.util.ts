import type {
  AnalyticsGroupBy,
  AnalyticsShipmentRow,
  AnalyticsSummaryGroup,
  ShipmentStatus,
} from '@hub-lanka/shared';
import { Prisma } from '../generated/prisma/client';

type DecimalLike = { toString(): string };

function toDecimal(value: DecimalLike | string | number): Prisma.Decimal {
  return new Prisma.Decimal(value.toString());
}

function round2(value: Prisma.Decimal): Prisma.Decimal {
  return value.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
}

function formatDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** One row of `shipment_report_v` ($queryRaw results keep the SQL column names, unlike model queries). */
export interface ShipmentReportViewRow {
  shipment_id: string;
  shipment_no: string;
  flight_date: Date;
  status: ShipmentStatus;
  weight_kg: DecimalLike | null;
  commodity_id: string;
  commodity_name: string;
  airline_id: string;
  airline_name: string;
  shipper_id: string;
  shipper_name: string;
  consignee_id: string;
  consignee_name: string;
  destination_airport_id: string;
  destination_airport_code: string;
  chargeable_weight_kg: DecimalLike | null;
  invoice_exchange_rate: DecimalLike | null;
  sales_person_id: string;
  sales_person_name: string;
  revenue_usd: DecimalLike;
  revenue_lkr: DecimalLike;
  buying_cost_usd: DecimalLike;
  opex_lkr: DecimalLike;
}

/**
 * OQ-5: the shipment's own (historically-snapshotted) invoice.exchangeRate
 * whenever it exists, else the configured fallback. Never the other way
 * around — a per-shipment recorded rate is always more accurate than a
 * global default.
 */
export function resolveExchangeRate(
  invoiceExchangeRate: DecimalLike | null,
  fallback: number,
): Prisma.Decimal {
  return invoiceExchangeRate !== null ? toDecimal(invoiceExchangeRate) : toDecimal(fallback);
}

/** Converts one `shipment_report_v` row into the wire shape, resolving the LKR buying cost and profit. */
export function toAnalyticsRow(
  row: ShipmentReportViewRow,
  fallbackExchangeRate: number,
): AnalyticsShipmentRow {
  const exchangeRate = resolveExchangeRate(row.invoice_exchange_rate, fallbackExchangeRate);
  const buyingCostUsd = toDecimal(row.buying_cost_usd);
  const buyingCostLkr = round2(buyingCostUsd.times(exchangeRate));
  const revenueLkr = toDecimal(row.revenue_lkr);
  const opexLkr = toDecimal(row.opex_lkr);
  // BR-38: Profit = customer selling revenue - airline buying cost - applicable operational expenses.
  const profitLkr = revenueLkr.minus(buyingCostLkr).minus(opexLkr);

  return {
    shipmentId: row.shipment_id,
    shipmentNo: row.shipment_no,
    flightDate: formatDateOnly(row.flight_date),
    status: row.status,
    weightKg: row.weight_kg ? row.weight_kg.toString() : null,
    commodityId: row.commodity_id,
    commodityName: row.commodity_name,
    airlineId: row.airline_id,
    airlineName: row.airline_name,
    consigneeId: row.consignee_id,
    consigneeName: row.consignee_name,
    shipperId: row.shipper_id,
    shipperName: row.shipper_name,
    destinationAirportId: row.destination_airport_id,
    destinationAirportCode: row.destination_airport_code,
    salesPersonId: row.sales_person_id,
    salesPersonName: row.sales_person_name,
    chargeableWeightKg: row.chargeable_weight_kg ? row.chargeable_weight_kg.toString() : null,
    exchangeRateUsed: exchangeRate.toString(),
    revenueUsd: toDecimal(row.revenue_usd).toFixed(2),
    revenueLkr: revenueLkr.toFixed(2),
    buyingCostUsd: buyingCostUsd.toFixed(2),
    buyingCostLkr: buyingCostLkr.toFixed(2),
    opexLkr: opexLkr.toFixed(2),
    profitLkr: profitLkr.toFixed(2),
  };
}

function emptyGroup(key: string, label: string): AnalyticsSummaryGroup {
  return {
    key,
    label,
    shipmentCount: 0,
    weightKg: '0.000',
    revenueUsd: '0.00',
    revenueLkr: '0.00',
    buyingCostUsd: '0.00',
    buyingCostLkr: '0.00',
    opexLkr: '0.00',
    profitLkr: '0.00',
  };
}

function addRowToGroup(
  group: AnalyticsSummaryGroup,
  row: AnalyticsShipmentRow,
): AnalyticsSummaryGroup {
  return {
    key: group.key,
    label: group.label,
    shipmentCount: group.shipmentCount + 1,
    weightKg: toDecimal(group.weightKg)
      .plus(toDecimal(row.weightKg ?? '0'))
      .toFixed(3),
    revenueUsd: toDecimal(group.revenueUsd).plus(toDecimal(row.revenueUsd)).toFixed(2),
    revenueLkr: toDecimal(group.revenueLkr).plus(toDecimal(row.revenueLkr)).toFixed(2),
    buyingCostUsd: toDecimal(group.buyingCostUsd).plus(toDecimal(row.buyingCostUsd)).toFixed(2),
    buyingCostLkr: toDecimal(group.buyingCostLkr).plus(toDecimal(row.buyingCostLkr)).toFixed(2),
    opexLkr: toDecimal(group.opexLkr).plus(toDecimal(row.opexLkr)).toFixed(2),
    profitLkr: toDecimal(group.profitLkr).plus(toDecimal(row.profitLkr)).toFixed(2),
  };
}

function groupKeyAndLabel(
  row: AnalyticsShipmentRow,
  groupBy: AnalyticsGroupBy,
): { key: string; label: string } {
  switch (groupBy) {
    case 'commodity':
      return { key: row.commodityId, label: row.commodityName };
    case 'airline':
      return { key: row.airlineId, label: row.airlineName };
    case 'shipper':
      return { key: row.shipperId, label: row.shipperName };
    case 'consignee':
      return { key: row.consigneeId, label: row.consigneeName };
    case 'destination':
      return { key: row.destinationAirportId, label: row.destinationAirportCode };
    case 'salesPerson':
      return { key: row.salesPersonId, label: row.salesPersonName };
  }
}

/**
 * Groups and sums the SAME rows the drill-through list already returned —
 * groups and `totals` are built from one accumulation pass, so they cannot
 * diverge (ARCHITECTURE §17: "every dashboard figure must reconcile exactly").
 */
export function summarize(
  rows: AnalyticsShipmentRow[],
  groupBy: AnalyticsGroupBy,
): { groups: AnalyticsSummaryGroup[]; totals: AnalyticsSummaryGroup } {
  const groupsByKey = new Map<string, AnalyticsSummaryGroup>();
  let totals = emptyGroup('all', 'Total');

  for (const row of rows) {
    const { key, label } = groupKeyAndLabel(row, groupBy);
    const existing = groupsByKey.get(key) ?? emptyGroup(key, label);
    groupsByKey.set(key, addRowToGroup(existing, row));
    totals = addRowToGroup(totals, row);
  }

  const groups = [...groupsByKey.values()].sort((a, b) => a.key.localeCompare(b.key));
  return { groups, totals };
}

function csvEscape(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

/** RFC 4180-ish: comma-separated, CRLF lines, quoted fields only where needed. */
export function toCsv(headers: string[], rows: string[][]): string {
  return [headers, ...rows].map((line) => line.map(csvEscape).join(',')).join('\r\n') + '\r\n';
}
