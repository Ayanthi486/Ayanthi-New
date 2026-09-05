import { z } from 'zod';

/** BR-54: partial payments supported. The real invoice supports both a USD wire transfer and an LKR local cheque. */
export const PAYMENT_CURRENCIES = ['USD', 'LKR'] as const;
export type PaymentCurrency = (typeof PAYMENT_CURRENCIES)[number];

/** A plain HTML input submits "" when left blank — see shipment.ts's identical helper. */
const optional = <T extends z.ZodTypeAny>(inner: T) =>
  z.preprocess((value) => (value === '' ? undefined : value), inner.optional());

const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected date as YYYY-MM-DD');

const paymentAmount = z
  .string()
  .regex(/^\d+(\.\d{1,2})?$/, 'Expected a positive amount with up to 2 decimal places')
  .refine((value) => Number(value) > 0, 'Amount must be positive');

/** BR-55/56: date and optional method/reference; receipt travels as a separate multipart form field, not JSON. */
export const recordPaymentRequestSchema = z.object({
  amount: paymentAmount,
  currency: z.enum(PAYMENT_CURRENCIES),
  paymentDate: dateOnly,
  method: optional(z.string().trim().min(1)),
  reference: optional(z.string().trim().min(1)),
});
export type RecordPaymentRequest = z.infer<typeof recordPaymentRequestSchema>;

export const paymentSchema = z.object({
  id: z.string(),
  invoiceId: z.string(),
  amount: z.string(),
  currency: z.enum(PAYMENT_CURRENCIES),
  paymentDate: z.string(),
  method: z.string().nullable(),
  reference: z.string().nullable(),
  hasReceipt: z.boolean(),
  recordedByUserId: z.string(),
  createdAt: z.string(),
});
export type Payment = z.infer<typeof paymentSchema>;

/** Computed server-side, never stored (DEVELOPMENT_RULES §5) — CONTEXT.md §14. */
export const paymentSummarySchema = z.object({
  totalUsd: z.string(),
  paidUsd: z.string(),
  remainingUsd: z.string(),
  isFullyPaid: z.boolean(),
});
export type PaymentSummary = z.infer<typeof paymentSummarySchema>;

export const paymentListResponseSchema = z.object({
  payments: z.array(paymentSchema),
  summary: paymentSummarySchema,
});
export type PaymentListResponse = z.infer<typeof paymentListResponseSchema>;
