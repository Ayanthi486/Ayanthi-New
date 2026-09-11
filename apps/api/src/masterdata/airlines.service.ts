import { Injectable } from '@nestjs/common';
import type { Airline, CreateAirlineRequest } from '@hub-lanka/shared';
import { AuditService } from '../audit/audit.service';
import { NotFoundError } from '../common/errors/app-error';
import type { RequestUser } from '../identity/types';
import { PrismaService } from '../prisma/prisma.service';
import { toAirline } from './masterdata.util';

/** BR-58/PRD §7: shipment.airlineId must reference an active record. Soft-deleted (ARCHITECTURE §5). */
@Injectable()
export class AirlinesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async list(includeInactive: boolean): Promise<Airline[]> {
    const rows = await this.prisma.airline.findMany({
      where: includeInactive ? undefined : { isActive: true },
      orderBy: { name: 'asc' },
    });
    return rows.map(toAirline);
  }

  async create(input: CreateAirlineRequest, actor: RequestUser): Promise<Airline> {
    const created = await this.auditService.auditedTransaction(
      this.prisma,
      { userId: actor.id, ipAddress: null, userAgent: null },
      (tx) => tx.airline.create({ data: { code: input.code, name: input.name } }),
    );
    return toAirline(created);
  }

  async deactivate(id: string, actor: RequestUser): Promise<Airline> {
    const updated = await this.auditService.auditedTransaction(
      this.prisma,
      { userId: actor.id, ipAddress: null, userAgent: null },
      async (tx) => {
        const existing = await tx.airline.findUnique({ where: { id } });
        if (!existing) throw new NotFoundError('Airline not found');
        return tx.airline.update({ where: { id }, data: { isActive: false } });
      },
    );
    return toAirline(updated);
  }
}
