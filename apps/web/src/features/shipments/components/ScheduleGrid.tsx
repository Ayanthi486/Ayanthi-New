import { useMemo } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { Link } from 'react-router-dom';
import type { Shipment } from '@hub-lanka/shared';
import { DataTable } from '@/components/shared/DataTable';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { Button } from '@/components/ui/button';
import { CutoffIndicator } from '@/features/cutoff/components/CutoffIndicator';
import { useActiveCutoffAlerts } from '@/features/cutoff/hooks/useCutoff';
import { useToastStore } from '@/lib/toastStore';

/** BR-22/AC-08: fixed tracking portal, opened in a new tab with noopener,noreferrer. */
const TRACKING_URL = 'https://hublanka.lk/tracking/';

const dash = (value: string | number | null): string | number => value ?? '—';

/**
 * Daily Shipment Schedule grid (PRD §5.2), on the shared `DataTable`
 * (TanStack Table v8 — see DataTable.tsx and the Phase 3 report for why
 * Phase 2 used plain markup instead). Columns are exactly the confirmed
 * set — CUS NO/FLT ATD/BOOKED BOX/BOOKED WEIGHT are deliberately excluded
 * (BR-23), and View is a leftmost row action, not a data column (BR-24).
 */
export function ScheduleGrid({
  shipments,
  isLoading,
}: {
  shipments: Shipment[];
  isLoading: boolean;
}) {
  const showToast = useToastStore((state) => state.show);
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
      {
        header: 'MAWB NO',
        accessorKey: 'mawbNo',
        cell: ({ getValue }) => dash(getValue<string | null>()),
      },
      {
        header: 'DEST',
        accessorKey: 'destinationAirportCode',
        cell: ({ getValue }) => dash(getValue<string | null>()),
      },
      {
        header: 'FLIGHT',
        accessorKey: 'flightNo',
        cell: ({ getValue }) => dash(getValue<string | null>()),
      },
      { header: 'DATE', accessorKey: 'flightDate' },
      { header: 'SHIPPER', accessorKey: 'shipperName' },
      { header: 'CONSIGNEE', accessorKey: 'consigneeName' },
      { header: 'COMMODITY', accessorKey: 'commodityName' },
      {
        header: 'BOX',
        accessorKey: 'boxCount',
        cell: ({ getValue }) => dash(getValue<number | null>()),
      },
      {
        header: 'WEIGHT',
        accessorKey: 'weightKg',
        cell: ({ getValue }) => dash(getValue<string | null>()),
      },
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
      {
        id: 'actions',
        header: 'Actions',
        cell: ({ row }) => {
          const mawbNo = row.original.mawbNo;
          return (
            <div className="flex items-center gap-2">
              <Link to={`/shipments/${row.original.id}?edit=1`}>
                <Button variant="outline" size="sm">
                  Edit
                </Button>
              </Link>
              <Button
                variant="outline"
                size="sm"
                disabled={!mawbNo}
                onClick={() => {
                  if (!mawbNo) return;
                  void navigator.clipboard.writeText(mawbNo).then(() => showToast('MAWB copied'));
                }}
              >
                Copy MAWB
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.open(TRACKING_URL, '_blank', 'noopener,noreferrer')}
              >
                Track
              </Button>
            </div>
          );
        },
      },
    ],
    [showToast, alertsByShipmentId],
  );

  return (
    <DataTable
      columns={columns}
      data={shipments}
      isLoading={isLoading}
      emptyMessage="No shipments for this view."
    />
  );
}
