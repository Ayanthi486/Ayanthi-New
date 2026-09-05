import { zodResolver } from '@hookform/resolvers/zod';
import { setCargoRequestSchema, type SetCargoRequest, type Shipment } from '@hub-lanka/shared';
import { useForm, type Resolver } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useSetCargo } from '@/features/shipments/hooks/useShipments';
import { ApiClientError } from '@/lib/apiClient';

/** Native <input type="number"> hands react-hook-form a string. */
const numericBoxCount = z.preprocess(
  (value) => (value === '' || value === undefined ? undefined : Number(value)),
  z.number().int().positive().optional(),
);
const formSchema = setCargoRequestSchema.extend({ boxCount: numericBoxCount });

/** BR-06: the only place BOX/WEIGHT can be entered or edited, and only while the shipment is Pending. */
export function CargoSection({ shipment }: { shipment: Shipment }) {
  const setCargoMutation = useSetCargo();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SetCargoRequest>({
    // See ShipmentForm.tsx's identical cast: the numericBoxCount
    // preprocessing widens the schema's inferred input type in a way
    // zodResolver's generics can't unify with SetCargoRequest, though both
    // validate the same runtime shape this component submits.
    resolver: zodResolver(formSchema) as Resolver<SetCargoRequest>,
    defaultValues: {
      boxCount: shipment.boxCount ?? undefined,
      weightKg: shipment.weightKg ?? undefined,
      version: shipment.version,
    },
  });

  const submit = handleSubmit((values) => {
    setCargoMutation.mutate({ id: shipment.id, input: values });
  });

  return (
    <div className="border-border bg-card rounded-lg border p-6">
      <h2 className="font-medium">Cargo (box / weight)</h2>
      <p className="text-muted-foreground mt-1 text-sm">
        Editable only while the shipment is Pending (BR-06).
      </p>

      <form onSubmit={(e) => void submit(e)} className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <input type="hidden" {...register('version', { valueAsNumber: true })} />
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="cargo-boxCount">Box count</Label>
          <Input id="cargo-boxCount" type="number" step="1" min="1" {...register('boxCount')} />
          {errors.boxCount && <p className="text-destructive text-xs">{errors.boxCount.message}</p>}
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="cargo-weightKg">Weight (kg)</Label>
          <Input
            id="cargo-weightKg"
            inputMode="decimal"
            placeholder="e.g. 444.500"
            {...register('weightKg')}
          />
          {errors.weightKg && <p className="text-destructive text-xs">{errors.weightKg.message}</p>}
        </div>
        <div className="flex items-end">
          <Button type="submit" disabled={setCargoMutation.isPending}>
            {setCargoMutation.isPending ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </form>

      {setCargoMutation.isError && (
        <p className="text-destructive mt-2 text-sm">
          {setCargoMutation.error instanceof ApiClientError
            ? setCargoMutation.error.message
            : 'Unable to save box/weight.'}
        </p>
      )}
    </div>
  );
}
