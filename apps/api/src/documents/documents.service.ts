import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  documentFieldsSchemaByType,
  DOCUMENT_TYPES,
  PDF_DOCUMENT_TYPES,
  type DocumentReadiness,
  type DocumentType,
  type ShipmentDocument as SharedShipmentDocument,
} from '@hub-lanka/shared';
import { AuditService } from '../audit/audit.service';
import {
  BusinessRuleError,
  ForbiddenError,
  LockedError,
  NotFoundError,
  ValidationError,
} from '../common/errors/app-error';
import type { EnvConfig } from '../config/env.validation';
import { PermissionsService } from '../identity/permissions.service';
import type { RequestUser } from '../identity/types';
import { PrinterAdapter } from '../printing/printer-adapter';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { renderAwbHtml } from './templates/awb.template';
import { renderAwbStickerHtml } from './templates/awb-sticker.template';
import { renderCdnHtml } from './templates/cdn.template';
import { renderSecurityClearanceHtml } from './templates/security-clearance.template';
import { DocumentRenderQueueService } from './rendering/document-render-queue.service';
import {
  buildShipmentViewModel,
  computeDocumentReadiness,
  DOCUMENT_BLOCKED_MESSAGE,
  toSharedDocument,
  type DocumentShipmentRow,
} from './documents.util';

const DOCUMENT_SHIPMENT_SELECT = {
  mawbNo: true,
  flightNo: true,
  flightDate: true,
  cusdecNo: true,
  boxCount: true,
  weightKg: true,
  destinationAirport: { select: { code: true } },
  shipper: { select: { name: true, address: true } },
  consignee: { select: { name: true, address: true } },
  commodity: { select: { name: true } },
} as const;

const PAGE_SIZE_BY_TYPE: Record<DocumentType, string> = {
  SECURITY_CLEARANCE: 'A4',
  AWB_STICKER: '12cm x 8cm',
  ADF: 'N/A',
  AWB: 'A4',
  CDN: 'A4',
};

/**
 * Documents (Phase 7, PRD §9, CONTEXT.md §15/§16). BR-07/25/26/33/34/35/36/
 * 62/63/64/65. `documents.manage` (Executive+Manager) creates/edits/issues;
 * `documents.view.readonly` (Director) reads only — same OR-permission
 * pattern as Invoice/Payment for GET routes.
 */
