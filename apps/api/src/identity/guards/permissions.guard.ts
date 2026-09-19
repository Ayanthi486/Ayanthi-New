import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import type { PermissionKey } from '@hub-lanka/shared';
import { AUTHENTICATED_ONLY_KEY } from '../decorators/authenticated.decorator';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { REQUIRE_PERMISSION_KEY } from '../decorators/require-permission.decorator';
import { PermissionsService } from '../permissions.service';

/**
 * Runs after JwtAuthGuard. Denies with 403 when a route declares neither
 * @Public() nor @AuthenticatedOnly() nor @RequirePermission(...) — fails
 * closed, so a forgotten declaration on a future mutating route breaks it
 * instead of silently opening it (ARCHITECTURE §9 layer 1).
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly permissionsService: PermissionsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const targets = [context.getHandler(), context.getClass()];

    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, targets)) {
      return true;
    }

    if (
      this.reflector.getAllAndOverride<boolean>(
        AUTHENTICATED_ONLY_KEY,
        targets,
      )
    ) {
      return true;
    }

    const required =
      this.reflector.getAllAndOverride<PermissionKey | undefined>(
        REQUIRE_PERMISSION_KEY,
        targets,
      );

    if (!required) {
      throw new ForbiddenException('Route has no declared permission');
    }

    const request = context.switchToHttp().getRequest<Request>();

    const user = request.user as {
      id: string;
      email?: string;
      roles?: string[];
    } | undefined;

    // DEBUG LOGS
    console.log('========== PERMISSION DEBUG ==========');
    console.log('USER OBJECT:', user);
    console.log('USER ID:', user?.id);
    console.log('USER EMAIL:', user?.email);
    console.log('REQUIRED PERMISSION:', required);
    console.log('======================================');

    if (!user) {
      throw new ForbiddenException('Not authenticated');
    }

    const allowed = await this.permissionsService.hasPermission(
      user.id,
      required,
    );

    console.log('PERMISSION RESULT:', allowed);

    if (!allowed) {
      throw new ForbiddenException(
        `Missing permission: ${required}`,
      );
    }

    return true;
  }
}