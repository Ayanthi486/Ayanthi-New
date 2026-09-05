import { useState } from 'react';
import type { CreateShipmentRequest } from '@hub-lanka/shared';
import { RequirePermission } from '@/app/RequirePermission';
import { Button } from '@/components/ui/button';
import { ShipmentForm } from '@/features/shipments/components/ShipmentForm';
import { useCreateShipment } from '@/features/shipments/hooks/useShipments';
import { ApiClientError } from '@/lib/apiClient';

/**
 * The "Add shipment" button + create-shipment modal, factored out of
 * SchedulePage so the Dashboard's quick action and the Shipments page's own
 * action are the exact same flow (one `useCreateShipment` call site, one
 * modal) rather than two copies that could drift.
 */
export function AddShipmentAction() {
  const [isCreating, setIsCreating] = useState(false);
  const createMutation = useCreateShipment();

  const handleCreate = (values: CreateShipmentRequest) => {
    createMutation.mutate(values, { onSuccess: () => setIsCreating(false) });
  };

  return (
    <RequirePermission permission="shipment.create">
      <Button onClick={() => setIsCreating(true)}>Add shipment</Button>

      {isCreating && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-card border-border w-full max-w-2xl overflow-y-auto rounded-lg border p-6 shadow-lg">
            <h2 className="mb-4 font-medium">New shipment</h2>
            <p className="text-muted-foreground mb-4 -mt-3 text-sm">
              Basic schedule details only — cargo weight, rates, and documents are entered later in
              the shipment's own workflow.
            </p>
            <ShipmentForm
              onSubmit={(values) => handleCreate(values as CreateShipmentRequest)}
              onCancel={() => setIsCreating(false)}
              isSubmitting={createMutation.isPending}
              errorMessage={
                createMutation.isError
                  ? createMutation.error instanceof ApiClientError
                    ? createMutation.error.message
                    : 'Unable to create the shipment.'
                  : undefined
              }
            />
          </div>
        </div>
      )}
    </RequirePermission>
  );
}
