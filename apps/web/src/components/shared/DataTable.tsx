import { flexRender, getCoreRowModel, useReactTable, type ColumnDef } from '@tanstack/react-table';

interface DataTableProps<TData> {
  columns: ColumnDef<TData, unknown>[];
  data: TData[];
  isLoading?: boolean;
  emptyMessage?: string;
}

/**
 * Thin wrapper over TanStack Table v8 (ARCHITECTURE §3). Phase 2 shipped
 * one grid on plain markup because the installed package was actually the
 * v9 composable-features rewrite (a materially different API); Phase 3
 * pinned the dependency down to real v8 (`@tanstack/react-table@^8.21.3`)
 * and this component backs every grid from here on (schedule, master
 * data, Rate Table) — see the Phase 3 report.
 *
 * Server-side sort/filter/pagination stays the caller's responsibility —
 * this component only renders whatever page of rows it's given.
 */
export function DataTable<TData>({
  columns,
  data,
  isLoading,
  emptyMessage = 'No records.',
}: DataTableProps<TData>) {
  const table = useReactTable({ data, columns, getCoreRowModel: getCoreRowModel() });

  return (
    <div className="border-border bg-card overflow-x-auto rounded-lg border">
      <table className="w-full text-sm">
        <thead>
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id} className="border-border border-b text-left">
              {headerGroup.headers.map((header) => (
                <th key={header.id} className="px-4 py-3 font-medium whitespace-nowrap">
                  {header.isPlaceholder
                    ? null
                    : flexRender(header.column.columnDef.header, header.getContext())}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((row) => (
            <tr key={row.id} className="border-border border-b last:border-0">
              {row.getVisibleCells().map((cell) => (
                <td key={cell.id} className="px-4 py-3 whitespace-nowrap">
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {isLoading && <p className="text-muted-foreground p-4 text-sm">Loading…</p>}
      {!isLoading && data.length === 0 && (
        <p className="text-muted-foreground p-4 text-sm">{emptyMessage}</p>
      )}
    </div>
  );
}
