import { z } from 'zod';

/**
 * Stable API error envelope (ARCHITECTURE §7 / §19). Every error response
 * from apps/api conforms to this shape so the frontend can branch on
 * `error.code` rather than parsing message text.
 */
export const apiErrorResponseSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.unknown().optional(),
  }),
});

export type ApiErrorResponse = z.infer<typeof apiErrorResponseSchema>;
