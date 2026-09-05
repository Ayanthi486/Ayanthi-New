import { SetMetadata } from '@nestjs/common';
import type { PermissionKey } from '@hub-lanka/shared';

export const REQUIRE_PERMISSION_KEY = 'requirePermission';

/**
 * Declares the permission a route needs. PermissionsGuard (registered
 * globally) denies with 403 when this metadata is absent — a forgotten
 * declaration on a new mutating route breaks it rather than opening it
 * (ARCHITECTURE §9 layer 1).
 */
export const RequirePermission = (permission: PermissionKey) =>
  SetMetadata(REQUIRE_PERMISSION_KEY, permission);
