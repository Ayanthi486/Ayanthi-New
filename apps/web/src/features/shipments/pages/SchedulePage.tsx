import { useState } from 'react';
import type { ShipmentListQuery } from '@hub-lanka/shared';
import { RequirePermission } from '@/app/RequirePermission';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AddShipmentAction } from '@/features/shipments/components/AddShipmentAction';
import { CancellationApprovalQueue } from '@/features/shipments/components/CancellationApprovalQueue';
import { KpiRow } from '@/features/shipments/components/KpiRow';
import { ScheduleGrid } from '@/features/shipments/components/ScheduleGrid';
import { useShipments } from '@/features/shipments/hooks/useShipments';

/**
 * The full shipment-management workspace — every shipment matching the
 * current filter, every shipment-level action (BR-15/AC-05: defaults to
 * today+tomorrow, sorted by DEP TIME). Distinct from the Dashboard
 * (`DashboardPage`), which shows a compact preview of this same data via
 * the same `useShipments` hook/endpoint, not a second data source.
 */
export function SchedulePage() {
  const [query, setQuery] = useState<ShipmentListQuery>({});

  const shipmentsQuery = useShipments(query);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Daily Shipment Schedule</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Defaults to today and tomorrow, sorted by departure time.
          </p>
        </div>
        <AddShipmentAction />
      </div>

      {shipmentsQuery.data && <KpiRow kpis={shipmentsQuery.data.kpis} />}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <Label htmlFor="search">Search by Shipment ID</Label>
          <Input
            id="search"
            placeholder="HUB 000001"
            value={query.search ?? ''}
            onChange={(e) => setQuery((prev) => ({ ...prev, search: e.target.value || undefined }))}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="dateFrom">From</Label>
          <Input
            id="dateFrom"
            type="date"
            value={query.dateFrom ?? ''}
            onChange={(e) =>
              setQuery((prev) => ({ ...prev, dateFrom: e.target.value || undefined }))
            }
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="dateTo">To</Label>
          <Input
            id="dateTo"
            type="date"
            value={query.dateTo ?? ''}
            onChange={(e) => setQuery((prev) => ({ ...prev, dateTo: e.target.value || undefined }))}
          />
        </div>
      </div>

      <ScheduleGrid
        shipments={shipmentsQuery.data?.data ?? []}
        isLoading={shipmentsQuery.isLoading}
      />

      <RequirePermission permission="shipment.cancellation.approve">
        <CancellationApprovalQueue />
      </RequirePermission>
    </div>
  );
}
