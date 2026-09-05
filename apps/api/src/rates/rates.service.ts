import { Injectable } from '@nestjs/common';
import type { CreateRateRequest, RateTableEntry } from '@hub-lanka/shared';
import { AuditService } from '../audit/audit.service';
import { BusinessRuleError, ValidationError } from '../common/errors/app-error';
import type { RequestUser } from '../identity/types';
import { PrismaService } from '../prisma/prisma.service';
import { parseDateOnly, toRateTableEntry } from './rates.util';

/**
 * Rate Table (Phase 3, PRD §8/§11, BR-39/42/43/44/45). There is
 * deliberately no "update rate value" method: every rate change is a new
 * period, and creating one auto-closes the airline's currently open
 * period — see schema.prisma's RateTable model comment for the full
 * rationale (BR-43: history must never be rewritten).
 */
@Injectable()
export class RatesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async create(input: CreateRateRequest, actor: RequestUser): Promise<RateTableEntry> {
    const effectiveFrom = parseDateOnly(input.effectiveFrom);

    const created = await this.auditService.auditedTransaction(
      this.prisma,
      { userId: actor.id, ipAddress: null, userAgent: null },
      async (tx) => {
        const airline = await tx.airline.findUnique({ where: { id: input.airlineId } });
        if (!airline || !airline.isActive) {
          throw new ValidationError('Airline does not reference an active master record');
        }

        const openPeriod = await tx.rateTable.findFirst({
          where: { airlineId: input.airlineId, effectiveTo: null },
        });

        if (openPeriod) {
          if (openPeriod.effectiveFrom >= effectiveFrom) {
            throw new BusinessRuleError(
              "The new rate period must start after the airline's currently open period began",
            );
          }
          const closingDate = new Date(effectiveFrom);
          closingDate.setUTCDate(closingDate.getUTCDate() - 1);
          await tx.rateTable.update({
            where: { id: openPeriod.id },
            data: { effectiveTo: closingDate },
          });
        }

        return tx.rateTable.create({
          data: {
            airlineId: input.airlineId,
            rateUsdPerKg: input.rateUsdPerKg,
            effectiveFrom,
            createdByUserId: actor.id,
          },
          include: { airline: { select: { name: true } } },
        });
      },
    );

    return toRateTableEntry(created);
  }

  async list(airlineId?: string): Promise<RateTableEntry[]> {
    const rows = await this.prisma.rateTable.findMany({
      where: airlineId ? { airlineId } : undefined,
      orderBy: [{ airlineId: 'asc' }, { effectiveFrom: 'desc' }],
      include: { airline: { select: { name: true } } },
    });
    return rows.map(toRateTableEntry);
  }

  /**
   * BR-45: the period effective at `atDate` for `airlineId`, or `null` if
   * none is configured yet. `tx` accepts either the main PrismaService or a
   * transaction client so callers (ShipmentService#setBuyingRate) can
   * resolve within their own audited transaction.
   */
  async resolveCurrent(
    tx: Pick<PrismaService, 'rateTable'>,
    airlineId: string,
    atDate: Date,
  ): Promise<{ id: string; rateUsdPerKg: { toString(): string } } | null> {
    return tx.rateTable.findFirst({
      where: {
        airlineId,
        effectiveFrom: { lte: atDate },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: atDate } }],
      },
      orderBy: { effectiveFrom: 'desc' },
    });
  }
}
