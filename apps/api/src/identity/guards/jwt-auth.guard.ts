import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import type { EnvConfig } from '../../config/env.validation';
import { PrismaService } from '../../prisma/prisma.service';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

interface AccessTokenPayload {
  sub: string;
  iat: number;
}

/**
 * Verifies the access token and attaches `request.user`. Registered
 * globally (APP_GUARD) so every route is authenticated by default;
 * @Public() routes (login, refresh, healthz) are exempted via Reflector
 * metadata.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly config: ConfigService<EnvConfig, true>,
    private readonly prisma: PrismaService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<Request>();
    const token = this.extractToken(request);
    if (!token) {
      throw new UnauthorizedException('Missing access token');
    }

    let payload: AccessTokenPayload;
    try {
      payload = await this.jwtService.verifyAsync<AccessTokenPayload>(token, {
        secret: this.config.get('JWT_ACCESS_SECRET', { infer: true }),
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired access token');
    }

    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user || !user.isActive) {
      throw new UnauthorizedException('Account is inactive or no longer exists');
    }

    // A token issued before a password change / role reassignment /
    // deactivation event is rejected immediately, without a blocklist
    // (ARCHITECTURE §8: "sessions invalidated on role change, password
    // change or deactivation"). JWT `iat` (RFC 7519 NumericDate) only has
    // second-level precision, while sessionValidFrom has millisecond
    // precision — compare both floored to whole seconds, or a token issued
    // within the same wall-clock second as sessionValidFrom (e.g. a user
    // logging in immediately after being created) would be wrongly
    // rejected as stale.
    const sessionValidFromSeconds = Math.floor(user.sessionValidFrom.getTime() / 1000);
    if (payload.iat < sessionValidFromSeconds) {
      throw new UnauthorizedException('Session no longer valid — please log in again');
    }

    request.user = {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      hasAvatar: user.avatarStorageKey !== null,
      hasSignature: user.signatureStorageKey !== null,
      idCardNo: user.idCardNo,
    };
    return true;
  }

  private extractToken(request: Request): string | null {
    const header = request.headers.authorization;
    if (!header?.startsWith('Bearer ')) return null;
    return header.slice('Bearer '.length);
  }
}
