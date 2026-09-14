import type { ShipmentAttachment as SharedShipmentAttachment } from '@hub-lanka/shared';

export interface ShipmentAttachmentRow {
  id: string;
  shipmentId: string;
  filename: string;
  contentType: string;
  size: number;
  category: string;
  uploadedByUserId: string;
  createdAt: Date;
}

export function toSharedAttachment(row: ShipmentAttachmentRow): SharedShipmentAttachment {
  return {
    id: row.id,
    shipmentId: row.shipmentId,
    filename: row.filename,
    contentType: row.contentType,
    size: row.size,
    category: row.category,
    uploadedByUserId: row.uploadedByUserId,
    createdAt: row.createdAt.toISOString(),
  };
}
