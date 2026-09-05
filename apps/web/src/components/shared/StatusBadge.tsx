import type { ShipmentStatus } from '@hub-lanka/shared';
import { cn } from '@/lib/utils';

const STYLES: Record<ShipmentStatus, string> = {
  PENDING: 'bg-amber-100 text-amber-800',
  COMPLETED: 'bg-green-100 text-green-800',
  CANCELLED: 'bg-gray-200 text-gray-600 line-through',
};

/** BR-08: exactly these three statuses. */
export function StatusBadge({ status }: { status: ShipmentStatus }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
        STYLES[status],
      )}
    >
      {status}
    </span>
  );
}
