import { useMemo } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { Link } from 'react-router-dom';
import type { Shipment } from '@hub-lanka/shared';
import { DataTable } from '@/components/shared/DataTable';
import { Button } from '@/components/ui/button';
import { CargoValueCell } from '@/features/shipments/components/CargoValueCell';
import { ChangeStatusControl } from '@/features/shipments/components/ChangeStatusControl';
import { displayFlight } from '@/lib/utils';
import { useToastStore } from '@/lib/toastStore';

/** BR-22/AC-08: fixed tracking portal, opened in a new tab with noopener,noreferrer. */
const TRACKING_URL = 'https://hublanka.lk/tracking/';

const dash = (value: string | number | null): string | number => value ?? '—';

/**
 * Daily Shipment Schedule grid (PRD §5.2), on the shared `DataTable`
 * (TanStack Table v8 — see DataTable.tsx and the Phase 3 report for why
 * Phase 2 used plain markup instead). Sorted by Dep Time ascending — that
 * ordering comes from the API (`shipment.service.ts`'s `list()`, BR-15/
 * AC-05/AC-06), never re-sorted client-side. Column set per direct request:
 * DEP TIME, MAWB NO, DEST, FLIGHT, DATE, SHIPPER, CONSIGNEE, BOX, WEIGHT,
 * CUT-OFF TIME, STATUS, Actions (View/Copy MAWB/Track — no Edit, no
 * Shipment ID/COMMODITY columns, and no separate alert-badge CUT-OFF
 * column — that's still shown on the Dashboard's shipment preview).
 */
export function ScheduleGrid({
  shipments,
  isLoading,
  emptyMessage = 'No shipments for this view.',
}: {
  shipments: Shipment[];
  isLoading: boolean;
  emptyMessage?: string;
}) {
  const showToast = useToastStore((state) => state.show);

  const columns = useMemo<ColumnDef<Shipment, unknown>[]>(
    () => [
      { header: 'DEP TIME', accessorKey: 'depTime', meta: { className: 'text-center' } },
      {
        header: 'MAWB NO',
        accessorKey: 'mawbNo',
        meta: { className: 'text-center' },
        cell: ({ getValue }) => dash(getValue<string | null>()),
      },
      {
        header: 'DEST',
        accessorKey: 'destinationAirportCode',
        meta: { className: 'text-center' },
        cell: ({ getValue }) => dash(getValue<string | null>()),
      },
      {
        id: 'flight',
        header: 'FLIGHT',
        meta: { className: 'text-center' },
        cell: ({ row }) => displayFlight(row.original.airlineCode, row.original.flightNo),
      },
      { header: 'DATE', accessorKey: 'flightDate', meta: { className: 'text-center' } },
      { header: 'SHIPPER', accessorKey: 'shipperName', meta: { className: 'text-center' } },
      { header: 'CONSIGNEE', accessorKey: 'consigneeName', meta: { className: 'text-center' } },
      {
        id: 'boxCount',
        header: 'BOX',
        meta: { className: 'text-center' },
        cell: ({ row }) => (
          <CargoValueCell shipment={row.original} value={dash(row.original.boxCount)} field="boxCount" />
        ),
      },
      {
        id: 'weightKg',
        header: 'WEIGHT',
        meta: { className: 'text-center' },
        cell: ({ row }) => (
          <CargoValueCell shipment={row.original} value={dash(row.original.weightKg)} field="weightKg" />
        ),
      },
      // Dep Time minus the shipment's Commodity's Delay Hours — computed
      // server-side (shipment.util.ts's computeCutoffTime).
      { header: 'CUT-OFF TIME', accessorKey: 'cutoffTime', meta: { className: 'text-center' } },
      {
        id: 'status',
        header: 'STATUS',
        meta: { className: 'text-center' },
        cell: ({ row }) => <ChangeStatusControl shipment={row.original} />,
      },
      {
        id: 'actions',
        header: 'Actions',
        meta: { className: 'text-center' },
        cell: ({ row }) => {
          const mawbNo = row.original.mawbNo;
          return (
            <div className="flex items-center justify-center gap-2">
              <Link to={`/shipments/${row.original.id}`}>
                <Button variant="outline" size="sm">
                  View
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
    [showToast],
  );

  return (
    <DataTable
      columns={columns}
      data={shipments}
      isLoading={isLoading}
      emptyMessage={emptyMessage}
      hideLastColumnOnPrint
      getRowClassName={(row) =>
        row.status === 'CANCELLED' ? 'print:line-through' : ''
      }
    />
  );
}
