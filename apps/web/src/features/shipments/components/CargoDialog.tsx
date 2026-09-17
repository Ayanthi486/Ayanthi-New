import { zodResolver } from '@hookform/resolvers/zod';
import { setCargoRequestSchema, type SetCargoRequest, type Shipment } from '@hub-lanka/shared';
import { useState, type ReactNode } from 'react';
import { useForm, type Resolver } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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

/**
 * BR-06: the one box/weight entry form, shared by every place a shipment's
 * BOX/WEIGHT can be set (the Schedule grid's inline cell, the shipment
 * detail view's Cargo section) so "editable only while Pending" has a
 * single UI rather than a copy per page. Callers own the gating
 * (permission + status) and just supply a trigger to open it.
 */
export function CargoDialog({
  shipment,
  trigger,
  field,
}: {
  shipment: Shipment;
  trigger: (open: () => void) => ReactNode;
  field?: 'boxCount' | 'weightKg';
}) {
  const [open, setOpen] = useState(false);
  const setCargoMutation = useSetCargo();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<SetCargoRequest>({
    // See ShipmentForm.tsx's identical cast: the numericBoxCount
    // preprocessing widens the schema's inferred input type in a way
    // zodResolver's generics can't unify with SetCargoRequest, though both
    // validate the same runtime shape this component submits.
    resolver: zodResolver(formSchema) as Resolver<SetCargoRequest>,
    defaultValues: {
      boxCount: shipment.boxCount ?? undefined,
      weightKg: shipment.weightKg ? Number(shipment.weightKg).toFixed(3) : undefined,
      version: shipment.version,
    },
  });

  function openDialog() {
    reset({
      boxCount: shipment.boxCount ?? undefined,
      weightKg: shipment.weightKg ? Number(shipment.weightKg).toFixed(3) : undefined,
      version: shipment.version,
    });
    setOpen(true);
  }

  const submit = handleSubmit((values) => {
    const input = {
      version: values.version,
      ...(field === 'boxCount' || !field ? { boxCount: values.boxCount } : {}),
      ...(field === 'weightKg' || !field ? { weightKg: values.weightKg } : {}),
    };
    
    setCargoMutation.mutate(
      { id: shipment.id, input },
      { onSuccess: () => setOpen(false) },
    );
  });

  return (
    <>
      {trigger(openDialog)}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {field === 'boxCount' ? 'Box count' : field === 'weightKg' ? 'Weight' : 'Box & weight'}
            </DialogTitle>
            <DialogDescription>
              Shipment {shipment.shipmentNo} — editable only while Pending.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={(e) => void submit(e)} className="flex flex-col gap-4">
            <input type="hidden" {...register('version', { valueAsNumber: true })} />
            {(!field || field === 'boxCount') && (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="cargo-boxCount">Box count</Label>
                <Input id="cargo-boxCount" type="number" step="1" min="1" {...register('boxCount')} autoFocus={field === 'boxCount'} />
                {errors.boxCount && (
                  <p className="text-destructive text-xs">{errors.boxCount.message}</p>
                )}
              </div>
            )}
            {(!field || field === 'weightKg') && (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="cargo-weightKg">Weight (kg)</Label>
                <Input
                  id="cargo-weightKg"
                  inputMode="decimal"
                  placeholder="e.g. 444.500"
                  {...register('weightKg', {
                    onChange: (e) => {
                      e.target.value = e.target.value.replace(/[^0-9.,]/g, '');
                    }
                  })}
                  autoFocus={field === 'weightKg'}
                />
                {errors.weightKg && (
                  <p className="text-destructive text-xs">{errors.weightKg.message}</p>
                )}
              </div>
            )}
            {setCargoMutation.isError && (
              <p className="text-destructive text-sm">
                {setCargoMutation.error instanceof ApiClientError
                  ? setCargoMutation.error.message
                  : 'Unable to save box/weight.'}
              </p>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={setCargoMutation.isPending}>
                {setCargoMutation.isPending ? 'Saving…' : 'Save'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
