import { useMemo } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { Link } from 'react-router-dom';
import type { Shipment } from '@hub-lanka/shared';
import { DataTable } from '@/components/shared/DataTable';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { CutoffIndicator } from '@/features/cutoff/components/CutoffIndicator';
import { useActiveCutoffAlerts } from '@/features/cutoff/hooks/useCutoff';

/**
 * A deliberately narrow preview of the same today+tomorrow shipment list
 * the Shipments page shows in full (`ScheduleGrid`) — Shipment ID, DEP
 * TIME, DATE, STATUS and CUT-OFF only, no MAWB/DEST/FLIGHT/SHIPPER/
 * CONSIGNEE/COMMODITY/BOX/WEIGHT columns or row actions. This is the
 * Dashboard's "upcoming departures / cut-off warnings / urgent shipments /
 * recent activity" surface — one compact table rather than four separate
 * widgets, since a shipment nearing its cut-off *is* the urgent/upcoming
 * item this section exists to surface.
 */
export function DashboardShipmentPreview({
  shipments,
  isLoading,
  totalCount,
}: {
  shipments: Shipment[];
  isLoading: boolean;
  totalCount: number;
}) {
  const activeCutoffAlertsQuery = useActiveCutoffAlerts();
  const alertsByShipmentId = useMemo(
    () => new Map((activeCutoffAlertsQuery.data ?? []).map((alert) => [alert.shipmentId, alert])),
    [activeCutoffAlertsQuery.data],
  );

  const columns = useMemo<ColumnDef<Shipment, unknown>[]>(
    () => [
      {
        id: 'view',
        header: '',
        cell: ({ row }) => (
          <Link to={`/shipments/${row.original.id}`} className="text-primary hover:underline">
            View
          </Link>
        ),
      },
      { header: 'Shipment ID', accessorKey: 'shipmentNo' },
      { header: 'DEP TIME', accessorKey: 'depTime' },
      { header: 'DATE', accessorKey: 'flightDate' },
      {
        header: 'STATUS',
        accessorKey: 'status',
        cell: ({ getValue }) => <StatusBadge status={getValue<Shipment['status']>()} />,
      },
      {
        id: 'cutoff',
        header: 'CUT-OFF',
        cell: ({ row }) => (
          <CutoffIndicator
            shipment={row.original}
            alert={alertsByShipmentId.get(row.original.id)}
          />
        ),
      },
    ],
    [alertsByShipmentId],
  );

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <h2 className="font-medium">Today's Shipments</h2>
        {totalCount > shipments.length && (
          <Link to="/shipments" className="text-primary text-sm hover:underline">
            View all {totalCount} in Shipments →
          </Link>
        )}
      </div>
      <DataTable
        columns={columns}
        data={shipments}
        isLoading={isLoading}
        emptyMessage="No shipments today or tomorrow."
      />
    </div>
  );
}
