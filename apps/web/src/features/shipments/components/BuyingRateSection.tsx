import type { Shipment } from '@hub-lanka/shared';
import { Button } from '@/components/ui/button';
import { useCaptureBuyingRate } from '@/features/shipments/hooks/useShipments';
import { ApiClientError } from '@/lib/apiClient';

/** BR-44/BR-45: Manager-only, captures the airline's currently effective Rate Table value onto this shipment while it is Pending. */
export function BuyingRateSection({ shipment }: { shipment: Shipment }) {
  const captureMutation = useCaptureBuyingRate();

  return (
    <div className="border-border bg-card rounded-lg border p-6">
      <h2 className="font-medium">Airline buying rate</h2>
      <p className="text-muted-foreground mt-1 text-sm">
        Captured from the Rate Table at the moment you click below — a later rate change never
        alters an already-captured value.
      </p>

      <div className="mt-4 flex items-center gap-4">
        <div className="text-sm">
          {shipment.appliedBuyingRate ? (
            <span className="font-medium">{shipment.appliedBuyingRate} USD/kg</span>
          ) : (
            <span className="text-muted-foreground">Not yet captured</span>
          )}
        </div>
        <Button
          variant="outline"
          size="sm"
          disabled={captureMutation.isPending}
          onClick={() => captureMutation.mutate(shipment.id)}
        >
          {captureMutation.isPending
            ? 'Capturing…'
            : shipment.appliedBuyingRate
              ? 'Re-capture current rate'
              : 'Capture current rate'}
        </Button>
      </div>

      {captureMutation.isError && (
        <p className="text-destructive mt-2 text-sm">
          {captureMutation.error instanceof ApiClientError
            ? captureMutation.error.message
            : 'Unable to capture the buying rate.'}
        </p>
      )}
    </div>
  );
}
