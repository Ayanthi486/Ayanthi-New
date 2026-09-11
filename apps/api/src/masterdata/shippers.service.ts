import { Injectable } from '@nestjs/common';
import type { CreateShipperRequest, Shipper } from '@hub-lanka/shared';
import { AuditService } from '../audit/audit.service';
import { NotFoundError } from '../common/errors/app-error';
import type { RequestUser } from '../identity/types';
import { PrismaService } from '../prisma/prisma.service';
import { toShipper } from './masterdata.util';

/** PRD §7: shipment.shipperId must reference an active record. Soft-deleted (ARCHITECTURE §5) — never hard-deleted, since shipment history references these rows. */
@Injectable()
export class ShippersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async list(includeInactive: boolean): Promise<Shipper[]> {
    const rows = await this.prisma.shipper.findMany({
      where: includeInactive ? undefined : { isActive: true },
      orderBy: { name: 'asc' },
    });
    return rows.map(toShipper);
  }

  async create(input: CreateShipperRequest, actor: RequestUser): Promise<Shipper> {
    const created = await this.auditService.auditedTransaction(
      this.prisma,
      { userId: actor.id, ipAddress: null, userAgent: null },
      (tx) =>
        tx.shipper.create({
          data: { name: input.name, address: input.address ?? null, contact: input.contact ?? null },
        }),
    );
    return toShipper(created);
  }

  async deactivate(id: string, actor: RequestUser): Promise<Shipper> {
    const updated = await this.auditService.auditedTransaction(
      this.prisma,
      { userId: actor.id, ipAddress: null, userAgent: null },
      async (tx) => {
        const existing = await tx.shipper.findUnique({ where: { id } });
        if (!existing) throw new NotFoundError('Shipper not found');
        return tx.shipper.update({ where: { id }, data: { isActive: false } });
      },
    );
    return toShipper(updated);
  }
}
