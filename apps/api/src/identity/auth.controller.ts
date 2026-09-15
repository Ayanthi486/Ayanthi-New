import { Body, Controller, Get, HttpCode, HttpStatus, Post, Req, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { LoginResponse, MeResponse, RefreshResponse } from '@hub-lanka/shared';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import type { EnvConfig } from '../config/env.validation';
import { AuthenticatedOnly } from './decorators/authenticated.decorator';
import { CurrentUser } from './decorators/current-user.decorator';
import { Public } from './decorators/public.decorator';
import { LoginDto } from './dto/login.dto';
import { PermissionsService } from './permissions.service';
import { extractClientIp, extractUserAgent } from './request-context.util';
import type { RequestUser } from './types';

// Login/refresh get a tighter throttle than the global default
// (ARCHITECTURE §24: "aggressive on auth").
const AUTH_THROTTLE = { default: { limit: 5, ttl: 60_000 } };

@ApiTags('auth')
@Controller()
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly permissionsService: PermissionsService,
    private readonly config: ConfigService<EnvConfig, true>,
  ) {}

  @Public()
  @Throttle(AUTH_THROTTLE)
  @Post('auth/login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<LoginResponse> {
    const result = await this.authService.login({
      email: dto.email,
      password: dto.password,
      ip: extractClientIp(req),
      userAgent: extractUserAgent(req),
    });

    this.setRefreshCookie(res, result.refreshToken, result.refreshExpiresAt);

    return { accessToken: result.accessToken, user: result.user };
  }

  @Public()
  @Throttle(AUTH_THROTTLE)
  @Post('auth/refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<RefreshResponse> {
    const rawToken = this.readRefreshCookie(req);
    const result = await this.authService.refresh(
      rawToken,
      extractClientIp(req),
      extractUserAgent(req),
    );

    this.setRefreshCookie(res, result.refreshToken, result.refreshExpiresAt);

    return { accessToken: result.accessToken };
  }

  @AuthenticatedOnly()
  @Post('auth/logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<void> {
    const rawToken = this.readRefreshCookie(req);
    await this.authService.logout(rawToken, extractClientIp(req), extractUserAgent(req));

    res.clearCookie(this.cookieName(), { path: '/api/v1/auth' });
  }

  @AuthenticatedOnly()
  @Get('me')
  async me(@CurrentUser() user: RequestUser): Promise<MeResponse> {
    const { roles, permissions } = await this.permissionsService.resolveForUser(user.id);
    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      roles,
      permissions,
      hasAvatar: user.hasAvatar,
      hasSignature: user.hasSignature,
      idCardNo: user.idCardNo,
    };
  }

  private cookieName(): string {
    return this.config.get('REFRESH_TOKEN_COOKIE_NAME', { infer: true });
  }

  private readRefreshCookie(req: Request): string | undefined {
    const cookies = req.cookies as Record<string, string> | undefined;
    return cookies?.[this.cookieName()];
  }

  private setRefreshCookie(res: Response, token: string, expiresAt: Date): void {
    res.cookie(this.cookieName(), token, {
      httpOnly: true,
      secure: this.config.get('NODE_ENV', { infer: true }) === 'production',
      sameSite: 'strict',
      path: '/api/v1/auth',
      expires: expiresAt,
    });
  }
}
