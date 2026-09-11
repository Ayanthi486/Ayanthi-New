import type { ShipmentStatus } from '@hub-lanka/shared';
import { STATUS_LABELS } from '@/components/shared/StatusBadge';

/** BR-10: once past Pending/Confirmed, a shipment is locked against normal editing. */
export function LockedBanner({ status }: { status: ShipmentStatus }) {
  return (
    <div className="rounded-md border border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-900">
      This shipment is {STATUS_LABELS[status]} and locked against editing.
    </div>
  );
}
