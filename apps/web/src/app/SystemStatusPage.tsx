import { useQuery } from '@tanstack/react-query';
import { fetchHealth } from '@/lib/apiClient';
import { Button } from '@/components/ui/button';

/**
 * API/database health check, proving the full stack — web → api →
 * PostgreSQL — is wired end to end. Was the Phase 0 landing page at "/";
 * the Daily Shipment Schedule took that slot in Phase 2. It's a technical
 * page, not a business destination, so it now lives at
 * /settings/system-status — out of the primary nav, reached via the
 * ProfileMenu — still gated by identity.user.manage (there's no separate
 * "admin" permission in the current matrix — this reuses the same gate as
 * the Users page; not invented for this move).
 *
 * There's no other Settings/Profile page in the app yet, so this
 * deliberately doesn't stand up a Settings sidebar/index shell around a
 * single item — that would just be an unsupported page to fill space. If a
 * second settings page is ever added, promoting `/settings` to a real
 * layout with its own nav is the natural next step.
 */
export function SystemStatusPage() {
  const {
    data,
    isPending,
    isError,
    isRefetchError,
    error,
    refetch,
    isFetching,
    dataUpdatedAt,
    errorUpdatedAt,
  } = useQuery({
    queryKey: ['health'],
    queryFn: fetchHealth,
  });

  // A failed re-check while a previous successful result is still cached
  // does NOT flip `isError` (TanStack Query keeps showing the last good
  // `data` by design) — without this, clicking Re-check while the API is
  // down silently keeps showing stale "Healthy" with no visible change.
  const showError = isError || isRefetchError;
  const dbStatus = data?.info?.database?.status ?? data?.error?.database?.status;
  const lastCheckedAt = Math.max(dataUpdatedAt, errorUpdatedAt);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
          Settings
        </p>
        <h1 className="text-2xl font-semibold">System status</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Phase 0 foundation — monorepo, API shell, database connectivity and logging.
        </p>
      </div>

      <div className="border-border bg-card rounded-lg border p-6">
        <div className="flex items-center justify-between">
          <span className="font-medium">Backend API</span>
          {isPending && <span className="text-muted-foreground text-sm">Checking…</span>}
          {showError && <span className="text-destructive text-sm">Unreachable</span>}
          {!showError && data && (
            <span
              className={
                data.status === 'ok' ? 'text-sm text-green-600' : 'text-destructive text-sm'
              }
            >
              {data.status === 'ok' ? 'Healthy' : 'Degraded'}
            </span>
          )}
        </div>

        {!showError && dbStatus && (
          <div className="mt-3 flex items-center justify-between border-t pt-3">
            <span className="text-muted-foreground text-sm">PostgreSQL connectivity</span>
            <span
              className={dbStatus === 'up' ? 'text-sm text-green-600' : 'text-destructive text-sm'}
            >
              {dbStatus}
            </span>
          </div>
        )}

        {showError && (
          <p className="text-destructive mt-3 text-sm">
            {error instanceof Error ? error.message : 'Failed to reach the API.'}
          </p>
        )}

        {!isPending && lastCheckedAt > 0 && (
          <p className="text-muted-foreground mt-3 text-xs">
            Last checked: {new Date(lastCheckedAt).toLocaleTimeString()}
          </p>
        )}

        <Button
          className="mt-4"
          variant="outline"
          size="sm"
          onClick={() => void refetch()}
          disabled={isFetching}
        >
          {isFetching ? 'Refreshing…' : 'Re-check'}
        </Button>
      </div>
    </div>
  );
}
