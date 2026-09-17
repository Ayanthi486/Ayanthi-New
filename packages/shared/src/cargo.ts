import { z } from 'zod';

/** A plain HTML input submits "" when left blank — see shipment.ts's `optional` helper for why this preprocessing is needed. */
const optional = <T extends z.ZodTypeAny>(inner: T) =>
  z.preprocess((value) => (value === '' ? undefined : value), inner.optional());

const weightDecimal = z.preprocess(
  (val) => (typeof val === 'string' ? val.replace(',', '.') : val),
  z.string()
    .regex(/^\d+(\.\d{1,3})?$/, 'Expected a positive decimal with up to 3 decimal places')
    .refine((value) => Number(value) > 0, 'Weight must be positive')
);

/**
 * BR-06: Executive enters BOX/WEIGHT during cargo handling; editable only
 * while the shipment is Pending (enforced server-side, not just by this
 * schema). `version` carries the same optimistic-lock check as
 * `updateShipmentRequestSchema` (ARCHITECTURE §20).
 */
export const setCargoRequestSchema = z.object({
  boxCount: optional(z.number().int().positive()),
  weightKg: optional(weightDecimal),
  version: z.number().int().nonnegative(),
});
export type SetCargoRequest = z.infer<typeof setCargoRequestSchema>;
