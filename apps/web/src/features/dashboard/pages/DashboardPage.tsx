import { RequirePermission } from '@/app/RequirePermission';
import { BusinessOverviewCard } from '@/features/dashboard/components/BusinessOverviewCard';
import { DashboardShipmentPreview } from '@/features/dashboard/components/DashboardShipmentPreview';
import { AddShipmentAction } from '@/features/shipments/components/AddShipmentAction';
import { KpiRow } from '@/features/shipments/components/KpiRow';
import { useShipments } from '@/features/shipments/hooks/useShipments';

/** How many of today+tomorrow's shipments the overview preview shows before pointing to Shipments. */
const PREVIEW_ROW_LIMIT = 8;

/**
 * Role-specific operational overview — distinct from the Shipments page
 * (`SchedulePage`), which is the full shipment-management workspace. Reads
 * from the exact same `useShipments` hook/endpoint as Shipments (BR-15's
 * today+tomorrow default, sorted by DEP TIME) rather than a second data
 * source; this page only ever shows a compact slice of it.
 *
 * Role differences come entirely from the existing permission system, not
 * hardcoded role checks (seed.ts's actual grants, not an assumption):
 * - Executive (`shipment.view`, `shipment.create`): operational overview +
 *   quick Add Shipment. No Business Overview (no `analytics.view`).
 * - Manager (also holds `analytics.view`): the same overview, plus the
 *   Business Overview tile.
 * - Director (`shipment.create` too — BR-01: all three roles can create
 *   shipments — plus `analytics.view`): overview + Add Shipment + Business
 *   Overview.
 *
 * Not included: a Cost Sheet/Invoice/Payment "items requiring attention"
 * widget. Those modules only expose per-shipment endpoints
 * (`GET .../by-shipment/:shipmentId`) — there is no cross-shipment "pending
 * review" or "unpaid" list to query today, and building one would be new
 * backend surface outside this fix's scope. Flagged rather than faked.
 */
export function DashboardPage() {
  const shipmentsQuery = useShipments({});
  const previewShipments = (shipmentsQuery.data?.data ?? []).slice(0, PREVIEW_ROW_LIMIT);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Dashboard</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Today and tomorrow's operational overview.
          </p>
        </div>
        <AddShipmentAction />
      </div>

      {shipmentsQuery.data && (
        <div className="flex flex-col gap-2">
          <h2 className="font-medium">Shipment Status</h2>
          <KpiRow kpis={shipmentsQuery.data.kpis} />
        </div>
      )}

      <RequirePermission permission="analytics.view">
        <BusinessOverviewCard />
      </RequirePermission>

      <DashboardShipmentPreview
        shipments={previewShipments}
        isLoading={shipmentsQuery.isLoading}
        totalCount={shipmentsQuery.data?.meta.total ?? 0}
      />
    </div>
  );
}
