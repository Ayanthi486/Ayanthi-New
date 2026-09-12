import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { AuthUser } from '@hub-lanka/shared';
import { AuditService } from '../audit/audit.service';
import type { EnvConfig } from '../config/env.validation';
import { PrismaService } from '../prisma/prisma.service';
import { parseDurationToMs } from './duration.util';
import { LockoutService } from './lockout.service';
import { PasswordHasherService } from './password-hasher.service';
import { PermissionsService } from './permissions.service';

interface RequestMeta {
  ip: string | null;
  userAgent: string | null;
}

interface AuthResult {
  accessToken: string;
  refreshToken: string;
  refreshExpiresAt: Date;
  user: AuthUser;
}

/**
 * Login/refresh/logout orchestration. User mutations run inside
 * AuditService#auditedTransaction so the audit trigger can attribute them
 * to an actor. RefreshToken has no audit trigger (session plumbing — a
 * hashed random string; login/logout/reuse-detection are recorded as
 * explicit semantic events instead) and mutates directly.
 */
@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService<EnvConfig, true>,
    private readonly passwordHasher: PasswordHasherService,
    private readonly lockoutService: LockoutService,
    private readonly permissionsService: PermissionsService,
    private readonly auditService: AuditService,
  ) {}

  async login(input: { email: string; password: string } & RequestMeta): Promise<AuthResult> {
    const email = input.email.toLowerCase();
    const user = await this.prisma.user.findUnique({ where: { email } });

    // Non-enumerable: an unknown email and a wrong password return the
    // identical error (ARCHITECTURE §24 posture — don't help an attacker
    // confirm which emails have accounts).
    if (!user) {
      await this.auditService.record(this.prisma, {
        actorUserId: null,
        action: 'auth.login.failure',
        entityType: 'User',
        ipAddress: input.ip,
        userAgent: input.userAgent,
        after: { reason: 'unknown_email' },
      });
      throw new UnauthorizedException('Invalid email or password');
    }

    if (this.lockoutService.isLocked(user)) {
      throw new UnauthorizedException(
        'Account temporarily locked due to repeated failed attempts. Try again later.',
      );
    }

    const passwordValid = await this.passwordHasher.verify(user.passwordHash, input.password);
    const succeeded = passwordValid && user.isActive;
    const lockoutUpdate = succeeded
      ? this.lockoutService.computeAfterSuccess()
      : this.lockoutService.computeAfterFailure(user);

    await this.auditService.auditedTransaction(
      this.prisma,
      { userId: user.id, ipAddress: input.ip, userAgent: input.userAgent },
      async (tx) => {
        await tx.user.update({ where: { id: user.id }, data: lockoutUpdate });
        await this.auditService.record(tx, {
          actorUserId: user.id,
          action: succeeded ? 'auth.login.success' : 'auth.login.failure',
          entityType: 'User',
          entityId: user.id,
          ipAddress: input.ip,
          userAgent: input.userAgent,
        });
      },
    );

    if (!succeeded) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const { roles, permissions } = await this.permissionsService.resolveForUser(user.id);
    const accessToken = await this.signAccessToken(user.id);
    const refresh = await this.issueRefreshToken(user.id, randomUUID(), input.ip, input.userAgent);

    return {
      accessToken,
      refreshToken: refresh.token,
      refreshExpiresAt: refresh.expiresAt,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        roles,
        permissions,
        hasAvatar: user.avatarStorageKey !== null,
        idCardNo: user.idCardNo,
      },
    };
  }

  async refresh(
    rawToken: string | undefined,
    ip: string | null,
    userAgent: string | null,
  ): Promise<{ accessToken: string; refreshToken: string; refreshExpiresAt: Date }> {
    if (!rawToken) {
      throw new UnauthorizedException('Missing refresh token');
    }

    const tokenHash = this.hashToken(rawToken);
    const existing = await this.prisma.refreshToken.findUnique({ where: { tokenHash } });
    if (!existing) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (existing.revokedAt) {
      // Reuse of an already-rotated token — treat as a compromise signal
      // and revoke every token descended from the same login.
      await this.prisma.refreshToken.updateMany({
        where: { familyId: existing.familyId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      await this.auditService.record(this.prisma, {
        actorUserId: existing.userId,
        action: 'auth.token.reuse_detected',
        entityType: 'RefreshToken',
        entityId: existing.id,
        ipAddress: ip,
        userAgent,
      });
      throw new UnauthorizedException('Refresh token reuse detected — all sessions revoked');
    }

    if (existing.expiresAt < new Date()) {
      throw new UnauthorizedException('Refresh token expired');
    }

    const user = await this.prisma.user.findUnique({ where: { id: existing.userId } });
    if (!user || !user.isActive) {
      throw new UnauthorizedException('Account is inactive or no longer exists');
    }

    const rawNextToken = randomBytes(32).toString('base64url');
    const nextTokenHash = this.hashToken(rawNextToken);
    const expiresAt = this.computeRefreshExpiry();

    const created = await this.prisma.$transaction(async (tx) => {
      const createdToken = await tx.refreshToken.create({
        data: {
          userId: existing.userId,
          tokenHash: nextTokenHash,
          familyId: existing.familyId,
          expiresAt,
          createdByIp: ip,
          userAgent,
        },
      });
      await tx.refreshToken.update({
        where: { id: existing.id },
        data: { revokedAt: new Date(), replacedByTokenId: createdToken.id },
      });
      return createdToken;
    });

    const accessToken = await this.signAccessToken(user.id);

    return { accessToken, refreshToken: rawNextToken, refreshExpiresAt: created.expiresAt };
  }

  async logout(
    rawToken: string | undefined,
    ip: string | null,
    userAgent: string | null,
  ): Promise<void> {
    if (!rawToken) return;

    const tokenHash = this.hashToken(rawToken);
    const existing = await this.prisma.refreshToken.findUnique({ where: { tokenHash } });
    if (!existing) return;

    await this.prisma.refreshToken.updateMany({
      where: { familyId: existing.familyId, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    await this.auditService.record(this.prisma, {
      actorUserId: existing.userId,
      action: 'auth.logout',
      entityType: 'RefreshToken',
      entityId: existing.id,
      ipAddress: ip,
      userAgent,
    });
  }

  private async signAccessToken(userId: string): Promise<string> {
    return this.jwtService.signAsync(
      { sub: userId },
      {
        secret: this.config.get('JWT_ACCESS_SECRET', { infer: true }),
        expiresIn: this.config.get('JWT_ACCESS_EXPIRES_IN', { infer: true }),
      },
    );
  }

  private async issueRefreshToken(
    userId: string,
    familyId: string,
    ip: string | null,
    userAgent: string | null,
  ): Promise<{ token: string; expiresAt: Date }> {
    const token = randomBytes(32).toString('base64url');
    const tokenHash = this.hashToken(token);
    const expiresAt = this.computeRefreshExpiry();

    await this.prisma.refreshToken.create({
      data: { userId, tokenHash, familyId, expiresAt, createdByIp: ip, userAgent },
    });

    return { token, expiresAt };
  }

  private hashToken(rawToken: string): string {
    return createHash('sha256').update(rawToken).digest('hex');
  }

  private computeRefreshExpiry(): Date {
    const ttl = parseDurationToMs(this.config.get('JWT_REFRESH_EXPIRES_IN', { infer: true }));
    return new Date(Date.now() + ttl);
  }
}
