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
<<<<<<< HEAD
=======
import { ApiClientError } from '@/lib/apiClient';

const time24Pattern = /^([01]\d|2[0-3]):[0-5]\d$/;

const createFlightFormSchema = z.object({
  airlineCode: z.string().min(1, 'Airline is required'),
  flightNo: z.string().trim().regex(/^\d{4}$/, 'Expected 4 digits (e.g. 0654)'),
  depTime: z.string().regex(time24Pattern, 'Expected 24-hour time as HH:mm'),
});
type CreateFlightForm = z.infer<typeof createFlightFormSchema>;
>>>>>>> d2ae00b (fix flight and shipment master data)

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
<<<<<<< HEAD
  const airlinesQuery = useAirlines();
=======
  const flightsQuery = useFlights();
  const createFlightMutation = useCreateFlight();
  const deactivateMutation = useDeactivateFlight();

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<CreateFlightForm>({ resolver: zodResolver(createFlightFormSchema) });

  const onSubmit = handleSubmit(async (values) => {
    try {
      await createFlightMutation.mutateAsync({ airlineCode: values.airlineCode, flightNo: values.flightNo, depTime: values.depTime });
      reset();
    } catch (err: any) {
      if (err instanceof ApiClientError && err.status === 400 && err.message.includes('No airline found')) {
        setError('airlineCode', { type: 'manual', message: err.message });
      }
      // other errors surfaced below via createFlightMutation.isError.
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
>>>>>>> d2ae00b (fix flight and shipment master data)

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
<<<<<<< HEAD
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
=======
            <Label htmlFor="airlineCode">Airline</Label>
            <Input
              id="airlineCode"
              placeholder="Enter airline code"
              {...register('airlineCode')}
            />
            {errors.airlineCode && (
              <p className="text-destructive text-xs">{errors.airlineCode.message}</p>
            )}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="flight-no">Flight Number</Label>
            <Input
              id="flight-no"
              placeholder="e.g. 0654"
              {...register('flightNo')}
              onChange={(e) => {
                e.target.value = e.target.value.replace(/[^0-9]/g, '').slice(0, 4);
                register('flightNo').onChange(e);
              }}
            />
            {errors.flightNo && (
              <p className="text-destructive text-xs">{errors.flightNo.message}</p>
            )}
>>>>>>> d2ae00b (fix flight and shipment master data)
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
