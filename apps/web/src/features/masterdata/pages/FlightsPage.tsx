import { zodResolver } from '@hookform/resolvers/zod';
import type { ColumnDef } from '@tanstack/react-table';
import {
  createFlightRequestSchema,
  type CreateFlightRequest,
  type Flight,
} from '@hub-lanka/shared';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

import { MasterDataListPage } from '@/features/masterdata/components/MasterDataListPage';
import {
  useAirlines,
  useCreateFlight,
  useDeactivateFlight,
  useFlights,
  useUpdateFlight,
} from '@/features/masterdata/hooks/useMasterdata';

const columns: ColumnDef<Flight, unknown>[] = [
  { header: 'Airline', accessorKey: 'airlineName' },
  { 
    header: 'Flight No', 
    accessorKey: 'flightNo',
    cell: ({ row }) => `${row.original.airlineCode} ${row.original.flightNo}`
  },
  { header: 'Departure Time', accessorKey: 'depTime' },
];

export function FlightsPage() {
  const airlinesQuery = useAirlines();

  return (
    <MasterDataListPage<Flight, CreateFlightRequest>
      title="Flights"
      description="Referenced by shipments — deactivating a flight keeps its history intact. Executive and Manager may both add one, deactivating is Manager-only."
      resolver={zodResolver(createFlightRequestSchema)}
      columns={columns}
      useList={useFlights}
      useCreate={useCreateFlight}
      useDeactivate={useDeactivateFlight}
      useUpdate={useUpdateFlight}
      renderCreateFields={(register) => (
        <>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="flight-airline">Airline</Label>
            <select id="flight-airline" className="border-input h-9 rounded-md border bg-transparent px-3 text-sm" {...register('airlineId')}>
              <option value="">Select airline…</option>
              {airlinesQuery.data?.map((airline) => (
                <option key={airline.id} value={airline.id}>
                  {airline.code} — {airline.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="flight-no">Flight No</Label>
            <Input
              id="flight-no"
              placeholder="e.g. 0654"
              maxLength={4}
              {...register('flightNo')}
              onChange={(e) => {
                e.target.value = e.target.value.replace(/\D/g, '').slice(0, 4);
                register('flightNo').onChange(e);
              }}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="flight-dep-time">Departure Time (24h)</Label>
            <Input id="flight-dep-time" type="time" {...register('depTime')} />
          </div>
        </>
      )}
    />
  );
}
