import type { ShipmentStatus } from '@hub-lanka/shared';
import { cn } from '@/lib/utils';

/** Exactly 4 colors across the 6 statuses — related states share a color (awaiting/success). */
const STYLES: Record<ShipmentStatus, string> = {
  PENDING: 'bg-amber-100 text-amber-800',
  CONFIRMED: 'bg-blue-100 text-blue-800',
  CANCELLED: 'bg-red-100 text-red-800',
  DEPARTED: 'bg-green-100 text-green-800',
  PAYMENT_PENDING: 'bg-amber-100 text-amber-800',
  PAYMENT_RECEIVED: 'bg-green-100 text-green-800',
};

export const STATUS_LABELS: Record<ShipmentStatus, string> = {
  PENDING: 'Pending',
  CONFIRMED: 'Confirmed',
  CANCELLED: 'Cancelled',
  DEPARTED: 'Departed',
  PAYMENT_PENDING: 'Payment Pending',
  PAYMENT_RECEIVED: 'Payment Received',
};

export function StatusBadge({ status }: { status: ShipmentStatus }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
        STYLES[status],
      )}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}
