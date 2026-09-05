import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { CutoffAlert as SharedCutoffAlert } from '@hub-lanka/shared';
import { AuditService } from '../audit/audit.service';
import { LockedError, NotFoundError } from '../common/errors/app-error';
import type { EnvConfig } from '../config/env.validation';
import type { RequestUser } from '../identity/types';
import { PrismaService } from '../prisma/prisma.service';
import {
  computeCutoffState,
  isMoreSevere,
  toSharedCutoffAlert,
  type CutoffThresholds,
} from './cutoff.util';

/**
 * Cut-off (Phase 8, PRD §5.5, CONTEXT.md §18). BR-21/BR-50. `evaluateAll` is
 * the cron body (worker-only, ARCHITECTURE §15 — "one process only");
 * `acknowledge`/`listActive` are the HTTP-facing half. Same service either
 * way, imported by both `AppModule` and `WorkerModule`
 * (ARCHITECTURE §2 — modules talk through public service interfaces).
 */
@Injectable()
export class CutoffService {
  private readonly logger = new Logger(CutoffService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly config: ConfigService<EnvConfig, true>,
  ) {}

  private getThresholds(): CutoffThresholds {
    return {
      approachingHours: this.config.get('CUTOFF_APPROACHING_HOURS', { infer: true }),
      urgentHours: this.config.get('CUTOFF_URGENT_HOURS', { infer: true }),
    };
  }

  /** Decision #4: Cancelled and soft-deleted shipments are excluded; Completed is not (BR-67). */
  async evaluateAll(now: Date = new Date()): Promise<void> {
    const thresholds = this.getThresholds();
    const shipments = await this.prisma.shipment.findMany({
      where: { isDeleted: false, status: { in: ['PENDING', 'COMPLETED'] } },
      select: {
        id: true,
        flightDate: true,
        depTime: true,
        actualDepartureAt: true,
        cutoffAlert: true,
      },
    });

    let changed = 0;
    for (const shipment of shipments) {
      const computed = computeCutoffState(shipment, now, thresholds);
      const existing = shipment.cutoffAlert;

      if (computed === null) {
        if (existing && existing.state !== 'PASSED') {
          await this.prisma.cutoffAlert.delete({ where: { id: existing.id } });
          changed++;
        }
        continue;
      }

      if (!existing) {
        await this.prisma.cutoffAlert.create({
          data: { shipmentId: shipment.id, state: computed, raisedAt: now },
        });
        changed++;
        continue;
      }

      if (existing.state === computed) continue;

      const escalating = isMoreSevere(computed, existing.state);
      await this.prisma.cutoffAlert.update({
        where: { id: existing.id },
        data: {
          state: computed,
          resolvedAt: computed === 'PASSED' ? now : existing.resolvedAt,
          ...(escalating ? { acknowledgedAt: null, acknowledgedByUserId: null } : {}),
        },
      });
      changed++;
    }

    if (changed > 0) {
      this.logger.log(
        `Cut-off evaluation: ${changed} alert(s) changed out of ${shipments.length} shipment(s)`,
      );
    }
  }

  async acknowledge(shipmentId: string, actor: RequestUser): Promise<SharedCutoffAlert> {
    const updated = await this.auditService.auditedTransaction(
      this.prisma,
      { userId: actor.id, ipAddress: null, userAgent: null },
      async (tx) => {
        const existing = await tx.cutoffAlert.findUnique({ where: { shipmentId } });
        if (!existing) throw new NotFoundError('No active cut-off alert for this shipment');
        if (existing.state === 'PASSED') {
          throw new LockedError('This cut-off alert is already resolved.');
        }
        return tx.cutoffAlert.update({
          where: { id: existing.id },
          data: { acknowledgedAt: new Date(), acknowledgedByUserId: actor.id },
        });
      },
    );
    return toSharedCutoffAlert(updated);
  }

  /** Keyed by `shipment.view` (all three roles already see the schedule this augments) — no separate view permission. */
  async listActive(): Promise<SharedCutoffAlert[]> {
    const rows = await this.prisma.cutoffAlert.findMany({
      where: { state: { not: 'PASSED' } },
      orderBy: { raisedAt: 'asc' },
    });
    return rows.map(toSharedCutoffAlert);
  }

  /**
   * Called from ShipmentService#recordActualDeparture, inside the same
   * transaction, with the SAME `tx` client — not a second, separate write.
   */
  async resolveForActualDeparture(
    tx: Pick<PrismaService, 'cutoffAlert'>,
    shipmentId: string,
    now: Date,
  ): Promise<void> {
    const existing = await tx.cutoffAlert.findUnique({ where: { shipmentId } });
    if (existing && existing.state !== 'PASSED') {
      await tx.cutoffAlert.update({
        where: { id: existing.id },
        data: { state: 'PASSED', resolvedAt: now },
      });
    }
  }
}
