import type { ExecutionContext } from '@nestjs/common';
import { ForbiddenException } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PermissionsService } from '../permissions.service';
import { PermissionsGuard } from './permissions.guard';

function fakeContext(request: Record<string, unknown>): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => (() => undefined) as unknown,
    getClass: () => class {},
  } as unknown as ExecutionContext;
}

describe('PermissionsGuard', () => {
  let reflector: { getAllAndOverride: ReturnType<typeof vi.fn> };
  let permissionsService: { hasPermission: ReturnType<typeof vi.fn> };
  let guard: PermissionsGuard;

  beforeEach(() => {
    reflector = { getAllAndOverride: vi.fn() };
    permissionsService = { hasPermission: vi.fn() };
    guard = new PermissionsGuard(
      reflector as unknown as Reflector,
      permissionsService as unknown as PermissionsService,
    );
  });

  it('allows a @Public() route', async () => {
    reflector.getAllAndOverride.mockImplementation((key: string) => key === 'isPublic');
    await expect(guard.canActivate(fakeContext({}))).resolves.toBe(true);
  });

  it('allows an @AuthenticatedOnly() route without a permission check', async () => {
    reflector.getAllAndOverride.mockImplementation((key: string) => key === 'authenticatedOnly');
    await expect(guard.canActivate(fakeContext({ user: { id: 'u1' } }))).resolves.toBe(true);
    expect(permissionsService.hasPermission).not.toHaveBeenCalled();
  });

  it('fails closed — denies a route with no declared permission', async () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);
    await expect(guard.canActivate(fakeContext({ user: { id: 'u1' } }))).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('denies when the user lacks the required permission', async () => {
    reflector.getAllAndOverride.mockImplementation((key: string) =>
      key === 'requirePermission' ? 'identity.user.manage' : undefined,
    );
    permissionsService.hasPermission.mockResolvedValue(false);
    await expect(guard.canActivate(fakeContext({ user: { id: 'u1' } }))).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('allows when the user holds the required permission', async () => {
    reflector.getAllAndOverride.mockImplementation((key: string) =>
      key === 'requirePermission' ? 'identity.user.manage' : undefined,
    );
    permissionsService.hasPermission.mockResolvedValue(true);
    await expect(guard.canActivate(fakeContext({ user: { id: 'u1' } }))).resolves.toBe(true);
  });
});
