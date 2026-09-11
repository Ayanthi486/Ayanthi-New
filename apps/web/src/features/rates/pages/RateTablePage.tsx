import { useMemo } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { createRateRequestSchema, type CreateRateRequest } from '@hub-lanka/shared';
import type { ColumnDef } from '@tanstack/react-table';
import { useForm } from 'react-hook-form';
import type { RateTableEntry } from '@hub-lanka/shared';
import { DataTable } from '@/components/shared/DataTable';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAirlines } from '@/features/masterdata/hooks/useMasterdata';
import { useCreateRate, useRates } from '@/features/rates/hooks/useRates';
import { ApiClientError } from '@/lib/apiClient';

/** Manager-only page (route is gated by masterdata.manage-equivalent rate.table.manage in App.tsx). BR-45: effective-period history — there is no "edit rate" action, only "new period". */
export function RateTablePage() {
  const ratesQuery = useRates();
  const airlinesQuery = useAirlines();
  const createMutation = useCreateRate();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateRateRequest>({ resolver: zodResolver(createRateRequestSchema) });

  const onSubmit = handleSubmit((values) => {
    createMutation.mutate(values, { onSuccess: () => reset() });
  });

  const columns = useMemo<ColumnDef<RateTableEntry, unknown>[]>(
    () => [
      { header: 'Airline', accessorKey: 'airlineName' },
      { header: 'Rate (USD/kg)', accessorKey: 'rateUsdPerKg' },
      { header: 'Effective from', accessorKey: 'effectiveFrom' },
      {
        header: 'Effective to',
        accessorKey: 'effectiveTo',
        cell: ({ getValue }) => getValue<string | null>() ?? 'Current',
      },
    ],
    [],
  );

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold">Rate Table</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Weekly airline buying rates in USD/kg. Every change creates a new effective period —
          history is never edited (BR-43).
        </p>
      </div>

      <form
        onSubmit={(e) => void onSubmit(e)}
        className="border-border bg-card flex flex-col gap-4 rounded-lg border p-6"
      >
        <h2 className="font-medium">New rate period</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="airlineId">Airline</Label>
            <select
              id="airlineId"
              className="border-input h-9 rounded-md border bg-transparent px-3 text-sm"
              {...register('airlineId')}
            >
              <option value="">Select an airline…</option>
              {airlinesQuery.data?.map((airline) => (
                <option key={airline.id} value={airline.id}>
                  {airline.code} — {airline.name}
                </option>
              ))}
            </select>
            {errors.airlineId && (
              <p className="text-destructive text-xs">{errors.airlineId.message}</p>
            )}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="rateUsdPerKg">Rate (USD/kg)</Label>
            <Input id="rateUsdPerKg" placeholder="e.g. 4.7500" {...register('rateUsdPerKg')} />
            {errors.rateUsdPerKg && (
              <p className="text-destructive text-xs">{errors.rateUsdPerKg.message}</p>
            )}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="effectiveFrom">Effective from</Label>
            <Input id="effectiveFrom" type="date" {...register('effectiveFrom')} />
            {errors.effectiveFrom && (
              <p className="text-destructive text-xs">{errors.effectiveFrom.message}</p>
            )}
          </div>
        </div>

        {createMutation.isError && (
          <p className="text-destructive text-sm">
            {createMutation.error instanceof ApiClientError
              ? createMutation.error.message
              : 'Unable to create the rate period.'}
          </p>
        )}

        <Button type="submit" disabled={createMutation.isPending} className="self-start">
          {createMutation.isPending ? 'Saving…' : 'Add rate period'}
        </Button>
      </form>

      <DataTable
        columns={columns}
        data={ratesQuery.data ?? []}
        isLoading={ratesQuery.isLoading}
        emptyMessage="No rate periods yet."
      />
    </div>
  );
}
