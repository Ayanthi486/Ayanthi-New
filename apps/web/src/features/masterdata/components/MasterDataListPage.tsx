import type { ColumnDef } from '@tanstack/react-table';
import { useState, type ReactNode } from 'react';
import { MasterDataEditDialog } from './MasterDataEditDialog';
import { useForm, type FieldValues, type Resolver } from 'react-hook-form';
import type { UseMutationResult, UseQueryResult } from '@tanstack/react-query';
import { DataTable } from '@/components/shared/DataTable';
import { Button } from '@/components/ui/button';
import { ApiClientError } from '@/lib/apiClient';

interface BaseRow {
  id: string;
  isActive: boolean;
}

interface MasterDataListPageProps<TRow extends BaseRow, TCreate extends FieldValues> {
  title: string;
  description: string;
  // Precomputed at each call site (zodResolver(schema)) rather than a raw
  // schema — instantiating zodResolver generically inside this component
  // fights its overload resolution for no benefit.
  resolver: Resolver<TCreate>;
  renderCreateFields: (register: ReturnType<typeof useForm<TCreate>>['register']) => ReactNode;
  columns: ColumnDef<TRow, unknown>[];
  useList: () => UseQueryResult<TRow[]>;
  useCreate: () => UseMutationResult<TRow, unknown, TCreate>;
  useDeactivate: () => UseMutationResult<TRow, unknown, string>;
  useUpdate?: () => UseMutationResult<TRow, unknown, { id: string; input: TCreate }>;
}

/**
 * Five master-data entities (Shipper, Consignee, Airline, Airport,
 * Commodity) share the same list/create/deactivate shape — this generic
 * page is the shared UI, one call site per entity supplies the parts that
 * actually differ (schema, form fields, columns).
 */
export function MasterDataListPage<TRow extends BaseRow, TCreate extends FieldValues>({
  title,
  description,
  resolver,
  renderCreateFields,
  columns,
  useList,
  useCreate,
  useDeactivate,
  useUpdate,
}: MasterDataListPageProps<TRow, TCreate>) {
  const [editingRow, setEditingRow] = useState<TRow | null>(null);
  const listQuery = useList();
  const createMutation = useCreate();
  const deactivateMutation = useDeactivate();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<TCreate>({ resolver });

  const onSubmit = handleSubmit((values) => {
    createMutation.mutate(values, { onSuccess: () => reset() });
  });

  const allColumns: ColumnDef<TRow, unknown>[] = [
    ...columns,
    {
      id: 'status',
      header: 'Status',
      cell: ({ row }) => (row.original.isActive ? 'Active' : 'Deactivated'),
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => (
        <div className="flex gap-2">
          {useUpdate && row.original.isActive && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setEditingRow(row.original)}
            >
              Edit
            </Button>
          )}
          {row.original.isActive ? (
            <Button
              variant="outline"
              size="sm"
              disabled={deactivateMutation.isPending}
              onClick={() => deactivateMutation.mutate(row.original.id)}
            >
              Deactivate
            </Button>
          ) : (
            <span className="text-muted-foreground text-xs my-auto">—</span>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold">{title}</h1>
        <p className="text-muted-foreground mt-1 text-sm">{description}</p>
      </div>

      <form
        onSubmit={(e) => void onSubmit(e)}
        className="border-border bg-card flex flex-col gap-4 rounded-lg border p-6"
      >
        <h2 className="font-medium">Add new</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">{renderCreateFields(register)}</div>
        {Object.keys(errors).length > 0 && (
          <p className="text-destructive text-xs">Please correct the highlighted fields.</p>
        )}
        {createMutation.isError && (
          <p className="text-destructive text-sm">
            {createMutation.error instanceof ApiClientError
              ? createMutation.error.message
              : 'Unable to create the record.'}
          </p>
        )}
        <Button type="submit" disabled={createMutation.isPending} className="self-start">
          {createMutation.isPending ? 'Saving…' : 'Add'}
        </Button>
      </form>

      {editingRow && useUpdate && (
        <MasterDataEditDialog
          row={editingRow}
          resolver={resolver}
          renderCreateFields={renderCreateFields}
          useUpdate={useUpdate}
          onClose={() => setEditingRow(null)}
        />
      )}
      <DataTable
        columns={allColumns}
        data={listQuery.data ?? []}
        isLoading={listQuery.isLoading}
        emptyMessage="No records yet."
      />
    </div>
  );
}
