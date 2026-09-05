import { Injectable } from '@nestjs/common';
import type { AdminUser } from '@hub-lanka/shared';
import { AuditService } from '../audit/audit.service';
import { ConflictError, NotFoundError } from '../common/errors/app-error';
import { PrismaService } from '../prisma/prisma.service';
import { PasswordHasherService } from './password-hasher.service';
import type { RequestUser } from './types';

interface UserWithRoles {
  id: string;
  email: string;
  fullName: string;
  isActive: boolean;
  createdAt: Date;
  userRoles: { role: { id: string; name: string } }[];
}

function toAdminUser(user: UserWithRoles): AdminUser {
  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    isActive: user.isActive,
    roles: user.userRoles.map((ur) => ({ id: ur.role.id, name: ur.role.name })),
    createdAt: user.createdAt.toISOString(),
  };
}

const USER_WITH_ROLES_INCLUDE = { userRoles: { include: { role: true } } } as const;

/** User administration (identity.user.manage — Manager only in the seed; see the Phase 1 report for why). */
@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwordHasher: PasswordHasherService,
    private readonly auditService: AuditService,
  ) {}

  async list(): Promise<AdminUser[]> {
    const users = await this.prisma.user.findMany({
      include: USER_WITH_ROLES_INCLUDE,
      orderBy: { createdAt: 'asc' },
    });
    return users.map(toAdminUser);
  }

  async create(
    input: { email: string; password: string; fullName: string; roleIds: string[] },
    actor: RequestUser,
  ): Promise<AdminUser> {
    const email = input.email.toLowerCase();
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new ConflictError('A user with this email already exists');
    }

    const passwordHash = await this.passwordHasher.hash(input.password);

    const created = await this.auditService.auditedTransaction(
      this.prisma,
      { userId: actor.id, ipAddress: null, userAgent: null },
      async (tx) => {
        const user = await tx.user.create({
          data: { email, passwordHash, fullName: input.fullName },
        });
        for (const roleId of input.roleIds) {
          await tx.userRole.create({
            data: { userId: user.id, roleId, assignedByUserId: actor.id },
          });
        }
        return tx.user.findUniqueOrThrow({
          where: { id: user.id },
          include: USER_WITH_ROLES_INCLUDE,
        });
      },
    );

    return toAdminUser(created);
  }

  async update(
    id: string,
    input: { fullName?: string; isActive?: boolean },
    actor: RequestUser,
  ): Promise<AdminUser> {
    const updated = await this.auditService.auditedTransaction(
      this.prisma,
      { userId: actor.id, ipAddress: null, userAgent: null },
      async (tx) => {
        const before = await tx.user.findUnique({ where: { id } });
        if (!before) {
          throw new NotFoundError('User not found');
        }

        const activationChanged =
          input.isActive !== undefined && input.isActive !== before.isActive;

        await tx.user.update({
          where: { id },
          data: {
            ...(input.fullName !== undefined ? { fullName: input.fullName } : {}),
            ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
            // Deactivation must invalidate any still-valid access token
            // immediately (ARCHITECTURE §8).
            ...(activationChanged ? { sessionValidFrom: new Date() } : {}),
          },
        });

        return tx.user.findUniqueOrThrow({ where: { id }, include: USER_WITH_ROLES_INCLUDE });
      },
    );

    return toAdminUser(updated);
  }

  async assignRole(userId: string, roleId: string, actor: RequestUser): Promise<AdminUser> {
    const updated = await this.auditService.auditedTransaction(
      this.prisma,
      { userId: actor.id, ipAddress: null, userAgent: null },
      async (tx) => {
        const user = await tx.user.findUnique({ where: { id: userId } });
        if (!user) throw new NotFoundError('User not found');

        const role = await tx.role.findUnique({ where: { id: roleId } });
        if (!role) throw new NotFoundError('Role not found');

        const existing = await tx.userRole.findUnique({
          where: { userId_roleId: { userId, roleId } },
        });
        if (!existing) {
          await tx.userRole.create({ data: { userId, roleId, assignedByUserId: actor.id } });
        }

        // Role assignment must take effect immediately, not after the
        // access token's TTL expires (ARCHITECTURE §8).
        await tx.user.update({ where: { id: userId }, data: { sessionValidFrom: new Date() } });

        return tx.user.findUniqueOrThrow({
          where: { id: userId },
          include: USER_WITH_ROLES_INCLUDE,
        });
      },
    );

    return toAdminUser(updated);
  }

  async unassignRole(userId: string, roleId: string, actor: RequestUser): Promise<AdminUser> {
    const updated = await this.auditService.auditedTransaction(
      this.prisma,
      { userId: actor.id, ipAddress: null, userAgent: null },
      async (tx) => {
        const existing = await tx.userRole.findUnique({
          where: { userId_roleId: { userId, roleId } },
        });
        if (!existing) {
          throw new NotFoundError('User does not hold this role');
        }

        await tx.userRole.delete({ where: { userId_roleId: { userId, roleId } } });
        await tx.user.update({ where: { id: userId }, data: { sessionValidFrom: new Date() } });

        return tx.user.findUniqueOrThrow({
          where: { id: userId },
          include: USER_WITH_ROLES_INCLUDE,
        });
      },
    );

    return toAdminUser(updated);
  }
}
