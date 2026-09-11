import { zodResolver } from '@hookform/resolvers/zod';
import type { ColumnDef } from '@tanstack/react-table';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import type { Flight } from '@hub-lanka/shared';
import { DataTable } from '@/components/shared/DataTable';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  useAirlines,
  useCreateFlight,
  useDeactivateFlight,
  useFlights,
} from '@/features/masterdata/hooks/useMasterdata';
import { ApiClientError } from '@/lib/apiClient';
import { formatFlightNumber, splitFlightNumber } from '@/lib/utils';

const flightNumberPattern = /^[A-Z0-9]{2} \d{4}$/;
const time24Pattern = /^([01]\d|2[0-3]):[0-5]\d$/;

const createFlightFormSchema = z.object({
  flightNumber: z
    .string()
    .trim()
    .regex(flightNumberPattern, 'Expected format "EK 0654"'),
  depTime: z.string().regex(time24Pattern, 'Expected 24-hour time as HH:mm'),
});
type CreateFlightForm = z.infer<typeof createFlightFormSchema>;

const columns: ColumnDef<Flight, unknown>[] = [
  { header: 'Airline', accessorKey: 'airlineName' },
  { header: 'Flight No', accessorKey: 'flightNo' },
  { header: 'Departure Time', accessorKey: 'depTime' },
];

/**
 * Not built on the shared MasterDataListPage: Flight's create form takes one
 * combined "EK 0654" field (mirrors the Add Shipment form's FLIGHT field),
 * not a plain 1:1 mapping onto CreateFlightRequest's {airlineId, flightNo}
 * shape, so it needs its own airline-code lookup before submitting.
 */
export function FlightsPage() {
  const flightsQuery = useFlights();
  const airlinesQuery = useAirlines();
  const createFlightMutation = useCreateFlight();
  const deactivateMutation = useDeactivateFlight();

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<CreateFlightForm>({ resolver: zodResolver(createFlightFormSchema) });

  const flightNumberField = register('flightNumber');

  const onSubmit = handleSubmit(async (values) => {
    const { code, flightNo } = splitFlightNumber(values.flightNumber);
    const airline = airlinesQuery.data?.find((a) => a.code === code);
    if (!airline) {
      setError('flightNumber', {
        message: `No airline found with code "${code}". Add it in Master Data → Airlines first.`,
      });
      return;
    }
    try {
      await createFlightMutation.mutateAsync({ airlineId: airline.id, flightNo, depTime: values.depTime });
      reset();
    } catch {
      // Surfaced below via createFlightMutation.isError.
    }
  });

  const allColumns: ColumnDef<Flight, unknown>[] = [
    ...columns,
    {
      id: 'status',
      header: 'Status',
      cell: ({ row }) => (row.original.isActive ? 'Active' : 'Deactivated'),
    },
    {
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
    },
  ];

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold">Flights</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Referenced by shipments — deactivating a flight keeps its history intact. Identified by
          its airline code and flight number together (e.g. "EK 0654"); Executive and Manager may
          both add one, deactivating is Manager-only.
        </p>
      </div>

      <form
        onSubmit={(e) => void onSubmit(e)}
        className="border-border bg-card flex flex-col gap-4 rounded-lg border p-6"
      >
        <h2 className="font-medium">Add new</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="flight-number">Flight Number</Label>
            <Input
              id="flight-number"
              placeholder="e.g. EK 0654"
              {...flightNumberField}
              onChange={(e) => {
                e.target.value = formatFlightNumber(e.target.value);
                void flightNumberField.onChange(e);
              }}
            />
            {errors.flightNumber && (
              <p className="text-destructive text-xs">{errors.flightNumber.message}</p>
            )}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="flight-dep-time">Departure Time (24h)</Label>
            <Input id="flight-dep-time" type="time" {...register('depTime')} />
            {errors.depTime && <p className="text-destructive text-xs">{errors.depTime.message}</p>}
          </div>
        </div>
        {createFlightMutation.isError && (
          <p className="text-destructive text-sm">
            {createFlightMutation.error instanceof ApiClientError
              ? createFlightMutation.error.message
              : 'Unable to create the record.'}
          </p>
        )}
        <Button type="submit" disabled={createFlightMutation.isPending} className="self-start">
          {createFlightMutation.isPending ? 'Saving…' : 'Add'}
        </Button>
      </form>

      <DataTable
        columns={allColumns}
        data={flightsQuery.data ?? []}
        isLoading={flightsQuery.isLoading}
        emptyMessage="No records yet."
      />
    </div>
  );
}
