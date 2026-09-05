import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface ResolvedPermissions {
  roles: string[];
  permissions: string[];
}

/**
 * Resolves a user's roles and effective permission set fresh from the
 * database on every call — never cached, never embedded in a JWT — so a
 * role or permission change takes effect on the user's very next request
 * without needing to invalidate any token (ARCHITECTURE §9).
 */
@Injectable()
export class PermissionsService {
  constructor(private readonly prisma: PrismaService) {}

  async resolveForUser(userId: string): Promise<ResolvedPermissions> {
    const userRoles = await this.prisma.userRole.findMany({
      where: { userId },
      include: {
        role: {
          include: {
            rolePermissions: { include: { permission: true } },
          },
        },
      },
    });

    const roles = new Set<string>();
    const permissions = new Set<string>();
    for (const userRole of userRoles) {
      roles.add(userRole.role.name);
      for (const rolePermission of userRole.role.rolePermissions) {
        permissions.add(rolePermission.permission.key);
      }
    }

    return { roles: [...roles], permissions: [...permissions] };
  }

  async hasPermission(userId: string, permission: string): Promise<boolean> {
    const count = await this.prisma.rolePermission.count({
      where: {
        permission: { key: permission },
        role: { userRoles: { some: { userId } } },
      },
    });
    return count > 0;
  }
}
