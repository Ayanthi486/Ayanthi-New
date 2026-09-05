import { Injectable } from '@nestjs/common';
import type {
  CancellationRequest,
  CreateShipmentRequest,
  Shipment,
  ShipmentListQuery,
  ShipmentListResponse,
  UpdateShipmentRequest,
} from '@hub-lanka/shared';
import { AuditService } from '../audit/audit.service';
import {
  BusinessRuleError,
  ConflictError,
  ForbiddenError,
  LockedError,
  NotFoundError,
  ValidationError,
} from '../common/errors/app-error';
import { CutoffService } from '../cutoff/cutoff.service';
import { DocumentsService } from '../documents/documents.service';
import type { Prisma } from '../generated/prisma/client';
import type { RequestUser } from '../identity/types';
import { PrismaService } from '../prisma/prisma.service';
import { RatesService } from '../rates/rates.service';
import {
  OPTIMISTIC_LOCK_CONFLICT_MESSAGE,
  SHIPMENT_WITH_NAMES_INCLUDE,
  addDays,
  colomboToday,
  parseDateOnly,
  parseTime24,
  toSharedShipment,
} from './shipment.util';

const DEFAULT_PAGE_SIZE = 50;

interface CancellationRequestRow {
  id: string;
  shipmentId: string;
  reason: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  requestedByUserId: string;
  requestedAt: Date;
  reviewedByUserId: string | null;
  reviewedAt: Date | null;
  reviewNote: string | null;
  shipment: { shipmentNo: string };
}

function toSharedCancellationRequest(row: CancellationRequestRow): CancellationRequest {
  return {
    id: row.id,
    shipmentId: row.shipmentId,
    shipmentNo: row.shipment.shipmentNo,
    reason: row.reason,
    status: row.status,
    requestedByUserId: row.requestedByUserId,
    requestedAt: row.requestedAt.toISOString(),
    reviewedByUserId: row.reviewedByUserId,
    reviewedAt: row.reviewedAt ? row.reviewedAt.toISOString() : null,
    reviewNote: row.reviewNote,
  };
}

