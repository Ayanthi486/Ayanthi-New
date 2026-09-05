import { zodResolver } from '@hookform/resolvers/zod';
import {
  createAirlineRequestSchema,
  type Airline,
  type CreateAirlineRequest,
} from '@hub-lanka/shared';
import type { ColumnDef } from '@tanstack/react-table';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MasterDataListPage } from '@/features/masterdata/components/MasterDataListPage';
import { MasterDataNav } from '@/features/masterdata/components/MasterDataNav';
import {
  useAirlines,
  useCreateAirline,
  useDeactivateAirline,
} from '@/features/masterdata/hooks/useMasterdata';

const columns: ColumnDef<Airline, unknown>[] = [{ header: 'Name', accessorKey: 'name' }];

/** BR-58: airline is a stored, explicit reference — never derived from the MAWB prefix. */
export function AirlinesPage() {
  return (
    <div className="flex flex-col gap-6">
      <MasterDataNav />
      <MasterDataListPage<Airline, CreateAirlineRequest>
        title="Airlines"
        description="Referenced by shipments and the Rate Table — deactivating an airline keeps its history intact."
        resolver={zodResolver(createAirlineRequestSchema)}
        columns={columns}
        useList={useAirlines}
        useCreate={useCreateAirline}
        useDeactivate={useDeactivateAirline}
        renderCreateFields={(register) => (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="airline-name">Name</Label>
            <Input id="airline-name" {...register('name')} />
          </div>
        )}
      />
    </div>
  );
}
