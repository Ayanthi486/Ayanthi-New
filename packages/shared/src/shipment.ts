import { z } from 'zod';

/**
 * Statuses are exactly these three (BR-08, PRD §5.1) — never add a fourth
 * without going back to the company first.
 */
export const SHIPMENT_STATUSES = ['PENDING', 'COMPLETED', 'CANCELLED'] as const;
export type ShipmentStatus = (typeof SHIPMENT_STATUSES)[number];

export const CANCELLATION_REQUEST_STATUSES = ['PENDING', 'APPROVED', 'REJECTED'] as const;
export type CancellationRequestStatus = (typeof CANCELLATION_REQUEST_STATUSES)[number];

const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected date as YYYY-MM-DD');
/** BR-16: 24-hour picker, no AM/PM. */
const time24 = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Expected 24-hour time as HH:mm');

/**
 * An optional field backed by a plain HTML `<input>` submits `""`, not
 * `undefined`, when the user leaves it blank — `.optional()` alone only
 * accepts `undefined`, so every browser form for this schema would fail
 * validation on an untouched optional field. Preprocessing "" to undefined
 * before applying `inner` fixes that for every optional field at once.
 */
const optional = <T extends z.ZodTypeAny>(inner: T) =>
  z.preprocess((value) => (value === '' ? undefined : value), inner.optional());

/**
 * Master data (shipper/consignee/commodity/airline/airport) is FK-backed as
 * of Phase 3 — `shipperId`/`consigneeId`/`commodityId`/`airlineId`/
 * `destinationAirportId` each reference an active master record (PRD §7).
 * Box/weight are deliberately absent here: CONTEXT.md §9's lifecycle treats
 * "Cargo Handling" as a distinct step after creation, and Phase 3 moved
 * that capability entirely into the `cargo` module
 * (`setCargoRequestSchema`) so "editable only while Pending" has exactly
 * one enforcement path. See the Phase 3 report.
 *
 * Every field the initial New Shipment form displays (DEP TIME, MAWB NO,
 * DEST, FLIGHT, DATE, SHIPPER, CONSIGNEE, COMMODITY) is required — a later
 * UX pass moved House AWB/Handling Date/CUSDEC No out of that form
 * entirely (still optional here, still editable via Update) rather than
 * leaving them required-but-hidden. `mawbNo` stays deliberately
 * non-unique — required just means non-empty, no uniqueness constraint.
 */
export const createShipmentRequestSchema = z.object({
  mawbNo: z.string().trim().min(1, 'MAWB No is required'),
  houseAwbNo: optional(z.string().trim().min(1)),
  airlineId: z.string().trim().min(1, 'Airline is required'),
  flightNo: z.string().trim().min(1, 'Flight No is required'),
  destinationAirportId: z.string().trim().min(1, 'Destination is required'),
  shipperId: z.string().trim().min(1, 'Shipper is required'),
  consigneeId: z.string().trim().min(1, 'Consignee is required'),
  commodityId: z.string().trim().min(1, 'Commodity is required'),
  flightDate: dateOnly,
  handlingDate: optional(dateOnly),
  depTime: time24,
  cusdecNo: optional(z.string().trim().min(1)),
});
export type CreateShipmentRequest = z.infer<typeof createShipmentRequestSchema>;

/** `version` is mandatory — every edit is an optimistic-lock check (ARCHITECTURE §20). */
export const updateShipmentRequestSchema = createShipmentRequestSchema.partial().extend({
  version: z.number().int().nonnegative(),
});
export type UpdateShipmentRequest = z.infer<typeof updateShipmentRequestSchema>;

/**
 * The read model denormalizes master-data *names* alongside their ids
 * (query-time join for display) — this is not a stored duplicate of
 * source-of-truth data (DEVELOPMENT_RULES §5), the id remains the only
 * thing persisted on the shipment row.
 */
export const shipmentSchema = z.object({
  id: z.string(),
  shipmentNo: z.string(),
  mawbNo: z.string().nullable(),
  houseAwbNo: z.string().nullable(),
  airlineId: z.string(),
  airlineName: z.string(),
  flightNo: z.string().nullable(),
  destinationAirportId: z.string().nullable(),
  destinationAirportCode: z.string().nullable(),
  shipperId: z.string(),
  shipperName: z.string(),
  consigneeId: z.string(),
  consigneeName: z.string(),
  commodityId: z.string(),
  commodityName: z.string(),
  flightDate: z.string(),
  handlingDate: z.string().nullable(),
  depTime: z.string(),
  cusdecNo: z.string().nullable(),
  boxCount: z.number().int().nullable(),
  weightKg: z.string().nullable(),
  // BR-43: the applied VALUE, snapshotted at capture — never a live
  // reference to the Rate Table row, so a later rate change can't rewrite
  // this shipment's history (AC-14). appliedBuyingRateId is informational
  // only (which period resolved it), never authoritative.
  appliedBuyingRate: z.string().nullable(),
  appliedBuyingRateId: z.string().nullable(),
  // BR-50/OQ-11: set once via POST /shipments/:id/actual-departure, immutable after.
  actualDepartureAt: z.string().nullable(),
  status: z.enum(SHIPMENT_STATUSES),
  version: z.number().int(),
  createdByUserId: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Shipment = z.infer<typeof shipmentSchema>;

/**
 * Aggregated from the exact same filtered query as `data` (ARCHITECTURE
 * §17: "A KPI that doesn't tie out to its own list is a defect") — no PRD
 * spec for the schedule's "KPI row" beyond DEVELOPMENT_PLAN.md naming it;
 * this is the minimal reading, flagged in the Phase 2 report.
 */
export const shipmentKpisSchema = z.object({
  total: z.number().int(),
  pending: z.number().int(),
  completed: z.number().int(),
  cancelled: z.number().int(),
});
export type ShipmentKpis = z.infer<typeof shipmentKpisSchema>;

export const shipmentListResponseSchema = z.object({
  data: z.array(shipmentSchema),
  meta: z.object({
    page: z.number().int(),
    pageSize: z.number().int(),
    total: z.number().int(),
  }),
  kpis: shipmentKpisSchema,
});
export type ShipmentListResponse = z.infer<typeof shipmentListResponseSchema>;

/** BR-15: schedule defaults to today+tomorrow, sorted by DEP TIME, when no dates are given. */
export const shipmentListQuerySchema = z.object({
  search: z.string().trim().min(1).optional(),
  dateFrom: dateOnly.optional(),
  dateTo: dateOnly.optional(),
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().max(100).optional(),
});
export type ShipmentListQuery = z.infer<typeof shipmentListQuerySchema>;

/** BR-11: cancellation requires a reason. */
export const cancellationRequestInputSchema = z.object({
  reason: z.string().trim().min(1, 'Cancellation reason is required'),
});
export type CancellationRequestInput = z.infer<typeof cancellationRequestInputSchema>;

export const reviewCancellationRequestInputSchema = z.object({
  note: z.string().trim().min(1).optional(),
});
export type ReviewCancellationRequestInput = z.infer<typeof reviewCancellationRequestInputSchema>;

export const cancellationRequestSchema = z.object({
  id: z.string(),
  shipmentId: z.string(),
  shipmentNo: z.string(),
  reason: z.string(),
  status: z.enum(CANCELLATION_REQUEST_STATUSES),
  requestedByUserId: z.string(),
  requestedAt: z.string(),
  reviewedByUserId: z.string().nullable(),
  reviewedAt: z.string().nullable(),
  reviewNote: z.string().nullable(),
});
export type CancellationRequest = z.infer<typeof cancellationRequestSchema>;
