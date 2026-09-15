import { Injectable } from '@nestjs/common';
import type { Commodity, CreateCommodityRequest, UpdateCommodityRequest } from '@hub-lanka/shared';
import { AuditService } from '../audit/audit.service';
import { NotFoundError } from '../common/errors/app-error';
import type { RequestUser } from '../identity/types';
import { PrismaService } from '../prisma/prisma.service';
import { parseTime24 } from '../shipment/shipment.util';
import { toCommodity } from './masterdata.util';

/** BR-17: Executive and Manager may both create commodities (masterdata.commodity.create); deactivation is masterdata.manage (Manager only) — see the controller. */
@Injectable()
export class CommoditiesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async list(includeInactive: boolean): Promise<Commodity[]> {
    const rows = await this.prisma.commodity.findMany({
      where: includeInactive ? undefined : { isActive: true },
      orderBy: { name: 'asc' },
    });
    return rows.map(toCommodity);
  }

  async create(input: CreateCommodityRequest, actor: RequestUser): Promise<Commodity> {
    const created = await this.auditService.auditedTransaction(
      this.prisma,
      { userId: actor.id, ipAddress: null, userAgent: null },
      (tx) =>
        tx.commodity.create({
          data: {
            name: input.name,
            code: input.code,
            delayHours: parseTime24(input.delayHours),
            createdByUserId: actor.id,
          },
        }),
    );
    return toCommodity(created);
  }

  async update(id: string, input: UpdateCommodityRequest, actor: RequestUser): Promise<Commodity> {
    const updated = await this.auditService.auditedTransaction(
      this.prisma,
      { userId: actor.id, ipAddress: null, userAgent: null },
      async (tx) => {
        const existing = await tx.commodity.findUnique({ where: { id } });
        if (!existing) throw new NotFoundError('Commodity not found');
        return tx.commodity.update({
          where: { id },
          data: {
            name: input.name,
            code: input.code,
            delayHours: parseTime24(input.delayHours),
          },
        });
      },
    );
    return toCommodity(updated);
  }

  async deactivate(id: string, actor: RequestUser): Promise<Commodity> {
    const updated = await this.auditService.auditedTransaction(
      this.prisma,
      { userId: actor.id, ipAddress: null, userAgent: null },
      async (tx) => {
        const existing = await tx.commodity.findUnique({ where: { id } });
        if (!existing) throw new NotFoundError('Commodity not found');
        return tx.commodity.update({ where: { id }, data: { isActive: false } });
      },
    );
    return toCommodity(updated);
  }
}
