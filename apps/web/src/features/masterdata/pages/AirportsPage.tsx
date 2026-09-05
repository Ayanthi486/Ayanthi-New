import { zodResolver } from '@hookform/resolvers/zod';
import {
  createAirportRequestSchema,
  type Airport,
  type CreateAirportRequest,
} from '@hub-lanka/shared';
import type { ColumnDef } from '@tanstack/react-table';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MasterDataListPage } from '@/features/masterdata/components/MasterDataListPage';
import { MasterDataNav } from '@/features/masterdata/components/MasterDataNav';
import {
  useAirports,
  useCreateAirport,
  useDeactivateAirport,
} from '@/features/masterdata/hooks/useMasterdata';

const columns: ColumnDef<Airport, unknown>[] = [
  { header: 'Code', accessorKey: 'code' },
  { header: 'Name', accessorKey: 'name' },
];

export function AirportsPage() {
  return (
    <div className="flex flex-col gap-6">
      <MasterDataNav />
      <MasterDataListPage<Airport, CreateAirportRequest>
        title="Airports"
        description="Destinations — referenced by shipments' DEST column."
        resolver={zodResolver(createAirportRequestSchema)}
        columns={columns}
        useList={useAirports}
        useCreate={useCreateAirport}
        useDeactivate={useDeactivateAirport}
        renderCreateFields={(register) => (
          <>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="airport-code">Code</Label>
              <Input id="airport-code" placeholder="e.g. DXB" {...register('code')} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="airport-name">Name</Label>
              <Input id="airport-name" {...register('name')} />
            </div>
          </>
        )}
      />
    </div>
  );
}
