import { Injectable } from '@nestjs/common';
import type { SetCargoRequest, Shipment } from '@hub-lanka/shared';
import { AuditService } from '../audit/audit.service';
import { BusinessRuleError, ConflictError, NotFoundError } from '../common/errors/app-error';
import { DocumentsService } from '../documents/documents.service';
import type { RequestUser } from '../identity/types';
import { PrismaService } from '../prisma/prisma.service';
import {
  OPTIMISTIC_LOCK_CONFLICT_MESSAGE,
  SHIPMENT_WITH_NAMES_INCLUDE,
  toSharedShipment,
} from '../shipment/shipment.util';

/** BR-06: cargo handling. The sole place BOX/WEIGHT can be entered or edited — see shipment.ts's schema comment for why this moved out of the general shipment update path. */
@Injectable()
export class CargoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly documentsService: DocumentsService,
  ) {}

  async setBoxWeight(
    shipmentId: string,
    input: SetCargoRequest,
    actor: RequestUser,
  ): Promise<Shipment> {
    const updated = await this.auditService.auditedTransaction(
      this.prisma,
      { userId: actor.id, ipAddress: null, userAgent: null },
      async (tx) => {
        const existing = await tx.shipment.findFirst({
          where: { id: shipmentId, isDeleted: false },
        });
        if (!existing) throw new NotFoundError('Shipment not found');
        // Stricter than the general shipment.update lock (which blocks
        // COMPLETED and CANCELLED): cargo is "editable only while Pending".
        if (existing.status !== 'PENDING') {
          throw new BusinessRuleError(
            'Box and weight can only be entered while a shipment is Pending',
          );
        }

        const { version, ...changes } = input;
        const result = await tx.shipment.updateMany({
          where: { id: shipmentId, version },
          data: {
            ...(changes.boxCount !== undefined ? { boxCount: changes.boxCount } : {}),
            ...(changes.weightKg !== undefined ? { weightKg: changes.weightKg } : {}),
            version: { increment: 1 },
          },
        });

        if (result.count === 0) {
          throw new ConflictError(OPTIMISTIC_LOCK_CONFLICT_MESSAGE);
        }

        return tx.shipment.findUniqueOrThrow({
          where: { id: shipmentId },
          include: SHIPMENT_WITH_NAMES_INCLUDE,
        });
      },
    );

    // Decision #6 (Phase 7): BOX/WEIGHT feed Security Clearance/ADF/CDN's
    // view models directly and are also the BR-07 readiness gate itself —
    // an already-Issued document of any type gets a fresh DRAFT opened.
    await this.documentsService.openStaleIssuedDraftsIfNeeded(shipmentId, actor);

    return toSharedShipment(updated);
  }
}
