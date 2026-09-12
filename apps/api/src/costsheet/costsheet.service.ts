import { Injectable } from '@nestjs/common';
import {
  COST_SHEET_LINE_TYPES,
  type CostSheet,
  type CreateCostSheetRequest,
  type UpdateCostSheetRequest,
} from '@hub-lanka/shared';
import { AuditService } from '../audit/audit.service';
import {
  BusinessRuleError,
  ConflictError,
  LockedError,
  NotFoundError,
} from '../common/errors/app-error';
import { PermissionsService } from '../identity/permissions.service';
import type { RequestUser } from '../identity/types';
import { PrismaService } from '../prisma/prisma.service';
import { toSharedCostSheet } from './costsheet.util';

const COST_SHEET_INCLUDE = {
  shipment: { select: { shipmentNo: true } },
  lines: true,
} as const;

/** ARCHITECTURE §20's exact confirmed message — the frontend branches on this. */
const CONFLICT_MESSAGE =
  'This shipment was updated by another user. Please review the latest information before saving.';

/** Cost Sheet (Phase 4, PRD §5.3, CONTEXT.md §12). Release -> review -> approve — BR-59/60/61. */
@Injectable()
export class CostSheetService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly permissionsService: PermissionsService,
  ) {}

  async create(input: CreateCostSheetRequest, actor: RequestUser): Promise<CostSheet> {
    const created = await this.auditService.auditedTransaction(
      this.prisma,
      { userId: actor.id, ipAddress: null, userAgent: null },
      async (tx) => {
        const shipment = await tx.shipment.findFirst({
          where: { id: input.shipmentId, isDeleted: false },
        });
        if (!shipment) throw new NotFoundError('Shipment not found');

        const existing = await tx.costSheet.findUnique({ where: { shipmentId: input.shipmentId } });
        if (existing) {
          throw new ConflictError('A Cost Sheet already exists for this shipment');
        }

        return tx.costSheet.create({
          data: {
            shipmentId: input.shipmentId,
            snNo: input.snNo ?? null,
            createdByUserId: actor.id,
            // BR-32: the 11 fixed lines, all optional — created empty and
            // filled in during preparation/review.
            lines: {
              create: COST_SHEET_LINE_TYPES.map((lineType) => ({ lineType, amount: null })),
            },
          },
          include: COST_SHEET_INCLUDE,
        });
      },
    );

    return toSharedCostSheet(created);
  }

  async getById(id: string): Promise<CostSheet> {
    const row = await this.findOrThrow(id);
    return toSharedCostSheet(row);
  }

  async getByShipmentId(shipmentId: string): Promise<CostSheet> {
    const row = await this.prisma.costSheet.findUnique({
      where: { shipmentId },
      include: COST_SHEET_INCLUDE,
    });
    if (!row) throw new NotFoundError('No Cost Sheet exists yet for this shipment');
    return toSharedCostSheet(row);
  }

  /**
   * DRAFT and RELEASED are both editable by anyone holding costsheet.prepare
   * (Executive or Manager — the route guard already proved that); Manager's
   * costsheet.edit_released grant is redundant with prepare but kept as its
   * own permission for a future narrower-scoped role. APPROVED instead
   * requires costsheet.edit_approved (Manager only, direct request) — an
   * Executive who could edit at every earlier stage loses access the moment
   * the sheet is Approved. Checked here since the required permission
   * depends on the record's state, not just the route (ARCHITECTURE §9
   * layer 2: ownership/scope checks live in the service).
   */
  async update(id: string, input: UpdateCostSheetRequest, actor: RequestUser): Promise<CostSheet> {
    const updated = await this.auditService.auditedTransaction(
      this.prisma,
      { userId: actor.id, ipAddress: null, userAgent: null },
      async (tx) => {
        const existing = await tx.costSheet.findUnique({ where: { id } });
        if (!existing) throw new NotFoundError('Cost Sheet not found');

        if (existing.status === 'APPROVED') {
          const canEditApproved = await this.permissionsService.hasPermission(
            actor.id,
            'costsheet.edit_approved',
          );
          if (!canEditApproved) {
            throw new LockedError('This Cost Sheet is Approved — only a Manager may edit it now.');
          }
        }

        const { version, lines, ...changes } = input;
        const result = await tx.costSheet.updateMany({
          where: { id, version },
          data: {
            ...(changes.snNo !== undefined ? { snNo: changes.snNo } : {}),
            ...(changes.remarks !== undefined ? { remarks: changes.remarks } : {}),
            ...(changes.shiftLeaderSignature !== undefined
              ? { shiftLeaderSignature: changes.shiftLeaderSignature }
              : {}),
            version: { increment: 1 },
          },
        });

        if (result.count === 0) {
          throw new ConflictError(CONFLICT_MESSAGE);
        }

        if (lines) {
          for (const lineType of COST_SHEET_LINE_TYPES) {
            const amount = lines[lineType];
            if (amount === undefined) continue;
            await tx.costSheetLine.update({
              where: { costSheetId_lineType: { costSheetId: id, lineType } },
              data: { amount },
            });
          }
        }

        return tx.costSheet.findUniqueOrThrow({ where: { id }, include: COST_SHEET_INCLUDE });
      },
    );

    return toSharedCostSheet(updated);
  }

  /** BR-59: Executive (or Manager) releases a Draft Cost Sheet for Manager review. */
  async release(id: string, actor: RequestUser): Promise<CostSheet> {
    const released = await this.auditService.auditedTransaction(
      this.prisma,
      { userId: actor.id, ipAddress: null, userAgent: null },
      async (tx) => {
        const existing = await tx.costSheet.findUnique({ where: { id } });
        if (!existing) throw new NotFoundError('Cost Sheet not found');
        if (existing.status !== 'DRAFT') {
          throw new BusinessRuleError('Only a Draft Cost Sheet can be released');
        }

        return tx.costSheet.update({
          where: { id },
          data: { status: 'RELEASED', releasedByUserId: actor.id, releasedAt: new Date() },
          include: COST_SHEET_INCLUDE,
        });
      },
    );

    return toSharedCostSheet(released);
  }

  /** BR-61: Manager-only (permission-gated at the controller); AC-15 — cannot approve before release. Approval is a recorded signature, not a display field. */
  async approve(id: string, actor: RequestUser): Promise<CostSheet> {
    const approved = await this.auditService.auditedTransaction(
      this.prisma,
      { userId: actor.id, ipAddress: null, userAgent: null },
      async (tx) => {
        const existing = await tx.costSheet.findUnique({ where: { id } });
        if (!existing) throw new NotFoundError('Cost Sheet not found');
        if (existing.status !== 'RELEASED') {
          throw new BusinessRuleError('Only a Released Cost Sheet can be approved');
        }

        return tx.costSheet.update({
          where: { id },
          data: { status: 'APPROVED', approvedByUserId: actor.id, approvedAt: new Date() },
          include: COST_SHEET_INCLUDE,
        });
      },
    );

    return toSharedCostSheet(approved);
  }

  private async findOrThrow(id: string) {
    const row = await this.prisma.costSheet.findUnique({
      where: { id },
      include: COST_SHEET_INCLUDE,
    });
    if (!row) throw new NotFoundError('Cost Sheet not found');
    return row;
  }
}
