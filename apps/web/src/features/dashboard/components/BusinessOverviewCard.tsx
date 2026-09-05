import { useAnalyticsSummary } from '@/features/analytics/hooks/useAnalytics';

/**
 * Manager/Director "high-level business metrics already supported by the
 * system" (rendered only where the caller gates this on `analytics.view` —
 * Manager and Director, not Executive). Reuses the exact same
 * `/analytics/summary` endpoint and `totals` row the full Analytics page
 * already computes — no new backend query, no invented KPI. `groupBy`
 * is required by that endpoint but irrelevant here since only the overall
 * `totals` (not the per-group breakdown) are shown; the full breakdown
 * stays on the Analytics page, which this deliberately does not replace.
 */
export function BusinessOverviewCard() {
  const summaryQuery = useAnalyticsSummary({}, 'commodity');

  // Never blocks the Dashboard on Analytics being slow/unavailable (or on a
  // malformed/mocked response missing `totals`) — this is a bonus overview
  // tile, not the shipment-operational core of the page.
  if (summaryQuery.isLoading || summaryQuery.isError || !summaryQuery.data?.totals) {
    return null;
  }

  const { totals } = summaryQuery.data;

  return (
    <div className="border-border bg-card rounded-lg border p-4">
      <h2 className="mb-3 font-medium">Business Overview</h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Shipments" value={String(totals.shipmentCount)} />
        <Stat label="Revenue (USD)" value={totals.revenueUsd} />
        <Stat label="Buying Cost (USD)" value={totals.buyingCostUsd} />
        <Stat label="Profit (LKR)" value={totals.profitLkr} />
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-muted-foreground text-xs">{label}</div>
      <div className="text-lg font-semibold">{value}</div>
    </div>
  );
}