/** Shipment core (Phase 2, DEVELOPMENT_PLAN.md). All business rules live here — the controller only parses and delegates (ARCHITECTURE §4). */
@Injectable()
export class ShipmentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly ratesService: RatesService,
    private readonly documentsService: DocumentsService,
    private readonly cutoffService: CutoffService,
  ) {}

  async create(input: CreateShipmentRequest, actor: RequestUser): Promise<Shipment> {
    const created = await this.auditService.auditedTransaction(
      this.prisma,
      { userId: actor.id, ipAddress: null, userAgent: null },
      async (tx) => {
        await this.assertActiveReferences(tx, {
          airlineId: input.airlineId,
          shipperId: input.shipperId,
          consigneeId: input.consigneeId,
          commodityId: input.commodityId,
          destinationAirportId: input.destinationAirportId,
        });

        return tx.shipment.create({
          data: {
            mawbNo: input.mawbNo ?? null,
            houseAwbNo: input.houseAwbNo ?? null,
            airlineId: input.airlineId,
            flightNo: input.flightNo ?? null,
            destinationAirportId: input.destinationAirportId ?? null,
            shipperId: input.shipperId,
            consigneeId: input.consigneeId,
            commodityId: input.commodityId,
            flightDate: parseDateOnly(input.flightDate),
            handlingDate: input.handlingDate ? parseDateOnly(input.handlingDate) : null,
            depTime: parseTime24(input.depTime),
            cusdecNo: input.cusdecNo ?? null,
            createdByUserId: actor.id,
          },
          include: SHIPMENT_WITH_NAMES_INCLUDE,
        });
      },
    );

    return toSharedShipment(created);
  }

  /** BR-15/AC-05/AC-06: defaults to today+tomorrow (Asia/Colombo) sorted by DEP TIME; search and explicit dates narrow that filter. */
  async list(query: ShipmentListQuery): Promise<ShipmentListResponse> {
    const dateFrom = query.dateFrom ?? query.dateTo ?? colomboToday();
    const dateTo = query.dateTo ?? (query.dateFrom ? query.dateFrom : addDays(dateFrom, 1));

    const where = {
      isDeleted: false,
      flightDate: { gte: parseDateOnly(dateFrom), lte: parseDateOnly(dateTo) },
      ...(query.search
        ? { shipmentNo: { contains: query.search, mode: 'insensitive' as const } }
        : {}),
    };

    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? DEFAULT_PAGE_SIZE;

    const [total, pending, completed, cancelled, rows] = await Promise.all([
      this.prisma.shipment.count({ where }),
      this.prisma.shipment.count({ where: { ...where, status: 'PENDING' } }),
      this.prisma.shipment.count({ where: { ...where, status: 'COMPLETED' } }),
      this.prisma.shipment.count({ where: { ...where, status: 'CANCELLED' } }),
      this.prisma.shipment.findMany({
        where,
        orderBy: { depTime: 'asc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: SHIPMENT_WITH_NAMES_INCLUDE,
      }),
    ]);

    return {
      data: rows.map(toSharedShipment),
      meta: { page, pageSize, total },
      kpis: { total, pending, completed, cancelled },
    };
  }

  async getById(id: string): Promise<Shipment> {
    const row = await this.findActiveOrThrow(id);
    return toSharedShipment(row);
  }

  /** BR-10: a Completed shipment rejects edit (423). ARCHITECTURE §20: optimistic lock, stale version → 409. */
  async update(id: string, input: UpdateShipmentRequest, actor: RequestUser): Promise<Shipment> {
    const updated = await this.auditService.auditedTransaction(
      this.prisma,
      { userId: actor.id, ipAddress: null, userAgent: null },
      async (tx) => {
        const existing = await tx.shipment.findFirst({ where: { id, isDeleted: false } });
        if (!existing) throw new NotFoundError('Shipment not found');
        if (existing.status === 'COMPLETED') {
          throw new LockedError('This shipment is Completed and locked against editing.');
        }
        // BR-12: a Cancelled shipment's record is retained, not reopened for
        // editing — matches CargoService's stricter "Pending only" posture
        // (see its own comment) so a cancelled shipment's core fields can't
        // be silently rewritten after the fact either.
        if (existing.status === 'CANCELLED') {
          throw new LockedError('This shipment is Cancelled and locked against editing.');
        }

        const { version, ...changes } = input;
        await this.assertActiveReferences(tx, {
          airlineId: changes.airlineId,
          shipperId: changes.shipperId,
          consigneeId: changes.consigneeId,
          commodityId: changes.commodityId,
          destinationAirportId: changes.destinationAirportId,
        });

        const result = await tx.shipment.updateMany({
          where: { id, version },
          data: {
            ...(changes.mawbNo !== undefined ? { mawbNo: changes.mawbNo } : {}),
            ...(changes.houseAwbNo !== undefined ? { houseAwbNo: changes.houseAwbNo } : {}),
            ...(changes.airlineId !== undefined ? { airlineId: changes.airlineId } : {}),
            ...(changes.flightNo !== undefined ? { flightNo: changes.flightNo } : {}),
            ...(changes.destinationAirportId !== undefined
              ? { destinationAirportId: changes.destinationAirportId }
              : {}),
            ...(changes.shipperId !== undefined ? { shipperId: changes.shipperId } : {}),
            ...(changes.consigneeId !== undefined ? { consigneeId: changes.consigneeId } : {}),
            ...(changes.commodityId !== undefined ? { commodityId: changes.commodityId } : {}),
            ...(changes.flightDate !== undefined
              ? { flightDate: parseDateOnly(changes.flightDate) }
              : {}),
            ...(changes.handlingDate !== undefined
              ? { handlingDate: changes.handlingDate ? parseDateOnly(changes.handlingDate) : null }
              : {}),
            ...(changes.depTime !== undefined ? { depTime: parseTime24(changes.depTime) } : {}),
            ...(changes.cusdecNo !== undefined ? { cusdecNo: changes.cusdecNo } : {}),
            version: { increment: 1 },
          },
        });

        if (result.count === 0) {
          throw new ConflictError(OPTIMISTIC_LOCK_CONFLICT_MESSAGE);
        }

        return tx.shipment.findUniqueOrThrow({
          where: { id },
          include: SHIPMENT_WITH_NAMES_INCLUDE,
        });
      },
    );

    // Decision #6 (Phase 7): a shipment field any document type reads live
    // just changed — any type whose latest version is already Issued gets a
    // fresh editable DRAFT opened. Best-effort follow-up outside the update
    // transaction itself (bookkeeping, not a financial mutation) rather than
    // threading a second module's transaction client through this one.
    await this.documentsService.openStaleIssuedDraftsIfNeeded(id, actor);

    return toSharedShipment(updated);
  }

  /**
   * BR-44/BR-45/BR-43/AC-14: Manager-only (permission-gated at the
   * controller), resolved at the moment of capture (OQ-4 — see the Phase 3
   * report), restricted to PENDING (same edit-while-pending posture as
   * cargo). Stores the resolved VALUE, not a live reference, so a later
   * Rate Table change can never rewrite this shipment's history.
   */
  async setBuyingRate(id: string, actor: RequestUser): Promise<Shipment> {
    const updated = await this.auditService.auditedTransaction(
      this.prisma,
      { userId: actor.id, ipAddress: null, userAgent: null },
      async (tx) => {
        const existing = await tx.shipment.findFirst({ where: { id, isDeleted: false } });
        if (!existing) throw new NotFoundError('Shipment not found');
        if (existing.status !== 'PENDING') {
          throw new BusinessRuleError(
            'The buying rate can only be captured while a shipment is Pending',
          );
        }

        const resolved = await this.ratesService.resolveCurrent(
          tx,
          existing.airlineId,
          parseDateOnly(colomboToday()),
        );
        if (!resolved) {
          throw new BusinessRuleError('No Rate Table entry is effective for this airline yet');
        }

        return tx.shipment.update({
          where: { id },
          data: {
            appliedBuyingRate: resolved.rateUsdPerKg.toString(),
            appliedBuyingRateId: resolved.id,
          },
          include: SHIPMENT_WITH_NAMES_INCLUDE,
        });
      },
    );

    return toSharedShipment(updated);
  }

  /** BR-46/BR-47/BR-49: a Manager may delete only a shipment they themselves created, and never a Completed one. Soft delete (OQ-9). */
  async delete(id: string, actor: RequestUser): Promise<Shipment> {
    const deleted = await this.auditService.auditedTransaction(
      this.prisma,
      { userId: actor.id, ipAddress: null, userAgent: null },
      async (tx) => {
        const existing = await tx.shipment.findFirst({ where: { id, isDeleted: false } });
        if (!existing) throw new NotFoundError('Shipment not found');
        if (existing.createdByUserId !== actor.id) {
          throw new ForbiddenError('You may only delete shipments you created yourself');
        }
        if (existing.status === 'COMPLETED') {
          throw new LockedError('A Completed shipment cannot be deleted');
        }

        return tx.shipment.update({
          where: { id },
          data: { isDeleted: true, deletedAt: new Date() },
          include: SHIPMENT_WITH_NAMES_INCLUDE,
        });
      },
    );

    return toSharedShipment(deleted);
  }

  /** BR-11: only from Pending, reason mandatory (validated by Zod before this runs). */
  async requestCancellation(
    shipmentId: string,
    reason: string,
    actor: RequestUser,
  ): Promise<CancellationRequest> {
    const created = await this.auditService.auditedTransaction(
      this.prisma,
      { userId: actor.id, ipAddress: null, userAgent: null },
      async (tx) => {
        const shipment = await this.findActiveOrThrow(shipmentId, tx);
        if (shipment.status !== 'PENDING') {
          throw new BusinessRuleError('Only a Pending shipment may have a cancellation requested');
        }

        const openRequest = await tx.shipmentCancellationRequest.findFirst({
          where: { shipmentId, status: 'PENDING' },
        });
        if (openRequest) {
          throw new ConflictError('A cancellation request is already pending for this shipment');
        }

        return tx.shipmentCancellationRequest.create({
          data: { shipmentId, reason, requestedByUserId: actor.id },
          include: { shipment: { select: { shipmentNo: true } } },
        });
      },
    );

    return toSharedCancellationRequest(created);
  }

  async listCancellationQueue(
    status: 'PENDING' | 'APPROVED' | 'REJECTED' = 'PENDING',
  ): Promise<CancellationRequest[]> {
    const rows = await this.prisma.shipmentCancellationRequest.findMany({
      where: { status },
      orderBy: { requestedAt: 'asc' },
      include: { shipment: { select: { shipmentNo: true } } },
    });
    return rows.map(toSharedCancellationRequest);
  }

  /** Manager-only (permission-gated at the controller). Approve transitions the shipment to CANCELLED (BR-12); reject leaves it Pending, re-requestable. */
  async reviewCancellation(
    requestId: string,
    decision: 'approve' | 'reject',
    actor: RequestUser,
    note?: string,
  ): Promise<CancellationRequest> {
    const reviewed = await this.auditService.auditedTransaction(
      this.prisma,
      { userId: actor.id, ipAddress: null, userAgent: null },
      async (tx) => {
        const request = await tx.shipmentCancellationRequest.findUnique({
          where: { id: requestId },
        });
        if (!request) throw new NotFoundError('Cancellation request not found');
        if (request.status !== 'PENDING') {
          throw new BusinessRuleError('This cancellation request has already been reviewed');
        }

        if (decision === 'approve') {
          const shipment = await tx.shipment.findFirst({
            where: { id: request.shipmentId, isDeleted: false },
          });
          if (!shipment) throw new NotFoundError('Shipment not found');
          if (shipment.status !== 'PENDING') {
            throw new BusinessRuleError('Only a Pending shipment can be cancelled');
          }
          await tx.shipment.update({ where: { id: shipment.id }, data: { status: 'CANCELLED' } });
        }

        return tx.shipmentCancellationRequest.update({
          where: { id: requestId },
          data: {
            status: decision === 'approve' ? 'APPROVED' : 'REJECTED',
            reviewedByUserId: actor.id,
            reviewedAt: new Date(),
            reviewNote: note ?? null,
          },
          include: { shipment: { select: { shipmentNo: true } } },
        });
      },
    );

    return toSharedCancellationRequest(reviewed);
  }

  /** BR-09: single guarded PENDING → COMPLETED transition. */
  async complete(id: string, actor: RequestUser): Promise<Shipment> {
    const completed = await this.auditService.auditedTransaction(
      this.prisma,
      { userId: actor.id, ipAddress: null, userAgent: null },
      async (tx) => {
        const existing = await this.findActiveOrThrow(id, tx);
        if (existing.status === 'COMPLETED') {
          throw new LockedError('This shipment is already Completed');
        }
        if (existing.status === 'CANCELLED') {
          throw new BusinessRuleError('A Cancelled shipment cannot be completed');
        }

        return tx.shipment.update({
          where: { id },
          data: { status: 'COMPLETED' },
          include: SHIPMENT_WITH_NAMES_INCLUDE,
        });
      },
    );

    return toSharedShipment(completed);
  }

  /**
   * BR-50/OQ-11: records the one confirmed candidate for "actual flight
   * departure" (Phase 8 report, explicit user decision). Immutable once
   * set — a real-world fact, not something to silently overwrite — and
   * resolves any open cut-off alert to PASSED in the same transaction
   * (CutoffService#resolveForActualDeparture, ARCHITECTURE §2: modules talk
   * through public service interfaces).
   */
  async recordActualDeparture(id: string, actor: RequestUser): Promise<Shipment> {
    const updated = await this.auditService.auditedTransaction(
      this.prisma,
      { userId: actor.id, ipAddress: null, userAgent: null },
      async (tx) => {
        const existing = await this.findActiveOrThrow(id, tx);
        if (existing.actualDepartureAt !== null) {
          throw new LockedError('Actual departure has already been recorded for this shipment.');
        }

        const now = new Date();
        await this.cutoffService.resolveForActualDeparture(tx, id, now);

        return tx.shipment.update({
          where: { id },
          data: { actualDepartureAt: now },
          include: SHIPMENT_WITH_NAMES_INCLUDE,
        });
      },
    );

    return toSharedShipment(updated);
  }

  /** PRD §7: shipper/consignee/commodity/airline/destination must each reference an active master record. */
  private async assertActiveReferences(
    tx: Prisma.TransactionClient,
    refs: {
      airlineId?: string;
      shipperId?: string;
      consigneeId?: string;
      commodityId?: string;
      destinationAirportId?: string;
    },
  ): Promise<void> {
    if (refs.airlineId !== undefined) {
      const row = await tx.airline.findUnique({ where: { id: refs.airlineId } });
      if (!row || !row.isActive)
        throw new ValidationError('Airline does not reference an active master record');
    }
    if (refs.shipperId !== undefined) {
      const row = await tx.shipper.findUnique({ where: { id: refs.shipperId } });
      if (!row || !row.isActive)
        throw new ValidationError('Shipper does not reference an active master record');
    }
    if (refs.consigneeId !== undefined) {
      const row = await tx.consignee.findUnique({ where: { id: refs.consigneeId } });
      if (!row || !row.isActive)
        throw new ValidationError('Consignee does not reference an active master record');
    }
    if (refs.commodityId !== undefined) {
      const row = await tx.commodity.findUnique({ where: { id: refs.commodityId } });
      if (!row || !row.isActive)
        throw new ValidationError('Commodity does not reference an active master record');
    }
    if (refs.destinationAirportId !== undefined && refs.destinationAirportId !== null) {
      const row = await tx.airport.findUnique({ where: { id: refs.destinationAirportId } });
      if (!row || !row.isActive)
        throw new ValidationError('Destination does not reference an active master record');
    }
  }

  private async findActiveOrThrow(id: string, tx: Pick<PrismaService, 'shipment'> = this.prisma) {
    const row = await tx.shipment.findFirst({
      where: { id, isDeleted: false },
      include: SHIPMENT_WITH_NAMES_INCLUDE,
    });
    if (!row) throw new NotFoundError('Shipment not found');
    return row;
  }
}
