import type { PermissionKey } from '@hub-lanka/shared';
import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuthStore } from '@/lib/authStore';

/**
 * Router-level guard: redirects home if the user lacks the permission,
 * rather than rendering a page whose every mutation would just 403. The
 * server remains the real enforcement (ARCHITECTURE §3) — this only
 * avoids showing a route that can't do anything.
 */
export function RequireRoutePermission({
  permission,
  children,
}: {
  permission: PermissionKey;
  children: ReactNode;
}) {
  const hasPermission = useAuthStore((state) => state.hasPermission);
  if (!hasPermission(permission)) {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
}
