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
import {
  useAirports,
  useCreateAirport,
  useDeactivateAirport,
  useUpdateAirport,
} from '@/features/masterdata/hooks/useMasterdata';

const columns: ColumnDef<Airport, unknown>[] = [
  { header: 'Code', accessorKey: 'code' },
  { header: 'Name', accessorKey: 'name' },
];

/** Broader than masterdata.manage — Executive and Manager may both add destinations, unlike the other three (Manager-only) entities. */
export function AirportsPage() {
  return (
    <MasterDataListPage<Airport, CreateAirportRequest>
      title="Airports"
      description="Destinations — referenced by shipments' DEST column. Executive and Manager may both add one; deactivating one is Manager-only. Each destination code (e.g. DXB) can only be added once."
      resolver={zodResolver(createAirportRequestSchema)}
      columns={columns}
      useList={useAirports}
      useCreate={useCreateAirport}
      useDeactivate={useDeactivateAirport}
      useUpdate={useUpdateAirport}
      renderCreateFields={(register) => {
        const codeField = register('code');
        return (
          <>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="airport-code">Code</Label>
              <Input
                id="airport-code"
                placeholder="e.g. DXB"
                maxLength={3}
                {...codeField}
                onChange={(e) => {
                  e.target.value = e.target.value.replace(/[^a-zA-Z]/g, '').slice(0, 3).toUpperCase();
                  void codeField.onChange(e);
                }}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="airport-name">Name</Label>
              <Input id="airport-name" {...register('name')} />
            </div>
          </>
        );
      }}
    />
  );
}