@Injectable()
export class DocumentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly permissionsService: PermissionsService,
    private readonly printerAdapter: PrinterAdapter,
    private readonly renderQueue: DocumentRenderQueueService,
    private readonly storage: StorageService,
    private readonly config: ConfigService<EnvConfig, true>,
  ) {}

  async getReadiness(shipmentId: string, actor: RequestUser): Promise<DocumentReadiness> {
    await this.checkViewPermission(actor);
    const shipment = await this.findShipmentOrThrow(shipmentId);
    return computeDocumentReadiness(shipment);
  }

  /** Idempotent: returns the latest editable DRAFT, creating version 1 if none exists yet. */
  async ensureDraft(
    shipmentId: string,
    type: DocumentType,
    actor: RequestUser,
  ): Promise<SharedShipmentDocument> {
    await this.checkManagePermission(actor);
    const shipment = await this.findShipmentOrThrow(shipmentId);
    const readiness = computeDocumentReadiness(shipment);
    if (!readiness.ready) throw new BusinessRuleError(DOCUMENT_BLOCKED_MESSAGE);

    const latest = await this.findLatest(shipmentId, type);
    if (latest && latest.status === 'DRAFT') {
      return toSharedDocument(latest, buildShipmentViewModel(type, shipment));
    }

    const created = await this.auditService.auditedTransaction(
      this.prisma,
      { userId: actor.id, ipAddress: null, userAgent: null },
      (tx) =>
        tx.shipmentDocument.create({
          data: {
            shipmentId,
            type,
            version: (latest?.version ?? 0) + 1,
            fieldData: {},
            createdByUserId: actor.id,
          },
        }),
    );
    return toSharedDocument(created, buildShipmentViewModel(type, shipment));
  }

  async getLatest(
    shipmentId: string,
    type: DocumentType,
    actor: RequestUser,
  ): Promise<SharedShipmentDocument> {
    await this.checkViewPermission(actor);
    const shipment = await this.findShipmentOrThrow(shipmentId);
    const latest = await this.findLatest(shipmentId, type);
    if (!latest) throw new NotFoundError('No document has been created yet for this type');
    return toSharedDocument(latest, buildShipmentViewModel(type, shipment));
  }

  async updateFieldData(
    shipmentId: string,
    type: DocumentType,
    fieldData: Record<string, unknown>,
    actor: RequestUser,
  ): Promise<SharedShipmentDocument> {
    await this.checkManagePermission(actor);
    const schema = documentFieldsSchemaByType[type];
    const parsed = schema.safeParse(fieldData);
    if (!parsed.success) {
      throw new ValidationError('Invalid document fields', parsed.error.flatten());
    }

    const shipment = await this.findShipmentOrThrow(shipmentId);
    const latest = await this.findLatest(shipmentId, type);
    if (!latest) throw new NotFoundError('No document has been created yet for this type');
    if (latest.status === 'ISSUED') {
      throw new LockedError('This document is Issued and locked against editing.');
    }

    const updated = await this.auditService.auditedTransaction(
      this.prisma,
      { userId: actor.id, ipAddress: null, userAgent: null },
      (tx) =>
        tx.shipmentDocument.update({ where: { id: latest.id }, data: { fieldData: parsed.data } }),
    );
    return toSharedDocument(updated, buildShipmentViewModel(type, shipment));
  }

  /**
   * Decision #3: ADF is never issuable (BR-63, AC-20) — rejected before any
   * other work. AWB Sticker freezes fieldData/snapshot but renders no PDF
   * (Print only, no Download). Security Clearance/AWB/CDN additionally
   * render via the worker and store the file — ARCHITECTURE §14's "Issue
   * document" transaction: version freeze + snapshot + stored file
   * reference + audit, all atomic.
   */
  async issue(
    shipmentId: string,
    type: DocumentType,
    actor: RequestUser,
  ): Promise<SharedShipmentDocument> {
    await this.checkManagePermission(actor);
    if (type === 'ADF') {
      throw new BusinessRuleError('The ADF has no issue action (BR-63 — no print path)');
    }

    const shipment = await this.findShipmentOrThrow(shipmentId);
    const readiness = computeDocumentReadiness(shipment);
    if (!readiness.ready) throw new BusinessRuleError(DOCUMENT_BLOCKED_MESSAGE);

    const latest = await this.findLatest(shipmentId, type);
    if (!latest) throw new NotFoundError('No document has been created yet for this type');
    if (latest.status === 'ISSUED') {
      throw new LockedError('This document is already Issued.');
    }

    const viewModel = buildShipmentViewModel(type, shipment);
    const snapshot = { viewModel, fieldData: latest.fieldData };

    let storageKey: string | null = null;
    if ((PDF_DOCUMENT_TYPES as readonly string[]).includes(type)) {
      const html = this.renderHtml(type, viewModel, latest.fieldData as Record<string, unknown>);
      const timeoutMs = this.config.get('PDF_RENDER_TIMEOUT_MS', { infer: true }) + 10_000;
      const result = await this.renderQueue.renderAndAwait(html, timeoutMs);
      storageKey = result.storageKey;
    } else {
      // AWB Sticker: no stored file — still goes through the same PrinterAdapter
      // interface for the browser print path (decision #7), no Puppeteer/worker.
      const html = this.renderHtml(type, viewModel, latest.fieldData as Record<string, unknown>);
      await this.printerAdapter.print({ html, pageSize: PAGE_SIZE_BY_TYPE[type] });
    }

    const issued = await this.auditService.auditedTransaction(
      this.prisma,
      { userId: actor.id, ipAddress: null, userAgent: null },
      async (tx) => {
        // Guard the write on `status: 'DRAFT'` rather than the earlier
        // `latest.status` read: two concurrent Issue calls (double-click,
        // or two tabs) can both pass the check above while still DRAFT and
        // both render — this update is what actually decides a winner.
        // The loser's `count` comes back 0 and it throws the exact same
        // LockedError the sequential "already Issued" case already does,
        // rather than silently overwriting the winner's storageKey.
        const result = await tx.shipmentDocument.updateMany({
          where: { id: latest.id, status: 'DRAFT' },
          data: {
            status: 'ISSUED',
            // Round-trip through JSON to satisfy Prisma's InputJsonValue typing
            // (matches AuditService#toInputJson's identical pattern).
            snapshot: JSON.parse(JSON.stringify(snapshot)) as object,
            storageKey,
            issuedByUserId: actor.id,
            issuedAt: new Date(),
          },
        });
        if (result.count === 0) {
          throw new LockedError('This document is already Issued.');
        }
        return tx.shipmentDocument.findUniqueOrThrow({ where: { id: latest.id } });
      },
    );
    return toSharedDocument(issued, viewModel);
  }

  async getPrintPayload(
    shipmentId: string,
    type: DocumentType,
    actor: RequestUser,
  ): Promise<{ html: string; pageSize: string }> {
    await this.checkViewPermission(actor);
    if (type === 'ADF') {
      throw new BusinessRuleError('The ADF has no print action (BR-63)');
    }

    const shipment = await this.findShipmentOrThrow(shipmentId);
    const latest = await this.findLatest(shipmentId, type);
    if (!latest) throw new NotFoundError('No document has been created yet for this type');

    // BR-07, server-side: an ISSUED document's snapshot is already frozen
    // (box/weight were confirmed present at issue-time — ARCHITECTURE §11),
    // so only a DRAFT's live view model needs re-checking here.
    if (latest.status !== 'ISSUED') {
      const readiness = computeDocumentReadiness(shipment);
      if (!readiness.ready) throw new BusinessRuleError(DOCUMENT_BLOCKED_MESSAGE);
    }

    const viewModel =
      latest.status === 'ISSUED' && latest.snapshot
        ? (latest.snapshot as { viewModel: Record<string, unknown> }).viewModel
        : buildShipmentViewModel(type, shipment);
    const html = this.renderHtml(type, viewModel, latest.fieldData as Record<string, unknown>);
    return { html, pageSize: PAGE_SIZE_BY_TYPE[type] };
  }

  async downloadFile(
    documentId: string,
    actor: RequestUser,
  ): Promise<{ buffer: Buffer; filename: string }> {
    await this.checkViewPermission(actor);
    const document = await this.prisma.shipmentDocument.findUnique({ where: { id: documentId } });
    if (!document) throw new NotFoundError('Document not found');
    if (!document.storageKey) throw new NotFoundError('This document has no stored file');

    const buffer = await this.storage.read(document.storageKey);
    return { buffer, filename: `${document.type.toLowerCase()}-v${document.version}.pdf` };
  }

  /**
   * Decision #6: called from ShipmentService#update after a successful edit
   * — a shipment field any document type reads live changed, so any type
   * whose latest version is ISSUED gets a fresh editable DRAFT opened. The
   * issued version itself is never altered (ARCHITECTURE §11).
   */
  async openStaleIssuedDraftsIfNeeded(shipmentId: string, actor: RequestUser): Promise<void> {
    for (const type of DOCUMENT_TYPES) {
      const latest = await this.findLatest(shipmentId, type);
      if (latest && latest.status === 'ISSUED') {
        await this.auditService.auditedTransaction(
          this.prisma,
          { userId: actor.id, ipAddress: null, userAgent: null },
          (tx) =>
            tx.shipmentDocument.create({
              data: {
                shipmentId,
                type,
                version: latest.version + 1,
                fieldData: {},
                createdByUserId: actor.id,
              },
            }),
        );
      }
    }
  }

  /**
   * `viewModel`/`fieldData` are only shaped precisely per-type at the
   * template call site (each template's own parameter types, from PRD §9's
   * confirmed fields) — genuinely dynamic dispatch on `type`, so a cast is
   * unavoidable here; `unknown` as the intermediate keeps it explicit rather
   * than silently unsafe.
   */
  private renderHtml(
    type: DocumentType,
    viewModel: Record<string, unknown>,
    fieldData: Record<string, unknown>,
  ): string {
    switch (type) {
      case 'SECURITY_CLEARANCE':
        return renderSecurityClearanceHtml(
          viewModel as unknown as Parameters<typeof renderSecurityClearanceHtml>[0],
          fieldData,
        );
      case 'AWB_STICKER':
        return renderAwbStickerHtml(
          viewModel as unknown as Parameters<typeof renderAwbStickerHtml>[0],
          fieldData,
        );
      case 'AWB':
        return renderAwbHtml(
          viewModel as unknown as Parameters<typeof renderAwbHtml>[0],
          fieldData,
        );
      case 'CDN':
        return renderCdnHtml(
          viewModel as unknown as Parameters<typeof renderCdnHtml>[0],
          fieldData,
        );
      case 'ADF':
        throw new BusinessRuleError('The ADF has no rendered output (BR-63)');
    }
  }

  private async findLatest(shipmentId: string, type: DocumentType) {
    return this.prisma.shipmentDocument.findFirst({
      where: { shipmentId, type },
      orderBy: { version: 'desc' },
    });
  }

  private async findShipmentOrThrow(shipmentId: string): Promise<DocumentShipmentRow> {
    const shipment = await this.prisma.shipment.findFirst({
      where: { id: shipmentId, isDeleted: false },
      select: DOCUMENT_SHIPMENT_SELECT,
    });
    if (!shipment) throw new NotFoundError('Shipment not found');
    return shipment;
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
