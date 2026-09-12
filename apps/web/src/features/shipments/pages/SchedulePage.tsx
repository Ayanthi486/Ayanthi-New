import { useState } from 'react';
import type { ShipmentListQuery } from '@hub-lanka/shared';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AddShipmentAction } from '@/features/shipments/components/AddShipmentAction';
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
  const shipments = shipmentsQuery.data?.data ?? [];
  const bookingOnlyShipments = shipments.filter((s) => s.serviceType === 'BOOKING_ONLY');
  const handlingShipments = shipments.filter((s) => s.serviceType !== 'BOOKING_ONLY');

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Daily Shipment Schedule</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Defaults to today and tomorrow, sorted by departure time.
          </p>
        </div>
        <div className="flex items-center gap-2 print:hidden">
          <Button variant="outline" onClick={() => window.print()}>
            Print
          </Button>
          <AddShipmentAction />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4 print:hidden">
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

      {/*
        Split by Service Type (PRD-driven direct request): Handling work
        (Only Handling + Booking & Handling) is the priority section and
        sits on top; Only Booking shipments — no handling involved — sit
        below as their own section. Both stay sorted by Dep Time, same as
        the single grid before this split (filtering a depTime-ordered
        list preserves that order within each subset).
      */}
      <div className="flex flex-col gap-2">
        <h2 className="font-medium">Handling Shipments</h2>
        <ScheduleGrid
          shipments={handlingShipments}
          isLoading={shipmentsQuery.isLoading}
          emptyMessage="No Handling shipments for this view."
        />
      </div>

      <div className="flex flex-col gap-2">
        <h2 className="font-medium">Booking Only Shipments</h2>
        <ScheduleGrid
          shipments={bookingOnlyShipments}
          isLoading={shipmentsQuery.isLoading}
          emptyMessage="No Booking Only shipments for this view."
        />
      </div>
    </div>
  );
}
