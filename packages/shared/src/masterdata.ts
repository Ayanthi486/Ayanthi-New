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
});
export type CreateShipperRequest = z.infer<typeof createShipperRequestSchema>;

export const createConsigneeRequestSchema = createShipperRequestSchema;
export type CreateConsigneeRequest = z.infer<typeof createConsigneeRequestSchema>;

export const shipperSchema = z.object({
  id: z.string(),
  name: z.string(),
  address: z.string().nullable(),
  isActive: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Shipper = z.infer<typeof shipperSchema>;
export type Consignee = Shipper;

export const createAirlineRequestSchema = z.object({ name });
export type CreateAirlineRequest = z.infer<typeof createAirlineRequestSchema>;

export const airlineSchema = z.object({
  id: z.string(),
  name: z.string(),
  isActive: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Airline = z.infer<typeof airlineSchema>;

export const createAirportRequestSchema = z.object({
  code: z.string().trim().min(1, 'Code is required'),
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

/** BR-17: Executive and Manager may both add commodities. */
export const createCommodityRequestSchema = z.object({ name });
export type CreateCommodityRequest = z.infer<typeof createCommodityRequestSchema>;

export const commoditySchema = z.object({
  id: z.string(),
  name: z.string(),
  isActive: z.boolean(),
  createdByUserId: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Commodity = z.infer<typeof commoditySchema>;
