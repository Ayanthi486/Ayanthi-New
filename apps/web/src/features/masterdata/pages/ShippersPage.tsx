import { zodResolver } from '@hookform/resolvers/zod';
import {
  createShipperRequestSchema,
  type CreateShipperRequest,
  type Shipper,
} from '@hub-lanka/shared';
import type { ColumnDef } from '@tanstack/react-table';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { MasterDataListPage } from '@/features/masterdata/components/MasterDataListPage';
import { MasterDataNav } from '@/features/masterdata/components/MasterDataNav';
import {
  useCreateShipper,
  useDeactivateShipper,
  useShippers,
} from '@/features/masterdata/hooks/useMasterdata';

const columns: ColumnDef<Shipper, unknown>[] = [
  { header: 'Name', accessorKey: 'name' },
  {
    header: 'Address',
    accessorKey: 'address',
    cell: ({ getValue }) => {
      const value = getValue<string | null>();
      return value ? <span className="whitespace-pre-line">{value}</span> : '—';
    },
  },
  {
    header: 'Contact',
    accessorKey: 'contact',
    cell: ({ getValue }) => getValue<string | null>() ?? '—',
  },
];

export function ShippersPage() {
  return (
    <div className="flex flex-col gap-6">
      <MasterDataNav />
      <MasterDataListPage<Shipper, CreateShipperRequest>
        title="Shippers"
        description="Referenced by shipments — deactivating a shipper keeps its history intact."
        resolver={zodResolver(createShipperRequestSchema)}
        columns={columns}
        useList={useShippers}
        useCreate={useCreateShipper}
        useDeactivate={useDeactivateShipper}
        renderCreateFields={(register) => (
          <>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="shipper-name">Name</Label>
              <Input id="shipper-name" {...register('name')} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="shipper-address">Address</Label>
              <Textarea id="shipper-address" rows={3} {...register('address')} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="shipper-contact">Contact</Label>
              <Input id="shipper-contact" {...register('contact')} />
            </div>
          </>
        )}
      />
    </div>
  );
}
