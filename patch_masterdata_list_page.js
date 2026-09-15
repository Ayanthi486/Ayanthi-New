const fs = require('fs');

let file = fs.readFileSync('apps/web/src/features/masterdata/components/MasterDataListPage.tsx', 'utf8');

file = file.replace(
  `import type { ReactNode } from 'react';`,
  `import { useState, type ReactNode } from 'react';
import { MasterDataEditDialog } from './MasterDataEditDialog';`
);

file = file.replace(
  `  useDeactivate: () => UseMutationResult<TRow, unknown, string>;`,
  `  useDeactivate: () => UseMutationResult<TRow, unknown, string>;
  useUpdate?: () => UseMutationResult<TRow, unknown, { id: string; input: TCreate }>;`
);

file = file.replace(
  `  useDeactivate,
}: MasterDataListPageProps<TRow, TCreate>) {`,
  `  useDeactivate,
  useUpdate,
}: MasterDataListPageProps<TRow, TCreate>) {
  const [editingRow, setEditingRow] = useState<TRow | null>(null);`
);

file = file.replace(
  `    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) =>
        row.original.isActive ? (
          <Button
            variant="outline"
            size="sm"
            disabled={deactivateMutation.isPending}
            onClick={() => deactivateMutation.mutate(row.original.id)}
          >
            Deactivate
          </Button>
        ) : (
          <span className="text-muted-foreground text-xs">—</span>
        ),
    },`,
  `    {
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
    },`
);

file = file.replace(
  `      <DataTable`,
  `      {editingRow && useUpdate && (
        <MasterDataEditDialog
          row={editingRow}
          resolver={resolver}
          renderCreateFields={renderCreateFields}
          useUpdate={useUpdate}
          onClose={() => setEditingRow(null)}
        />
      )}
      <DataTable`
);

fs.writeFileSync('apps/web/src/features/masterdata/components/MasterDataListPage.tsx', file);
