import type { ShipmentAttachment as SharedShipmentAttachment } from '@hub-lanka/shared';

export interface ShipmentAttachmentRow {
  id: string;
  shipmentId: string;
  filename: string;
  contentType: string;
  size: number;
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
    uploadedByUserId: row.uploadedByUserId,
    createdAt: row.createdAt.toISOString(),
  };
}
