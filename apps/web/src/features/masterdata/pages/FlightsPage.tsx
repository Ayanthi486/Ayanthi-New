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
  useCreateFlight,
  useDeactivateFlight,
  useFlights,
  useUpdateFlight,
} from '@/features/masterdata/hooks/useMasterdata';

const columns: ColumnDef<Flight, unknown>[] = [
  {
    header: 'Airline',
    accessorKey: 'airlineName',
    cell: ({ row }) => {
      const airlineCode = row.original.airlineCode ?? '';
      const airlineName = row.original.airlineName ?? '';

      if (airlineName) {
        return `${airlineCode} — ${airlineName}`;
      }

      return airlineCode;
    },
  },
  {
    header: 'Flight No',
    accessorKey: 'flightNo',
    cell: ({ row }) =>
      `${row.original.airlineCode ?? ''} ${row.original.flightNo ?? ''}`.trim(),
  },
  {
    header: 'Departure Time',
    accessorKey: 'depTime',
  },
];

export function FlightsPage() {
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
      renderCreateFields={(register) => {
        const airlineCodeField = register('airlineCode');
        const flightNoField = register('flightNo');

        return (
          <>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="airline-code">Airline</Label>

              <Input
                id="airline-code"
                placeholder="e.g. EK"
                autoCapitalize="characters"
                {...airlineCodeField}
                onChange={(e) => {
                  e.target.value = e.target.value
                    .trimStart()
                    .toUpperCase();

                  airlineCodeField.onChange(e);
                }}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="flight-no">Flight Number</Label>

              <Input
                id="flight-no"
                placeholder="e.g. 0654"
                inputMode="numeric"
                maxLength={4}
                {...flightNoField}
                onChange={(e) => {
                  e.target.value = e.target.value
                    .replace(/\D/g, '')
                    .slice(0, 4);

                  flightNoField.onChange(e);
                }}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="flight-dep-time">
                Departure Time (24h)
              </Label>

              <Input
                id="flight-dep-time"
                type="time"
                {...register('depTime')}
              />
            </div>
          </>
        );
      }}
    />
  );
}