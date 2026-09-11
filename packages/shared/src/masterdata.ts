import { z } from 'zod';

/**
 * Master data (PRD §7: "Commodity, Airline, Shipper, Consignee must
 * reference an active master record"). Soft-deleted via `isActive`
 * (ARCHITECTURE §5) — never hard-deleted, since shipment history references
 * these rows by id.
 */

const name = z.string().trim().min(1, 'Name is required');

export const createShipperRequestSchema = z.object({
  name,
  address: z.string().trim().min(1).optional(),
  // Never required — a shipper/consignee can be added without one.
  contact: z.string().trim().min(1).optional(),
});
export type CreateShipperRequest = z.infer<typeof createShipperRequestSchema>;

export const createConsigneeRequestSchema = createShipperRequestSchema;
export type CreateConsigneeRequest = z.infer<typeof createConsigneeRequestSchema>;

export const shipperSchema = z.object({
  id: z.string(),
  name: z.string(),
  address: z.string().nullable(),
  contact: z.string().nullable(),
  isActive: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Shipper = z.infer<typeof shipperSchema>;
export type Consignee = Shipper;

/**
 * Airlines are identified by their 2-character IATA designator — letters
 * and/or digits (e.g. EK, G9, 9W), always stored uppercase.
 */
const airlineCode = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z0-9]{2}$/, 'Code must be exactly 2 letters/digits (e.g. EK, G9)');

export const createAirlineRequestSchema = z.object({
  code: airlineCode,
  name,
});
export type CreateAirlineRequest = z.infer<typeof createAirlineRequestSchema>;

export const airlineSchema = z.object({
  id: z.string(),
  code: z.string(),
  name: z.string(),
  isActive: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Airline = z.infer<typeof airlineSchema>;

/** Destinations are identified by a 3-letter airport code (e.g. DXB), always stored uppercase. */
const airportCode = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z]{3}$/, 'Code must be exactly 3 letters (e.g. DXB)');

export const createAirportRequestSchema = z.object({
  code: airportCode,
  name,
});
export type CreateAirportRequest = z.infer<typeof createAirportRequestSchema>;

export const airportSchema = z.object({
  id: z.string(),
  code: z.string(),
  name: z.string(),
  isActive: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Airport = z.infer<typeof airportSchema>;

/** BR-16: 24-hour picker, no AM/PM. */
const time24 = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Expected 24-hour time as HH:mm');

/**
 * A reusable, confirmed flight (airline + flight number + scheduled
 * departure time) — captured once here, at the moment a flight is added,
 * rather than re-entered on the Add Shipment form.
 */
const flightNumber = z.string().trim().regex(/^\d{4}$/, 'Flight number must be exactly 4 digits (e.g. 0356)');

export const createFlightRequestSchema = z.object({
  airlineId: z.string().trim().min(1, 'Airline is required'),
  flightNo: flightNumber,
  // Required at creation — the shipment form relies entirely on the
  // selected/created Flight's own depTime, with no fallback field of its
  // own, so a Flight can never exist without one.
  depTime: time24,
});
export type CreateFlightRequest = z.infer<typeof createFlightRequestSchema>;

export const flightSchema = z.object({
  id: z.string(),
  airlineId: z.string(),
  airlineName: z.string(),
  flightNo: z.string(),
  depTime: z.string(),
  isActive: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Flight = z.infer<typeof flightSchema>;

const commodityCode = z.string().trim().regex(/^\d{1,6}$/, 'Code must be up to 6 digits');

/** BR-17: Executive and Manager may both add commodities. */
export const createCommodityRequestSchema = z.object({
  name,
  code: commodityCode,
  // Same "HH:mm" shape/widget as Flight's depTime, reused for a duration
  // (e.g. "03:30" = 3 hours 30 minutes) rather than a time of day.
  delayHours: time24,
});
export type CreateCommodityRequest = z.infer<typeof createCommodityRequestSchema>;

export const commoditySchema = z.object({
  id: z.string(),
  name: z.string(),
  code: z.string(),
  delayHours: z.string(),
  isActive: z.boolean(),
  createdByUserId: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Commodity = z.infer<typeof commoditySchema>;
