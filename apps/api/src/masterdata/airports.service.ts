import { Injectable } from '@nestjs/common';
import type { Airport, CreateAirportRequest } from '@hub-lanka/shared';
import { AuditService } from '../audit/audit.service';
import { NotFoundError } from '../common/errors/app-error';
import type { RequestUser } from '../identity/types';
import { PrismaService } from '../prisma/prisma.service';
import { toAirport } from './masterdata.util';

/** PRD §7: shipment.destinationAirportId, when present, must reference an active record. Soft-deleted (ARCHITECTURE §5). */
@Injectable()
export class AirportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async list(includeInactive: boolean): Promise<Airport[]> {
    const rows = await this.prisma.airport.findMany({
      where: includeInactive ? undefined : { isActive: true },
      orderBy: { code: 'asc' },
    });
    return rows.map(toAirport);
  }

  async create(input: CreateAirportRequest, actor: RequestUser): Promise<Airport> {
    const created = await this.auditService.auditedTransaction(
      this.prisma,
      { userId: actor.id, ipAddress: null, userAgent: null },
      (tx) => tx.airport.create({ data: { code: input.code, name: input.name } }),
    );
    return toAirport(created);
  }

  async deactivate(id: string, actor: RequestUser): Promise<Airport> {
    const updated = await this.auditService.auditedTransaction(
      this.prisma,
      { userId: actor.id, ipAddress: null, userAgent: null },
      async (tx) => {
        const existing = await tx.airport.findUnique({ where: { id } });
        if (!existing) throw new NotFoundError('Airport not found');
        return tx.airport.update({ where: { id }, data: { isActive: false } });
      },
    );
    return toAirport(updated);
  }
}
