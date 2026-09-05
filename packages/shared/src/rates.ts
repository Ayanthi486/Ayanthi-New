import { z } from 'zod';

const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected date as YYYY-MM-DD');

/** BR-39/BR-42: weight-based, USD. Stored precision exceeds displayed precision (ARCHITECTURE §5). */
const rateDecimal = z
  .string()
  .regex(/^\d+(\.\d{1,4})?$/, 'Expected a positive decimal with up to 4 decimal places')
  .refine((value) => Number(value) > 0, 'Rate must be positive');

/**
 * BR-45: a new rate period for an airline. There is deliberately no
 * "update rate value" endpoint — every change is a new period, and creating
 * one auto-closes the airline's currently open period. See the Phase 3
 * report for the full rationale (BR-43: history must never be rewritten).
 */
export const createRateRequestSchema = z.object({
  airlineId: z.string().min(1, 'Airline is required'),
  rateUsdPerKg: rateDecimal,
  effectiveFrom: dateOnly,
});
export type CreateRateRequest = z.infer<typeof createRateRequestSchema>;

export const rateTableEntrySchema = z.object({
  id: z.string(),
  airlineId: z.string(),
  airlineName: z.string(),
  rateUsdPerKg: z.string(),
  effectiveFrom: z.string(),
  effectiveTo: z.string().nullable(),
  createdByUserId: z.string(),
  createdAt: z.string(),
});
export type RateTableEntry = z.infer<typeof rateTableEntrySchema>;
