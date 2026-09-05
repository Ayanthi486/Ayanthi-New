import { Injectable } from '@nestjs/common';
import type { CreateInvoiceRequest, Invoice, UpdateInvoiceRequest } from '@hub-lanka/shared';
import { AuditService } from '../audit/audit.service';
import {
  BusinessRuleError,
  ConflictError,
  ForbiddenError,
  LockedError,
  NotFoundError,
} from '../common/errors/app-error';
import { PermissionsService } from '../identity/permissions.service';
import type { RequestUser } from '../identity/types';
import { PrismaService } from '../prisma/prisma.service';
import { computeLineAmounts, type InvoiceRow, toSharedInvoice } from './invoice.util';

const INVOICE_INCLUDE = {
  shipment: {
    select: {
      shipmentNo: true,
      mawbNo: true,
      flightNo: true,
      flightDate: true,
      boxCount: true,
      weightKg: true,
      appliedBuyingRate: true,
      destinationAirport: { select: { code: true } },
      commodity: { select: { name: true } },
      shipper: { select: { name: true, address: true } },
      consignee: { select: { name: true } },
    },
  },
  lines: true,
} as const;

/** ARCHITECTURE §20's exact confirmed message — the frontend branches on this. Shared with shipment/cargo/cost sheet. */
const CONFLICT_MESSAGE =
  'This shipment was updated by another user. Please review the latest information before saving.';

/**
 * Invoice (Phase 5, PRD §5.4/§6/§8/§9, CONTEXT.md §13). Manager-owned,
 * dual currency LKR/USD, create -> edit -> issue (immutable after issue —
 * no approval workflow, unlike Cost Sheet). BR-27/30/40/41/42/52/53/66.
 */
