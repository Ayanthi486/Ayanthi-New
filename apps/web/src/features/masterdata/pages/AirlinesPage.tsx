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
import {
  useAirlines,
  useCreateAirline,
  useDeactivateAirline,
  useUpdateAirline,
} from '@/features/masterdata/hooks/useMasterdata';

const columns: ColumnDef<Airline, unknown>[] = [
  { header: 'Code', accessorKey: 'code' },
  { header: 'Name', accessorKey: 'name' },
  { header: 'MAWB Prefix', accessorKey: 'awbPrefix' },
];

/**
 * BR-58: airline is a stored, explicit reference — never derived from the
 * MAWB prefix. Broader than masterdata.manage — Executive and Manager may
 * both add airlines, unlike Shippers/Consignees (Manager-only): needed to
 * complete the flight-adding flow (see FlightsController).
 */
export function AirlinesPage() {
  return (
    <MasterDataListPage<Airline, CreateAirlineRequest>
      title="Airlines"
      description="Referenced by shipments and the Rate Table — deactivating an airline keeps its history intact. Identified by its 2-character IATA code (e.g. EK, G9); Executive and Manager may both add one, deactivating is Manager-only."
      resolver={zodResolver(createAirlineRequestSchema)}
      columns={columns}
      useList={useAirlines}
      useCreate={useCreateAirline}
      useDeactivate={useDeactivateAirline}
      useUpdate={useUpdateAirline}
      renderCreateFields={(register) => {
        const codeField = register('code');
        return (
          <>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="airline-code">Code</Label>
              <Input
                id="airline-code"
                placeholder="e.g. EK"
                maxLength={2}
                {...codeField}
                onChange={(e) => {
                  e.target.value = e.target.value
                    .replace(/[^a-zA-Z0-9]/g, '')
                    .slice(0, 2)
                    .toUpperCase();
                  void codeField.onChange(e);
                }}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="airline-name">Name</Label>
              <Input id="airline-name" placeholder="e.g. Emirates" {...register('name')} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="airline-prefix">MAWB Prefix</Label>
              <Input
                id="airline-prefix"
                placeholder="e.g. 176"
                maxLength={3}
                {...register('awbPrefix')}
              />
            </div>
          </>
        );
      }}
    />
  );
}
