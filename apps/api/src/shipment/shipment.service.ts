import { Injectable } from '@nestjs/common';
import type {
  ChangeShipmentStatusRequest,
  CreateShipmentRequest,
  Shipment,
  ShipmentKpis,
  ShipmentListQuery,
  ShipmentListResponse,
  ShipmentStatus,
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
import { PermissionsService } from '../identity/permissions.service';
import type { RequestUser } from '../identity/types';
import { PrismaService } from '../prisma/prisma.service';
import { RatesService } from '../rates/rates.service';
import {
  OPTIMISTIC_LOCK_CONFLICT_MESSAGE,
  SHIPMENT_WITH_NAMES_INCLUDE,
  addDays,
  colomboToday,
  parseColomboDateTime,
  parseDateOnly,
  parseTime24,
  toSharedShipment,
} from './shipment.util';

const DEFAULT_PAGE_SIZE = 50;

/** Statuses treated as "still active" — editable via the general update path and eligible for cargo/buying-rate capture. */
const ACTIVE_STATUSES: ShipmentStatus[] = ['PENDING', 'CONFIRMED'];
/** Statuses a shipment can no longer be deleted from, once reached. */
const DELETE_LOCKED_STATUSES: ShipmentStatus[] = ['DEPARTED', 'PAYMENT_RECEIVED'];
const PAYMENT_STATUSES: ShipmentStatus[] = ['PAYMENT_PENDING', 'PAYMENT_RECEIVED'];

/** Shipment core (Phase 2, DEVELOPMENT_PLAN.md). All business rules live here — the controller only parses and delegates (ARCHITECTURE §4). */
@Injectable()
export class ShipmentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly ratesService: RatesService,
    private readonly documentsService: DocumentsService,
    private readonly cutoffService: CutoffService,
    private readonly permissionsService: PermissionsService,
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

    const [total, byStatus, rows] = await Promise.all([
      this.prisma.shipment.count({ where }),
      this.prisma.shipment.groupBy({ by: ['status'], where, _count: true }),
      this.prisma.shipment.findMany({
        where,
        orderBy: { depTime: 'asc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: SHIPMENT_WITH_NAMES_INCLUDE,
      }),
    ]);

    const countFor = (status: ShipmentStatus): number =>
      byStatus.find((row) => row.status === status)?._count ?? 0;
    const kpis: ShipmentKpis = {
      total,
      pending: countFor('PENDING'),
      confirmed: countFor('CONFIRMED'),
      cancelled: countFor('CANCELLED'),
      departed: countFor('DEPARTED'),
      paymentPending: countFor('PAYMENT_PENDING'),
      paymentReceived: countFor('PAYMENT_RECEIVED'),
    };

    return {
      data: rows.map(toSharedShipment),
      meta: { page, pageSize, total },
      kpis,
    };
  }

  async getById(id: string): Promise<Shipment> {
    const row = await this.findActiveOrThrow(id);
    return toSharedShipment(row);
  }

  /** BR-10: a shipment past Pending/Confirmed rejects edit (423). ARCHITECTURE §20: optimistic lock, stale version → 409. */
  async update(id: string, input: UpdateShipmentRequest, actor: RequestUser): Promise<Shipment> {
    const updated = await this.auditService.auditedTransaction(
      this.prisma,
      { userId: actor.id, ipAddress: null, userAgent: null },
      async (tx) => {
        const existing = await tx.shipment.findFirst({ where: { id, isDeleted: false } });
        if (!existing) throw new NotFoundError('Shipment not found');
        // BR-10/BR-12: once a shipment has moved past Pending/Confirmed
        // (Cancelled, Departed, or either Payment status), its core fields
        // are retained, not reopened for editing — matches CargoService's
        // stricter "Pending only" posture (see its own comment) so a
        // settled shipment's core fields can't be silently rewritten.
        if (!ACTIVE_STATUSES.includes(existing.status)) {
          throw new LockedError(
            `This shipment is ${existing.status} and locked against editing.`,
          );
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

  /** BR-46/BR-47/BR-49: a Manager may delete only a shipment they themselves created, and never one that has Departed or had Payment Received. Soft delete (OQ-9). */
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
        if (DELETE_LOCKED_STATUSES.includes(existing.status)) {
          throw new LockedError(`A ${existing.status} shipment cannot be deleted`);
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

  /**
   * The direct, no-approval status dropdown (Schedule grid) — replaces the
   * old cancellation-request/approve and completion-approve workflows
   * entirely. `shipment.status.update` (checked at the controller) grants
   * the base 4 values; the 2 Payment values additionally require
   * `shipment.status.payment`, checked here since it depends on the
   * request body, not just the route. Optimistic-lock version check same
   * as `update()`. Setting DEPARTED for the first time folds in what used
   * to be the separate "record actual departure" action (BR-50/OQ-11):
   * immutable once set, resolves any open cut-off alert to PASSED in the
   * same transaction.
   */
  async changeStatus(
    id: string,
    input: ChangeShipmentStatusRequest,
    actor: RequestUser,
  ): Promise<Shipment> {
    if (PAYMENT_STATUSES.includes(input.status)) {
      const allowed = await this.permissionsService.hasPermission(
        actor.id,
        'shipment.status.payment',
      );
      if (!allowed) {
        throw new ForbiddenError(`Missing permission: shipment.status.payment`);
      }
    }

    const updated = await this.auditService.auditedTransaction(
      this.prisma,
      { userId: actor.id, ipAddress: null, userAgent: null },
      async (tx) => {
        const existing = await tx.shipment.findFirst({ where: { id, isDeleted: false } });
        if (!existing) throw new NotFoundError('Shipment not found');

        let actualDepartureAt: Date | undefined;
        if (input.status === 'DEPARTED' && existing.actualDepartureAt === null) {
          if (!input.actualDepartureAt) {
            throw new ValidationError(
              'Actual departure date/time is required when setting status to Departed',
            );
          }
          actualDepartureAt = parseColomboDateTime(input.actualDepartureAt);
          await this.cutoffService.resolveForActualDeparture(tx, id, actualDepartureAt);
        }

        const result = await tx.shipment.updateMany({
          where: { id, version: input.version },
          data: {
            status: input.status,
            ...(actualDepartureAt ? { actualDepartureAt } : {}),
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
