import { Button } from '@/components/ui/button';
import {
  useCancellationQueue,
  useReviewCancellation,
} from '@/features/shipments/hooks/useShipments';

/** Manager-only (gated by the caller via RequirePermission on shipment.cancellation.approve). */
export function CancellationApprovalQueue() {
  const queueQuery = useCancellationQueue();
  const reviewMutation = useReviewCancellation();

  const requests = queueQuery.data ?? [];
  if (!queueQuery.isLoading && requests.length === 0) {
    return null;
  }

  return (
    <div className="border-border bg-card flex flex-col gap-3 rounded-lg border p-4">
      <h2 className="font-medium">Pending cancellation requests</h2>
      {queueQuery.isLoading && <p className="text-muted-foreground text-sm">Loading…</p>}
      {requests.map((req) => (
        <div
          key={req.id}
          className="border-border flex flex-col gap-2 rounded-md border p-3 sm:flex-row sm:items-center sm:justify-between"
        >
          <div>
            <div className="font-medium">{req.shipmentNo}</div>
            <div className="text-muted-foreground text-sm">{req.reason}</div>
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={reviewMutation.isPending}
              onClick={() => reviewMutation.mutate({ requestId: req.id, decision: 'reject' })}
            >
              Reject
            </Button>
            <Button
              size="sm"
              disabled={reviewMutation.isPending}
              onClick={() => reviewMutation.mutate({ requestId: req.id, decision: 'approve' })}
            >
              Approve
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
