import { z } from 'zod';

/**
 * Free-form supporting files for a shipment (customs forms, correspondence,
 * scans) — distinct from the five PRD-defined `ShipmentDocument` types
 * (documents.ts): no fieldData/viewModel/issue workflow, no one-per-type
 * limit. Any number of attachments, each independently downloadable/removable.
 */
export const shipmentAttachmentSchema = z.object({
  id: z.string(),
  shipmentId: z.string(),
  filename: z.string(),
  contentType: z.string(),
  size: z.number().int(),
  uploadedByUserId: z.string(),
  createdAt: z.string(),
});
export type ShipmentAttachment = z.infer<typeof shipmentAttachmentSchema>;
