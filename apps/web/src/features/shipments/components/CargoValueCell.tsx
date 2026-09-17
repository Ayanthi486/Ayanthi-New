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
  field,
}: {
  shipment: Shipment;
  value: string | number;
  field: 'boxCount' | 'weightKg';
}) {
  const hasPermission = useAuthStore((state) => state.hasPermission);
  const canEdit = ['PENDING', 'CONFIRMED', 'CANCELLED'].includes(shipment.status) && hasPermission('cargo.boxweight.enter');

  let displayValue = value;
  if (field === 'weightKg' && value !== '—' && value !== null && value !== '') {
    const num = Number(value);
    if (!isNaN(num)) {
      displayValue = num.toFixed(3);
    }
  }

  if (!canEdit) {
    return <span>{displayValue}</span>;
  }

  return (
    <CargoDialog
      shipment={shipment}
      field={field}
      trigger={(open) => (
        <button type="button" className="underline-offset-2 hover:underline" onClick={open}>
          {displayValue}
        </button>
      )}
    />
  );
}
