import type { ExecutionContext } from '@nestjs/common';
import { UnauthorizedException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { Reflector } from '@nestjs/core';
import type { JwtService } from '@nestjs/jwt';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { EnvConfig } from '../../config/env.validation';
import type { PrismaService } from '../../prisma/prisma.service';
import { JwtAuthGuard } from './jwt-auth.guard';

function fakeContext(request: Record<string, unknown>): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => (() => undefined) as unknown,
    getClass: () => class {},
  } as unknown as ExecutionContext;
}

describe('JwtAuthGuard', () => {
  const now = new Date('2026-01-01T00:00:00Z');
  let jwtService: { verifyAsync: ReturnType<typeof vi.fn> };
  let prisma: { user: { findUnique: ReturnType<typeof vi.fn> } };
  let reflector: { getAllAndOverride: ReturnType<typeof vi.fn> };
  let guard: JwtAuthGuard;

  beforeEach(() => {
    jwtService = { verifyAsync: vi.fn() };
    prisma = { user: { findUnique: vi.fn() } };
    reflector = { getAllAndOverride: vi.fn().mockReturnValue(false) };
    const config = { get: () => 'test-secret' } as unknown as ConfigService<EnvConfig, true>;

    guard = new JwtAuthGuard(
      jwtService as unknown as JwtService,
      config,
      prisma as unknown as PrismaService,
      reflector as unknown as Reflector,
    );
  });

  it('allows a @Public() route without checking the token', async () => {
    reflector.getAllAndOverride.mockReturnValue(true);
    const context = fakeContext({ headers: {} });

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(jwtService.verifyAsync).not.toHaveBeenCalled();
  });

  it('rejects a request with no Authorization header', async () => {
    const context = fakeContext({ headers: {} });
    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
  });

  it('rejects an invalid/expired token', async () => {
    jwtService.verifyAsync.mockRejectedValue(new Error('bad token'));
    const context = fakeContext({ headers: { authorization: 'Bearer bad' } });
    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
  });

  it('rejects when the user no longer exists or is inactive', async () => {
    jwtService.verifyAsync.mockResolvedValue({ sub: 'u1', iat: Math.floor(now.getTime() / 1000) });
    prisma.user.findUnique.mockResolvedValue(null);
    const context = fakeContext({ headers: { authorization: 'Bearer ok' } });
    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
  });

  it('rejects a token issued before sessionValidFrom', async () => {
    const issuedAt = Math.floor(now.getTime() / 1000) - 3600;
    jwtService.verifyAsync.mockResolvedValue({ sub: 'u1', iat: issuedAt });
    prisma.user.findUnique.mockResolvedValue({
      id: 'u1',
      email: 'a@b.com',
      fullName: 'A B',
      isActive: true,
      avatarStorageKey: null, signatureStorageKey: null, idCardNo: null,
      sessionValidFrom: now, // bumped after the token was issued
    });
    const context = fakeContext({ headers: { authorization: 'Bearer ok' } });
    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
  });

  it('attaches request.user and allows a fresh, valid token', async () => {
    const issuedAt = Math.floor(now.getTime() / 1000) + 10;
    jwtService.verifyAsync.mockResolvedValue({ sub: 'u1', iat: issuedAt });
    prisma.user.findUnique.mockResolvedValue({
      id: 'u1',
      email: 'a@b.com',
      fullName: 'A B',
      isActive: true,
      avatarStorageKey: null, signatureStorageKey: null, idCardNo: null,
      sessionValidFrom: now,
    });
    const request: Record<string, unknown> = { headers: { authorization: 'Bearer ok' } };
    const context = fakeContext(request);

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request.user).toEqual({
      id: 'u1',
      email: 'a@b.com',
      fullName: 'A B',
      hasAvatar: false, hasSignature: false, idCardNo: null,
    });
  });

  it('sets hasAvatar true when the user has a stored profile photo', async () => {
    const issuedAt = Math.floor(now.getTime() / 1000) + 10;
    jwtService.verifyAsync.mockResolvedValue({ sub: 'u1', iat: issuedAt });
    prisma.user.findUnique.mockResolvedValue({
      id: 'u1',
      email: 'a@b.com',
      fullName: 'A B',
      isActive: true,
      avatarStorageKey: "avatars/some-key.jpg", signatureStorageKey: null, idCardNo: null,
      sessionValidFrom: now,
    });
    const request: Record<string, unknown> = { headers: { authorization: 'Bearer ok' } };
    const context = fakeContext(request);

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect((request.user as { hasAvatar: boolean }).hasAvatar).toBe(true);
  });
});