@Injectable()
export class InvoiceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly permissionsService: PermissionsService,
  ) {}

  async create(input: CreateInvoiceRequest, actor: RequestUser): Promise<Invoice> {
    await this.checkFieldPermissions(actor, input);

    const created = await this.auditService.auditedTransaction(
      this.prisma,
      { userId: actor.id, ipAddress: null, userAgent: null },
      async (tx) => {
        const shipment = await tx.shipment.findFirst({
          where: { id: input.shipmentId, isDeleted: false },
        });
        if (!shipment) throw new NotFoundError('Shipment not found');

        const existing = await tx.invoice.findUnique({ where: { shipmentId: input.shipmentId } });
        if (existing) {
          throw new ConflictError('An Invoice already exists for this shipment');
        }

        const lines = input.lines
          ? this.computeLinesForWrite(input.lines, {
              chargeableWeightKg: input.chargeableWeightKg ?? null,
              grossWeightKg: shipment.weightKg,
              exchangeRate: input.exchangeRate ?? null,
            })
          : [];

        return tx.invoice.create({
          data: {
            shipmentId: input.shipmentId,
            invoiceNo: input.invoiceNo ?? null,
            invoiceDate: input.invoiceDate ? new Date(`${input.invoiceDate}T00:00:00.000Z`) : null,
            exchangeRate: input.exchangeRate ?? null,
            termDays: input.termDays ?? null,
            chargeableWeightKg: input.chargeableWeightKg ?? null,
            createdByUserId: actor.id,
            lines: { create: lines },
          },
          include: INVOICE_INCLUDE,
        });
      },
    );

    return toSharedInvoice(created);
  }

  async getById(id: string, actor: RequestUser): Promise<Invoice> {
    await this.checkViewPermission(actor);
    const row = await this.findOrThrow(id);
    return toSharedInvoice(row);
  }

  async getByShipmentId(shipmentId: string, actor: RequestUser): Promise<Invoice> {
    await this.checkViewPermission(actor);
    const row = await this.prisma.invoice.findUnique({
      where: { shipmentId },
      include: INVOICE_INCLUDE,
    });
    if (!row) throw new NotFoundError('No Invoice exists yet for this shipment');
    return toSharedInvoice(row);
  }

  async update(id: string, input: UpdateInvoiceRequest, actor: RequestUser): Promise<Invoice> {
    await this.checkFieldPermissions(actor, input);

    const updated = await this.auditService.auditedTransaction(
      this.prisma,
      { userId: actor.id, ipAddress: null, userAgent: null },
      async (tx) => {
        const existing = await tx.invoice.findUnique({ where: { id }, include: INVOICE_INCLUDE });
        if (!existing) throw new NotFoundError('Invoice not found');
        if (existing.status === 'ISSUED') {
          throw new LockedError('This Invoice is Issued and locked against editing.');
        }

        const { version, lines, ...changes } = input;
        const chargeableWeightKg =
          changes.chargeableWeightKg !== undefined
            ? changes.chargeableWeightKg
            : (existing.chargeableWeightKg?.toString() ?? null);
        const exchangeRate =
          changes.exchangeRate !== undefined
            ? changes.exchangeRate
            : (existing.exchangeRate?.toString() ?? null);

        const result = await tx.invoice.updateMany({
          where: { id, version },
          data: {
            ...(changes.invoiceNo !== undefined ? { invoiceNo: changes.invoiceNo } : {}),
            ...(changes.invoiceDate !== undefined
              ? { invoiceDate: new Date(`${changes.invoiceDate}T00:00:00.000Z`) }
              : {}),
            ...(changes.exchangeRate !== undefined ? { exchangeRate: changes.exchangeRate } : {}),
            ...(changes.termDays !== undefined ? { termDays: changes.termDays } : {}),
            ...(changes.chargeableWeightKg !== undefined
              ? { chargeableWeightKg: changes.chargeableWeightKg }
              : {}),
            version: { increment: 1 },
          },
        });

        if (result.count === 0) {
          throw new ConflictError(CONFLICT_MESSAGE);
        }

        if (lines) {
          const computedLines = this.computeLinesForWrite(lines, {
            chargeableWeightKg,
            grossWeightKg: existing.shipment.weightKg,
            exchangeRate,
          });
          await tx.invoiceLine.deleteMany({ where: { invoiceId: id } });
          await tx.invoiceLine.createMany({
            data: computedLines.map((line) => ({ ...line, invoiceId: id })),
          });
        }

        return tx.invoice.findUniqueOrThrow({ where: { id }, include: INVOICE_INCLUDE });
      },
    );

    return toSharedInvoice(updated);
  }

  /**
   * BR-52/53/DEVELOPMENT_PLAN Phase 5: named transition, atomic. Decision
   * #13 — Idempotency-Key: a replay of the same key against an already-
   * Issued invoice returns the existing result instead of erroring; the
   * `version`-guarded update closes the genuine double-click race.
   */
  async issue(id: string, idempotencyKey: string | null, actor: RequestUser): Promise<Invoice> {
    const issued = await this.auditService.auditedTransaction(
      this.prisma,
      { userId: actor.id, ipAddress: null, userAgent: null },
      async (tx) => {
        const existing = await tx.invoice.findUnique({ where: { id }, include: INVOICE_INCLUDE });
        if (!existing) throw new NotFoundError('Invoice not found');

        if (existing.status === 'ISSUED') {
          if (idempotencyKey && existing.issueIdempotencyKey === idempotencyKey) {
            return existing;
          }
          throw new BusinessRuleError('This Invoice has already been issued');
        }

        const result = await tx.invoice.updateMany({
          where: { id, version: existing.version, status: 'DRAFT' },
          data: {
            status: 'ISSUED',
            issuedByUserId: actor.id,
            issuedAt: new Date(),
            issueIdempotencyKey: idempotencyKey,
            version: { increment: 1 },
          },
        });
        if (result.count === 0) {
          throw new ConflictError(CONFLICT_MESSAGE);
        }

        return tx.invoice.findUniqueOrThrow({ where: { id }, include: INVOICE_INCLUDE });
      },
    );

    return toSharedInvoice(issued);
  }

  /**
   * Decision #12: `invoice.exchange_rate.set`/`invoice.number.enter` are
   * deliberately distinct seeded permissions from the broader
   * `invoice.manage` — checked explicitly whenever the corresponding field
   * is present in the request, not silently folded into the coarser check.
   */
  private async checkFieldPermissions(
    actor: RequestUser,
    input: { exchangeRate?: string; invoiceNo?: string },
  ): Promise<void> {
    if (input.exchangeRate !== undefined) {
      const allowed = await this.permissionsService.hasPermission(
        actor.id,
        'invoice.exchange_rate.set',
      );
      if (!allowed) throw new ForbiddenError('Only a Manager may set the invoice exchange rate');
    }
    if (input.invoiceNo !== undefined) {
      const allowed = await this.permissionsService.hasPermission(actor.id, 'invoice.number.enter');
      if (!allowed) throw new ForbiddenError('Only a Manager may enter the invoice number');
    }
  }

  /**
   * Decision #11: `invoice.view` (Manager) and `invoice.view.readonly`
   * (Director) are disjoint permissions, not a broader/narrower pair like
   * Cost Sheet's `prepare`/`edit_released` — a genuine either/or, checked
   * here since `@RequirePermission` only expresses a single key.
   */
  private async checkViewPermission(actor: RequestUser): Promise<void> {
    const [canView, canViewReadonly] = await Promise.all([
      this.permissionsService.hasPermission(actor.id, 'invoice.view'),
      this.permissionsService.hasPermission(actor.id, 'invoice.view.readonly'),
    ]);
    if (!canView && !canViewReadonly) {
      throw new ForbiddenError('Missing permission: invoice.view or invoice.view.readonly');
    }
  }

  private computeLinesForWrite(
    lines: { description: string; weightBasis: 'CHARGEABLE' | 'GROSS' | 'FLAT'; rateUsd: string }[],
    context: {
      chargeableWeightKg: string | null;
      grossWeightKg: { toString(): string } | null;
      exchangeRate: string | null;
    },
  ) {
    return lines.map((line, index) => {
      const { amountUsd, amountLkr } = computeLineAmounts({
        rateUsd: line.rateUsd,
        weightBasis: line.weightBasis,
        chargeableWeightKg: context.chargeableWeightKg,
        grossWeightKg: context.grossWeightKg,
        exchangeRate: context.exchangeRate,
      });
      return {
        sortOrder: index,
        description: line.description,
        weightBasis: line.weightBasis,
        rateUsd: line.rateUsd,
        amountUsd,
        amountLkr,
      };
    });
  }

  private async findOrThrow(id: string): Promise<InvoiceRow> {
    const row = await this.prisma.invoice.findUnique({ where: { id }, include: INVOICE_INCLUDE });
    if (!row) throw new NotFoundError('Invoice not found');
    return row;
  }
}
