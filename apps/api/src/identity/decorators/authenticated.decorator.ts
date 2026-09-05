import { SetMetadata } from '@nestjs/common';

export const AUTHENTICATED_ONLY_KEY = 'authenticatedOnly';

/**
 * Marks a route as needing a valid session but no specific permission
 * (e.g. GET /me, POST /auth/logout — anyone logged in may call these).
 * PermissionsGuard's fail-closed check (ARCHITECTURE §9 layer 1) exists to
 * catch a *mutating/business* route that forgot @RequirePermission; a route
 * that is deliberately permission-agnostic states that explicitly instead
 * of being silently exempt.
 */
export const AuthenticatedOnly = () => SetMetadata(AUTHENTICATED_ONLY_KEY, true);
