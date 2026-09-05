import type { PermissionKey } from '@hub-lanka/shared';
import type { ReactNode } from 'react';
import { useAuthStore } from '@/lib/authStore';

/**
 * Presentation only — never the access control (ARCHITECTURE §3). The
 * server enforces every permission independently via PermissionsGuard;
 * this only decides what to render.
 *
 * `permission` accepts an array for a genuine either/or (e.g. Invoice's
 * `invoice.view` / `invoice.view.readonly` — disjoint permissions, unlike
 * Cost Sheet's broader/narrower `prepare`/`edit_released` pair, which needs
 * no OR here since the single broader key already covers both).
 */
export function RequirePermission({
  permission,
  children,
}: {
  permission: PermissionKey | PermissionKey[];
  children: ReactNode;
}) {
  const hasPermission = useAuthStore((state) => state.hasPermission);
  const permissions = Array.isArray(permission) ? permission : [permission];
  if (!permissions.some((p) => hasPermission(p))) return null;
  return <>{children}</>;
}
