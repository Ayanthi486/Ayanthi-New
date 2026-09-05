import { Injectable } from '@nestjs/common';
import type { AdminRole } from '@hub-lanka/shared';
import { PrismaService } from '../prisma/prisma.service';

/** Read-only — roles and their permission grants are seed/config-managed
 * this phase, not a runtime editor (ARCHITECTURE §9: "remapping must be
 * configuration, not a sprint"). Used to populate the assign-role UI. */
@Injectable()
export class RolesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(): Promise<AdminRole[]> {
    const roles = await this.prisma.role.findMany({
      include: { rolePermissions: { include: { permission: true } } },
      orderBy: { name: 'asc' },
    });

    return roles.map((role) => ({
      id: role.id,
      name: role.name,
      permissions: role.rolePermissions.map((rp) => rp.permission.key),
    }));
  }
}
