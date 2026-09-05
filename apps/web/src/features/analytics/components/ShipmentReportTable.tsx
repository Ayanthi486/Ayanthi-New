import { useMemo } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import type { AnalyticsShipmentRow } from '@hub-lanka/shared';
import { DataTable } from '@/components/shared/DataTable';

const dash = (value: string | number | null): string | number => value ?? '—';

/** The drill-through list — PRD §10: every summary figure must reconcile with this same record list. */
export function ShipmentReportTable({
  rows,
  isLoading,
}: {
  rows: AnalyticsShipmentRow[];
  isLoading: boolean;
}) {
  const columns = useMemo<ColumnDef<AnalyticsShipmentRow, unknown>[]>(
    () => [
      { header: 'Shipment ID', accessorKey: 'shipmentNo' },
      { header: 'Date', accessorKey: 'flightDate' },
      { header: 'Commodity', accessorKey: 'commodityName' },
      { header: 'Airline', accessorKey: 'airlineName' },
      { header: 'Shipper', accessorKey: 'shipperName' },
      {
        header: 'Weight (kg)',
        accessorKey: 'weightKg',
        cell: ({ getValue }) => dash(getValue<string | null>()),
      },
      { header: 'Revenue (USD)', accessorKey: 'revenueUsd' },
      { header: 'Revenue (LKR)', accessorKey: 'revenueLkr' },
      { header: 'Buying Cost (LKR)', accessorKey: 'buyingCostLkr' },
      { header: 'Opex (LKR)', accessorKey: 'opexLkr' },
      { header: 'Profit (LKR)', accessorKey: 'profitLkr' },
    ],
    [],
  );

  return (
    <DataTable
      columns={columns}
      data={rows}
      isLoading={isLoading}
      emptyMessage="No shipments match these filters."
    />
  );
}
