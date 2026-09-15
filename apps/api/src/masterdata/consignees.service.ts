import { Injectable } from '@nestjs/common';
import type { Consignee, CreateConsigneeRequest, UpdateConsigneeRequest } from '@hub-lanka/shared';
import { AuditService } from '../audit/audit.service';
import { NotFoundError } from '../common/errors/app-error';
import type { RequestUser } from '../identity/types';
import { PrismaService } from '../prisma/prisma.service';
import { toConsignee } from './masterdata.util';

/** PRD §7: shipment.consigneeId must reference an active record. Soft-deleted (ARCHITECTURE §5). */
@Injectable()
export class ConsigneesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async list(includeInactive: boolean): Promise<Consignee[]> {
    const rows = await this.prisma.consignee.findMany({
      where: includeInactive ? undefined : { isActive: true },
      orderBy: { name: 'asc' },
    });
    return rows.map(toConsignee);
  }

  async create(input: CreateConsigneeRequest, actor: RequestUser): Promise<Consignee> {
    const created = await this.auditService.auditedTransaction(
      this.prisma,
      { userId: actor.id, ipAddress: null, userAgent: null },
      (tx) =>
        tx.consignee.create({
          data: { name: input.name, address: input.address ?? null, contact: input.contact ?? null },
        }),
    );
    return toConsignee(created);
  }

  async update(id: string, input: UpdateConsigneeRequest, actor: RequestUser): Promise<Consignee> {
    const updated = await this.auditService.auditedTransaction(
      this.prisma,
      { userId: actor.id, ipAddress: null, userAgent: null },
      async (tx) => {
        const existing = await tx.consignee.findUnique({ where: { id } });
        if (!existing) throw new NotFoundError('Consignee not found');
        return tx.consignee.update({
          where: { id },
          data: { name: input.name, address: input.address, contact: input.contact },
        });
      },
    );
    return toConsignee(updated);
  }

  async deactivate(id: string, actor: RequestUser): Promise<Consignee> {
    const updated = await this.auditService.auditedTransaction(
      this.prisma,
      { userId: actor.id, ipAddress: null, userAgent: null },
      async (tx) => {
        const existing = await tx.consignee.findUnique({ where: { id } });
        if (!existing) throw new NotFoundError('Consignee not found');
        return tx.consignee.update({ where: { id }, data: { isActive: false } });
      },
    );
    return toConsignee(updated);
  }
}
