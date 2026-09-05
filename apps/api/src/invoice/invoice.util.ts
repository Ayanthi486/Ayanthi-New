import type {
  Invoice as SharedInvoice,
  InvoiceLine as SharedInvoiceLine,
  InvoiceLineWeightBasis,
  InvoiceStatus,
} from '@hub-lanka/shared';
import { BusinessRuleError } from '../common/errors/app-error';
import { Prisma } from '../generated/prisma/client';
import { addDays } from '../shipment/shipment.util';

type DecimalLike = { toString(): string };

export interface InvoiceLineRow {
  id: string;
  sortOrder: number;
  description: string;
  weightBasis: InvoiceLineWeightBasis;
  rateUsd: DecimalLike;
  amountUsd: DecimalLike;
  amountLkr: DecimalLike;
}

export interface InvoiceRow {
  id: string;
  shipmentId: string;
  invoiceNo: string | null;
  invoiceDate: Date | null;
  exchangeRate: DecimalLike | null;
  termDays: number | null;
  chargeableWeightKg: DecimalLike | null;
  status: InvoiceStatus;
  version: number;
  createdByUserId: string;
  issuedByUserId: string | null;
  issuedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  lines: InvoiceLineRow[];
  shipment: {
    shipmentNo: string;
    mawbNo: string | null;
    flightNo: string | null;
    flightDate: Date;
    boxCount: number | null;
    weightKg: DecimalLike | null;
    appliedBuyingRate: DecimalLike | null;
    destinationAirport: { code: string } | null;
    commodity: { name: string };
    shipper: { name: string; address: string | null };
    consignee: { name: string };
  };
}

function formatDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function toDecimal(value: DecimalLike | string): Prisma.Decimal {
  return new Prisma.Decimal(value.toString());
}

/** Money precision (DEVELOPMENT_RULES §5): decimal.js's default ROUND_HALF_UP, 2dp. */
function round2(value: Prisma.Decimal): Prisma.Decimal {
  return value.toDecimalPlaces(2);
}

export interface LineAmountInputs {
  rateUsd: DecimalLike | string;
  weightBasis: InvoiceLineWeightBasis;
  chargeableWeightKg: DecimalLike | string | null;
  grossWeightKg: DecimalLike | string | null;
  exchangeRate: DecimalLike | string | null;
}

/**
 * The verified AC-13 model (`/references/README.md` discrepancy §1,
 * `PRD.md` §8) — corrected from an earlier draft that rounded the USD
 * amount first and multiplied *that* by the exchange rate. Reproducing the
 * real invoice's Screening line (444.50kg x true rate 0.021 = 9.3345,
 * which the invoice prints rounded as "9.33") shows the LKR figure is
 * 3,178.40 — but 9.33 x 340.50 = 3,176.865 ("3,176.87"), not 3,178.40.
 * The real figure only comes out of 9.3345 x 340.50 = 3,178.397 -> 3,178.40.
 * So both amountUsd and amountLkr are independently rounded from the SAME
 * full-precision `base` (rate x weight), never chained through the
 * already-rounded USD figure. Verified exact for Freight/MAWB Fee/
 * Screening/Handling; Security has a small (~1 cent) unresolved gap against
 * the one real specimen invoice — see the file-level note in `InvoiceRow`'s
 * consumer and `/references/README.md` discrepancy §2.
 */
export function computeLineAmounts(input: LineAmountInputs): {
  amountUsd: Prisma.Decimal;
  amountLkr: Prisma.Decimal;
} {
  const rate = toDecimal(input.rateUsd);

  let base: Prisma.Decimal;
  if (input.weightBasis === 'FLAT') {
    base = rate;
  } else {
    const weight =
      input.weightBasis === 'CHARGEABLE' ? input.chargeableWeightKg : input.grossWeightKg;
    if (weight === null) {
      throw new BusinessRuleError(
        input.weightBasis === 'CHARGEABLE'
          ? 'Chargeable Weight must be set before a chargeable-weight line can be computed'
          : "The shipment's Gross Weight must be entered (cargo handling) before a gross-weight line can be computed",
      );
    }
    base = rate.times(toDecimal(weight));
  }

  if (input.exchangeRate === null) {
    throw new BusinessRuleError(
      'The exchange rate must be set before invoice line amounts can be computed',
    );
  }
  const amountUsd = round2(base);
  const amountLkr = round2(base.times(toDecimal(input.exchangeRate)));

  return { amountUsd, amountLkr };
}

