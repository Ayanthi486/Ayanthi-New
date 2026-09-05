import { zodResolver } from '@hookform/resolvers/zod';
import {
  createConsigneeRequestSchema,
  type Consignee,
  type CreateConsigneeRequest,
} from '@hub-lanka/shared';
import type { ColumnDef } from '@tanstack/react-table';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MasterDataListPage } from '@/features/masterdata/components/MasterDataListPage';
import { MasterDataNav } from '@/features/masterdata/components/MasterDataNav';
import {
  useConsignees,
  useCreateConsignee,
  useDeactivateConsignee,
} from '@/features/masterdata/hooks/useMasterdata';

const columns: ColumnDef<Consignee, unknown>[] = [
  { header: 'Name', accessorKey: 'name' },
  {
    header: 'Address',
    accessorKey: 'address',
    cell: ({ getValue }) => getValue<string | null>() ?? '—',
  },
];

export function ConsigneesPage() {
  return (
    <div className="flex flex-col gap-6">
      <MasterDataNav />
      <MasterDataListPage<Consignee, CreateConsigneeRequest>
        title="Consignees"
        description="Referenced by shipments — deactivating a consignee keeps its history intact."
        resolver={zodResolver(createConsigneeRequestSchema)}
        columns={columns}
        useList={useConsignees}
        useCreate={useCreateConsignee}
        useDeactivate={useDeactivateConsignee}
        renderCreateFields={(register) => (
          <>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="consignee-name">Name</Label>
              <Input id="consignee-name" {...register('name')} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="consignee-address">Address</Label>
              <Input id="consignee-address" {...register('address')} />
            </div>
          </>
        )}
      />
    </div>
  );
}
