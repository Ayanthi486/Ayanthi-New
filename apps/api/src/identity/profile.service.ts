import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { MeResponse } from '@hub-lanka/shared';
import { AuditService } from '../audit/audit.service';
import type { EnvConfig } from '../config/env.validation';
import { BusinessRuleError, NotFoundError } from '../common/errors/app-error';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { extensionForKind, mimeTypeForKey, validateFileKind } from '../storage/storage.util';
import { PermissionsService } from './permissions.service';
import type { RequestUser } from './types';

export interface UploadedAvatar {
  buffer: Buffer;
  mimetype: string;
}

interface ProfileUser {
  id: string;
  email: string;
  fullName: string;
  avatarStorageKey: string | null;
  idCardNo: string | null;
}

/**
 * Self-service profile — every method here only ever touches the calling
 * user's own row (userId always comes from CurrentUser(), never a route
 * param), so there is no cross-user access path to guard against beyond
 * the standard @AuthenticatedOnly() session check (ARCHITECTURE §9). Role
 * is deliberately not editable here — that stays admin-only (identity.user.manage,
 * UsersService) since it's an authorization change, not a profile one.
 */
@Injectable()
export class ProfileService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly permissionsService: PermissionsService,
    private readonly storage: StorageService,
    private readonly config: ConfigService<EnvConfig, true>,
  ) {}

  async updateProfile(
    userId: string,
    input: { fullName: string; idCardNo?: string },
    actor: RequestUser,
  ): Promise<MeResponse> {
    const updated = await this.auditService.auditedTransaction(
      this.prisma,
      { userId: actor.id, ipAddress: null, userAgent: null },
      (tx) =>
        tx.user.update({
          where: { id: userId },
          data: {
            fullName: input.fullName,
            ...(input.idCardNo !== undefined ? { idCardNo: input.idCardNo } : {}),
          },
        }),
    );
    return this.toMeResponse(updated);
  }

  async uploadAvatar(
    userId: string,
    file: UploadedAvatar,
    actor: RequestUser,
  ): Promise<MeResponse> {
    const kind = validateFileKind(file.mimetype, file.buffer);
    if (!kind || kind === 'pdf') {
      throw new BusinessRuleError('Profile photo must be a JPEG or PNG image');
    }

    const maxBytes = this.config.get('AVATAR_MAX_SIZE_MB', { infer: true }) * 1024 * 1024;
    if (file.buffer.length > maxBytes) {
      throw new BusinessRuleError(
        `Profile photo must be ${this.config.get('AVATAR_MAX_SIZE_MB', { infer: true })}MB or smaller`,
      );
    }

    const saved = await this.storage.save({
      buffer: file.buffer,
      prefix: 'avatars',
      extension: extensionForKind(kind),
    });

    const { user, previousKey } = await this.auditService.auditedTransaction(
      this.prisma,
      { userId: actor.id, ipAddress: null, userAgent: null },
      async (tx) => {
        const before = await tx.user.findUniqueOrThrow({ where: { id: userId } });
        const updatedUser = await tx.user.update({
          where: { id: userId },
          data: { avatarStorageKey: saved.key },
        });
        return { user: updatedUser, previousKey: before.avatarStorageKey };
      },
    );

    // Best-effort cleanup of the replaced file — never blocks the response
    // on it; an orphaned old key is a disk-space concern, not a correctness
    // one (the user row already points at the new key).
    if (previousKey) {
      await this.storage.delete(previousKey).catch(() => undefined);
    }

    return this.toMeResponse(user);
  }

  async removeAvatar(userId: string, actor: RequestUser): Promise<MeResponse> {
    const { user, previousKey } = await this.auditService.auditedTransaction(
      this.prisma,
      { userId: actor.id, ipAddress: null, userAgent: null },
      async (tx) => {
        const before = await tx.user.findUniqueOrThrow({ where: { id: userId } });
        const updatedUser = await tx.user.update({
          where: { id: userId },
          data: { avatarStorageKey: null },
        });
        return { user: updatedUser, previousKey: before.avatarStorageKey };
      },
    );

    if (previousKey) {
      await this.storage.delete(previousKey).catch(() => undefined);
    }

    return this.toMeResponse(user);
  }

  async getAvatar(userId: string): Promise<{ buffer: Buffer; contentType: string }> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (!user.avatarStorageKey) {
      throw new NotFoundError('No profile photo is set');
    }

    const buffer = await this.storage.read(user.avatarStorageKey);
    return { buffer, contentType: mimeTypeForKey(user.avatarStorageKey) };
  }

  private async toMeResponse(user: ProfileUser): Promise<MeResponse> {
    const { roles, permissions } = await this.permissionsService.resolveForUser(user.id);
    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      roles,
      permissions,
      hasAvatar: user.avatarStorageKey !== null,
      idCardNo: user.idCardNo,
    };
  }
}
