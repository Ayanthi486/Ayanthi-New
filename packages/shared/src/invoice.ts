import { z } from 'zod';

/** BR-27/40/52/53: Manager-owned, create -> edit -> issue. No approval workflow (unlike Cost Sheet). */
export const INVOICE_STATUSES = ['DRAFT', 'ISSUED'] as const;
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

/**
 * PRD §8: "Freight on chargeable, Screening on gross, others flat." Which of
 * the invoice's two weights (if any) a line's rate applies to.
 */
export const INVOICE_LINE_WEIGHT_BASES = ['CHARGEABLE', 'GROSS', 'FLAT'] as const;
export type InvoiceLineWeightBasis = (typeof INVOICE_LINE_WEIGHT_BASES)[number];

/** A plain HTML input submits "" when left blank — see shipment.ts's identical helper. */
const optional = <T extends z.ZodTypeAny>(inner: T) =>
  z.preprocess((value) => (value === '' ? undefined : value), inner.optional());

const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected date as YYYY-MM-DD');

/** Same precision convention as RateTable.rateUsdPerKg (rates.ts) — money-adjacent, hidden precision. */
const rateDecimal = z
  .string()
  .regex(/^\d+(\.\d{1,4})?$/, 'Expected a positive decimal with up to 4 decimal places')
  .refine((value) => Number(value) > 0, 'Rate must be positive');

/** Same precision convention as cargo.ts's weightDecimal. */
const weightDecimal = z
  .string()
  .regex(/^\d+(\.\d{1,3})?$/, 'Expected a positive decimal with up to 3 decimal places')
  .refine((value) => Number(value) > 0, 'Weight must be positive');

/**
 * BR-30/BR-40: charge lines are manually entered per shipment — a dynamic,
 * Manager-composed collection, not a fixed enum like Cost Sheet's 11 lines.
 */
export const invoiceLineInputSchema = z.object({
  description: z.string().trim().min(1, 'Description is required'),
  weightBasis: z.enum(INVOICE_LINE_WEIGHT_BASES),
  rateUsd: rateDecimal,
});
export type InvoiceLineInput = z.infer<typeof invoiceLineInputSchema>;

export const createInvoiceRequestSchema = z.object({
  shipmentId: z.string().min(1, 'Shipment is required'),
  invoiceNo: optional(z.string().trim().min(1)),
  invoiceDate: optional(dateOnly),
  exchangeRate: optional(rateDecimal),
  termDays: optional(z.number().int().positive()),
  chargeableWeightKg: optional(weightDecimal),
  lines: z.array(invoiceLineInputSchema).optional(),
});
export type CreateInvoiceRequest = z.infer<typeof createInvoiceRequestSchema>;

/** `version` is mandatory — optimistic-lock check (ARCHITECTURE §20), same discipline as shipment/cost sheet. */
export const updateInvoiceRequestSchema = z.object({
  version: z.number().int().nonnegative(),
  invoiceNo: optional(z.string().trim().min(1)),
  invoiceDate: optional(dateOnly),
  exchangeRate: optional(rateDecimal),
  termDays: optional(z.number().int().positive()),
  chargeableWeightKg: optional(weightDecimal),
  // Full replacement of the line set when present — the Manager freely
  // adds/removes/reorders lines; array order becomes the new sortOrder.
  lines: z.array(invoiceLineInputSchema).optional(),
});
export type UpdateInvoiceRequest = z.infer<typeof updateInvoiceRequestSchema>;

export const invoiceLineSchema = z.object({
  id: z.string(),
  sortOrder: z.number().int(),
  description: z.string(),
  weightBasis: z.enum(INVOICE_LINE_WEIGHT_BASES),
  // Resolved from the invoice's chargeable/gross weight — null when weightBasis is FLAT
  // (matches the real invoice's blank WT column for MAWB Fee/Handling/Security).
  weightKg: z.string().nullable(),
  rateUsd: z.string(),
  // Snapshot per line (CONTEXT §23) — recomputed on every DRAFT edit, frozen once ISSUED.
  amountUsd: z.string(),
  amountLkr: z.string(),
});
export type InvoiceLine = z.infer<typeof invoiceLineSchema>;

export const invoiceSchema = z.object({
  id: z.string(),
  shipmentId: z.string(),
  shipmentNo: z.string(),
  // Header fields resolved live from the Shipment/Shipper/Consignee/Commodity/
  // Airport relations (BR-35) — never duplicated onto Invoice.
  awbNumber: z.string().nullable(),
  flights: z.string().nullable(),
  etdColombo: z.string(),
  destinationAirportCode: z.string().nullable(),
  commodityName: z.string(),
  shipperName: z.string(),
  shipperAddress: z.string().nullable(),
  consigneeName: z.string(),
  noOfPkgs: z.number().int().nullable(),
  grossWeightKg: z.string().nullable(),

  invoiceNo: z.string().nullable(),
  invoiceDate: z.string().nullable(),
  exchangeRate: z.string().nullable(),
  termDays: z.number().int().nullable(),
  // Computed (invoiceDate + termDays) — never stored (DEVELOPMENT_RULES §5).
  dueDate: z.string().nullable(),
  chargeableWeightKg: z.string().nullable(),

  status: z.enum(INVOICE_STATUSES),
  version: z.number().int(),
  lines: z.array(invoiceLineSchema),
  // Computed server-side, summed from the already-rounded line amounts —
  // never stored (DEVELOPMENT_RULES §5). AC-13's exact reconciliation target.
  totalUsd: z.string(),
  totalLkr: z.string(),
  // BR-41/BR-66: Chargeable Weight x the shipment's stored applied buying
  // rate, freight-only — not shown on the printed customer invoice. Null
  // until both the applied buying rate and Chargeable Weight exist.
  airlineBuyingCostUsd: z.string().nullable(),

  createdByUserId: z.string(),
  issuedByUserId: z.string().nullable(),
  issuedAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Invoice = z.infer<typeof invoiceSchema>;
