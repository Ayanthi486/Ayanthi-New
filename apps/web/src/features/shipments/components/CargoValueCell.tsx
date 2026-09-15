import type { Shipment } from '@hub-lanka/shared';
import { CargoDialog } from '@/features/shipments/components/CargoDialog';
import { useAuthStore } from '@/lib/authStore';

/**
 * BOX and WEIGHT are each just their value/dash — clicking directly on
 * either (no separate Edit/Add button) opens the shared `CargoDialog`
 * (BR-06), which sets both fields together. Plain, unclickable text once
 * the shipment leaves Pending or the viewer lacks cargo.boxweight.enter.
 * Shared by the Schedule grid's BOX/WEIGHT columns and the shipment detail
 * view's fields card — one click-to-edit entry point, not a copy per page.
 */
export function CargoValueCell({
  shipment,
  value,
}: {
  shipment: Shipment;
  value: string | number;
}) {
  const hasPermission = useAuthStore((state) => state.hasPermission);
  const canEdit = ['PENDING', 'CONFIRMED', 'CANCELLED'].includes(shipment.status) && hasPermission('cargo.boxweight.enter');

  if (!canEdit) {
    return <span>{value}</span>;
  }

  return (
    <CargoDialog
      shipment={shipment}
      trigger={(open) => (
        <button type="button" className="underline-offset-2 hover:underline" onClick={open}>
          {value}
        </button>
      )}
    />
  );
}
