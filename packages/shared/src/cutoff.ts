import { z } from 'zod';

/**
 * PRD §5.5/CONTEXT.md §18: "Normal -> Cut-off approaching -> Urgent -> Cut-off
 * passed." No `NORMAL` value — the absence of a `cutoff_alert` row for a
 * shipment IS Normal (Phase 8 decision #1); only states an alert has
 * actually escalated into are persisted.
 */
export const CUTOFF_STATES = ['APPROACHING', 'URGENT', 'PASSED'] as const;
export type CutoffState = (typeof CUTOFF_STATES)[number];

export const cutoffAlertSchema = z.object({
  id: z.string(),
  shipmentId: z.string(),
  state: z.enum(CUTOFF_STATES),
  raisedAt: z.string(),
  acknowledgedAt: z.string().nullable(),
  acknowledgedByUserId: z.string().nullable(),
  resolvedAt: z.string().nullable(),
});
export type CutoffAlert = z.infer<typeof cutoffAlertSchema>;

/** GET /cutoff/active — keyed by shipmentId so the schedule grid can look one up per row. */
export const cutoffAlertListResponseSchema = z.array(cutoffAlertSchema);
export type CutoffAlertListResponse = z.infer<typeof cutoffAlertListResponseSchema>;