/** Sum of the already-rounded per-line amounts — never stored (DEVELOPMENT_RULES §5), same as Cost Sheet's total. */
export function computeTotals(lines: InvoiceLineRow[]): { totalUsd: string; totalLkr: string } {
  const totalUsd = lines.reduce(
    (sum, line) => sum.plus(toDecimal(line.amountUsd)),
    new Prisma.Decimal(0),
  );
  const totalLkr = lines.reduce(
    (sum, line) => sum.plus(toDecimal(line.amountLkr)),
    new Prisma.Decimal(0),
  );
  return { totalUsd: totalUsd.toFixed(2), totalLkr: totalLkr.toFixed(2) };
}

/** `invoiceDate + termDays` — computed, never stored (DEVELOPMENT_RULES §5). Verified: 04 Aug + 5 days = 09 Aug on the real invoice. */
export function computeDueDate(invoiceDate: Date | null, termDays: number | null): string | null {
  if (!invoiceDate || termDays === null) return null;
  return addDays(formatDateOnly(invoiceDate), termDays);
}

/** BR-41/BR-66: Chargeable Weight x the shipment's stored applied buying rate, freight-only. */
export function computeAirlineBuyingCost(
  chargeableWeightKg: DecimalLike | null,
  appliedBuyingRate: DecimalLike | null,
): string | null {
  if (chargeableWeightKg === null || appliedBuyingRate === null) return null;
  return round2(toDecimal(chargeableWeightKg).times(toDecimal(appliedBuyingRate))).toFixed(2);
}

/**
 * WT (Kgs) column on the real invoice — resolved from the parent's weights,
 * never stored per line (BR-35): chargeable weight for CHARGEABLE lines,
 * the shipment's gross weight for GROSS lines, blank for FLAT lines
 * (matches MAWB Fee/Handling/Security's blank WT on the real invoice).
 */
function resolveLineWeightKg(
  weightBasis: InvoiceLineWeightBasis,
  chargeableWeightKg: DecimalLike | null,
  grossWeightKg: DecimalLike | null,
): string | null {
  if (weightBasis === 'FLAT') return null;
  const weight = weightBasis === 'CHARGEABLE' ? chargeableWeightKg : grossWeightKg;
  return weight ? weight.toString() : null;
}

function toSharedInvoiceLine(
  line: InvoiceLineRow,
  chargeableWeightKg: DecimalLike | null,
  grossWeightKg: DecimalLike | null,
): SharedInvoiceLine {
  return {
    id: line.id,
    sortOrder: line.sortOrder,
    description: line.description,
    weightBasis: line.weightBasis,
    weightKg: resolveLineWeightKg(line.weightBasis, chargeableWeightKg, grossWeightKg),
    rateUsd: line.rateUsd.toString(),
    amountUsd: line.amountUsd.toString(),
    amountLkr: line.amountLkr.toString(),
  };
}

export function toSharedInvoice(row: InvoiceRow): SharedInvoice {
  const { totalUsd, totalLkr } = computeTotals(row.lines);
  const chargeableWeightKg = row.chargeableWeightKg;
  const grossWeightKg = row.shipment.weightKg;

  return {
    id: row.id,
    shipmentId: row.shipmentId,
    shipmentNo: row.shipment.shipmentNo,
    awbNumber: row.shipment.mawbNo,
    flights: row.shipment.flightNo,
    etdColombo: formatDateOnly(row.shipment.flightDate),
    destinationAirportCode: row.shipment.destinationAirport
      ? row.shipment.destinationAirport.code
      : null,
    commodityName: row.shipment.commodity.name,
    shipperName: row.shipment.shipper.name,
    shipperAddress: row.shipment.shipper.address,
    consigneeName: row.shipment.consignee.name,
    noOfPkgs: row.shipment.boxCount,
    grossWeightKg: grossWeightKg ? grossWeightKg.toString() : null,

    invoiceNo: row.invoiceNo,
    invoiceDate: row.invoiceDate ? formatDateOnly(row.invoiceDate) : null,
    exchangeRate: row.exchangeRate ? row.exchangeRate.toString() : null,
    termDays: row.termDays,
    dueDate: computeDueDate(row.invoiceDate, row.termDays),
    chargeableWeightKg: chargeableWeightKg ? chargeableWeightKg.toString() : null,

    status: row.status,
    version: row.version,
    lines: row.lines
      .slice()
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((line) => toSharedInvoiceLine(line, chargeableWeightKg, grossWeightKg)),
    totalUsd,
    totalLkr,
    airlineBuyingCostUsd: computeAirlineBuyingCost(
      chargeableWeightKg,
      row.shipment.appliedBuyingRate,
    ),

    createdByUserId: row.createdByUserId,
    issuedByUserId: row.issuedByUserId,
    issuedAt: row.issuedAt ? row.issuedAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
