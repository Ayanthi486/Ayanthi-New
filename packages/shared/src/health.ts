import { z } from 'zod';

/**
 * Shape of the backend health check response, shared so the frontend
 * smoke test and the backend implementation cannot drift apart.
 */
export const healthCheckResponseSchema = z.object({
  status: z.enum(['ok', 'error']),
  info: z.record(z.string(), z.object({ status: z.literal('up') })).optional(),
  error: z.record(z.string(), z.object({ status: z.literal('down') })).optional(),
  details: z.record(z.string(), z.object({ status: z.enum(['up', 'down']) })).optional(),
});

export type HealthCheckResponse = z.infer<typeof healthCheckResponseSchema>;
