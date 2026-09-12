import { Injectable } from '@nestjs/common';
import type { ShipmentAttachment } from '@hub-lanka/shared';
import { AuditService } from '../audit/audit.service';
import { BusinessRuleError, ForbiddenError, NotFoundError } from '../common/errors/app-error';
import { PermissionsService } from '../identity/permissions.service';
import type { RequestUser } from '../identity/types';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { extensionForKind, validateFileKind } from '../storage/storage.util';
import { toSharedAttachment } from './attachments.util';

export interface UploadedAttachmentFile {
  buffer: Buffer;
  mimetype: string;
  originalname: string;
}

/**
 * Free-form supporting files for a shipment (customs forms, correspondence,
 * scans) — distinct from the Documents module's five PRD-defined, per-type
 * generated/uploaded documents. No fieldData/viewModel/issue workflow, no
 * one-per-type limit, no BR-07 box/weight readiness gate (these aren't the
 * official generated documents that rule protects). Reuses
 * `documents.manage`/`documents.view.readonly` — same trusted-staff
 * boundary as everything else under the Documents tab, not a new permission.
 */
@Injectable()
export class AttachmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly permissionsService: PermissionsService,
    private readonly storage: StorageService,
  ) {}

  async list(shipmentId: string, actor: RequestUser): Promise<ShipmentAttachment[]> {
    await this.checkViewPermission(actor);
    await this.findShipmentOrThrow(shipmentId);

    const rows = await this.prisma.shipmentAttachment.findMany({
      where: { shipmentId },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map(toSharedAttachment);
  }

  async upload(
    shipmentId: string,
    file: UploadedAttachmentFile,
    actor: RequestUser,
  ): Promise<ShipmentAttachment> {
    await this.checkManagePermission(actor);
    await this.findShipmentOrThrow(shipmentId);

    const kind = validateFileKind(file.mimetype, file.buffer);
    if (!kind) {
      throw new BusinessRuleError(
        'Attachments must be a PDF, JPEG or PNG file matching its declared type',
      );
    }

    const saved = await this.storage.save({
      buffer: file.buffer,
      prefix: 'attachments',
      extension: extensionForKind(kind),
    });

    const created = await this.auditService.auditedTransaction(
      this.prisma,
      { userId: actor.id, ipAddress: null, userAgent: null },
      (tx) =>
        tx.shipmentAttachment.create({
          data: {
            shipmentId,
            filename: file.originalname,
            storageKey: saved.key,
            contentType: file.mimetype,
            size: saved.size,
            uploadedByUserId: actor.id,
          },
        }),
    );
    return toSharedAttachment(created);
  }

  async download(id: string, actor: RequestUser): Promise<{ buffer: Buffer; attachment: ShipmentAttachment }> {
    await this.checkViewPermission(actor);
    const row = await this.prisma.shipmentAttachment.findUnique({ where: { id } });
    if (!row) throw new NotFoundError('Attachment not found');

    const buffer = await this.storage.read(row.storageKey);
    return { buffer, attachment: toSharedAttachment(row) };
  }

  async remove(id: string, actor: RequestUser): Promise<void> {
    await this.checkManagePermission(actor);
    const row = await this.prisma.shipmentAttachment.findUnique({ where: { id } });
    if (!row) throw new NotFoundError('Attachment not found');

    await this.auditService.auditedTransaction(
      this.prisma,
      { userId: actor.id, ipAddress: null, userAgent: null },
      (tx) => tx.shipmentAttachment.delete({ where: { id } }),
    );
    await this.storage.delete(row.storageKey);
  }

  private async findShipmentOrThrow(shipmentId: string): Promise<void> {
    const shipment = await this.prisma.shipment.findFirst({
      where: { id: shipmentId, isDeleted: false },
      select: { id: true },
    });
    if (!shipment) throw new NotFoundError('Shipment not found');
  }

  private async checkManagePermission(actor: RequestUser): Promise<void> {
    const allowed = await this.permissionsService.hasPermission(actor.id, 'documents.manage');
    if (!allowed) throw new ForbiddenError('Missing permission: documents.manage');
  }

  private async checkViewPermission(actor: RequestUser): Promise<void> {
    const [canManage, canViewReadonly] = await Promise.all([
      this.permissionsService.hasPermission(actor.id, 'documents.manage'),
      this.permissionsService.hasPermission(actor.id, 'documents.view.readonly'),
    ]);
    if (!canManage && !canViewReadonly) {
      throw new ForbiddenError('Missing permission: documents.manage or documents.view.readonly');
    }
  }
}
