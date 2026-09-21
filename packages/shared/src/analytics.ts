import { z } from 'zod';
import { SHIPMENT_STATUSES } from './shipment.js';

/** PRD §10 dimensions; ARCHITECTURE §17. */
export const ANALYTICS_GROUP_BY = ['commodity', 'airline', 'consignee', 'shipper', 'destination', 'salesPerson'] as const;
export type AnalyticsGroupBy = (typeof ANALYTICS_GROUP_BY)[number];

const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected date as YYYY-MM-DD');

/** Shared by both /analytics/shipments and /analytics/summary — same filters, same underlying query (ARCHITECTURE §17 reconciliation). */
export const analyticsFilterQuerySchema = z.object({
  dateFrom: dateOnly.optional(),
  dateTo: dateOnly.optional(),
  commodityId: z.string().trim().min(1).optional(),
  airlineId: z.string().trim().min(1).optional(),
  shipperId: z.string().trim().min(1).optional(),
});
export type AnalyticsFilterQuery = z.infer<typeof analyticsFilterQuerySchema>;

export const analyticsSummaryQuerySchema = analyticsFilterQuerySchema.extend({
  groupBy: z.enum(ANALYTICS_GROUP_BY),
});
export type AnalyticsSummaryQuery = z.infer<typeof analyticsSummaryQuerySchema>;

/** One row of the drill-through list — the exact shipment_report_v grain, plus the resolved LKR/profit figures. */
export const analyticsShipmentRowSchema = z.object({
  shipmentId: z.string(),
  shipmentNo: z.string(),
  flightDate: z.string(),
  status: z.enum(SHIPMENT_STATUSES),
  weightKg: z.string().nullable(),
  commodityId: z.string(),
  commodityName: z.string(),
  airlineId: z.string(),
  airlineName: z.string(),
  consigneeId: z.string(),
  consigneeName: z.string(),
  shipperId: z.string(),
  shipperName: z.string(),
  destinationAirportId: z.string(),
  destinationAirportCode: z.string(),
  salesPersonId: z.string(),
  salesPersonName: z.string(),
  chargeableWeightKg: z.string().nullable(),
  // The rate actually used to convert buyingCostUsd -> buyingCostLkr — the
  // shipment's own invoice.exchangeRate when set, else the configured
  // fallback (OQ-5). Surfaced so a viewer can see which applied.
  exchangeRateUsed: z.string().nullable(),
  revenueUsd: z.string(),
  revenueLkr: z.string(),
  buyingCostUsd: z.string(),
  buyingCostLkr: z.string(),
  opexLkr: z.string(),
  profitLkr: z.string(),
});
export type AnalyticsShipmentRow = z.infer<typeof analyticsShipmentRowSchema>;

export const analyticsShipmentListResponseSchema = z.array(analyticsShipmentRowSchema);
export type AnalyticsShipmentListResponse = z.infer<typeof analyticsShipmentListResponseSchema>;

/** One group's totals — same shape reused for the overall `totals` row. */
export const analyticsSummaryGroupSchema = z.object({
  key: z.string(),
  label: z.string(),
  shipmentCount: z.number().int(),
  weightKg: z.string(),
  revenueUsd: z.string(),
  revenueLkr: z.string(),
  buyingCostUsd: z.string(),
  buyingCostLkr: z.string(),
  opexLkr: z.string(),
  profitLkr: z.string(),
});
export type AnalyticsSummaryGroup = z.infer<typeof analyticsSummaryGroupSchema>;

export const analyticsSummaryResponseSchema = z.object({
  groupBy: z.enum(ANALYTICS_GROUP_BY),
  groups: z.array(analyticsSummaryGroupSchema),
  totals: analyticsSummaryGroupSchema,
});
export type AnalyticsSummaryResponse = z.infer<typeof analyticsSummaryResponseSchema>;
