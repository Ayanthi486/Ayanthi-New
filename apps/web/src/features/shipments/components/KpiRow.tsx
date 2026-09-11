import type { ShipmentKpis } from '@hub-lanka/shared';

/**
 * Aggregated by the API from the exact same filtered query as the grid rows
 * (ARCHITECTURE §17: "A KPI that doesn't tie out to its own list is a
 * defect") — no PRD spec for this row's shape beyond DEVELOPMENT_PLAN.md
 * naming it; see the Phase 2 report.
 */
export function KpiRow({ kpis }: { kpis: ShipmentKpis }) {
  const items: { label: string; value: number }[] = [
    { label: 'Total', value: kpis.total },
    { label: 'Pending', value: kpis.pending },
    { label: 'Confirmed', value: kpis.confirmed },
    { label: 'Cancelled', value: kpis.cancelled },
    { label: 'Departed', value: kpis.departed },
    { label: 'Payment Pending', value: kpis.paymentPending },
    { label: 'Payment Received', value: kpis.paymentReceived },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {items.map((item) => (
        <div key={item.label} className="border-border bg-card rounded-lg border px-4 py-3">
          <div className="text-muted-foreground text-xs">{item.label}</div>
          <div className="text-xl font-semibold">{item.value}</div>
        </div>
      ))}
    </div>
  );
}
