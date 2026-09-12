import { useState, type ChangeEvent } from 'react';
import type { Shipment, ShipmentStatus } from '@hub-lanka/shared';
import { STATUS_LABELS, StatusBadge } from '@/components/shared/StatusBadge';
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
import { useChangeShipmentStatus } from '@/features/shipments/hooks/useShipments';
import { ApiClientError } from '@/lib/apiClient';
import { useAuthStore } from '@/lib/authStore';
import { useToastStore } from '@/lib/toastStore';

const BASE_STATUSES: ShipmentStatus[] = ['PENDING', 'CONFIRMED', 'CANCELLED', 'DEPARTED'];
const PAYMENT_STATUSES: ShipmentStatus[] = ['PAYMENT_PENDING', 'PAYMENT_RECEIVED'];

/**
 * The direct, no-approval status dropdown (Schedule grid's STATUS column).
 * Read-only (a plain `<StatusBadge>`) for anyone without `shipment.status.update`
 * (i.e. Director). Executive gets the base 4 values; Manager also gets the
 * 2 Payment values (`shipment.status.payment`). Picking Departed for the
 * first time (no `actualDepartureAt` recorded yet) prompts for the actual
 * departure date/time before submitting — folds in what used to be a
 * separate "record actual departure" action.
 */
export function ChangeStatusControl({ shipment }: { shipment: Shipment }) {
  const hasPermission = useAuthStore((state) => state.hasPermission);
  const showToast = useToastStore((state) => state.show);
  const mutation = useChangeShipmentStatus();
  const [departureDialogOpen, setDepartureDialogOpen] = useState(false);
  const [departureAt, setDepartureAt] = useState('');

  const canUpdate = hasPermission('shipment.status.update');
  const canPayment = hasPermission('shipment.status.payment');

  if (!canUpdate) {
    return <StatusBadge status={shipment.status} />;
  }

  // Cargo handling (box/weight) must be entered before a shipment can move
  // to Departed — matches shipment.service.ts's changeStatus() guard. Kept
  // as a plain, selectable option (not disabled/relabeled) so the dropdown
  // stays narrow; picking it while missing just surfaces a toast instead.
  const missingCargoDetails = shipment.boxCount === null || shipment.weightKg === null;

  // The shipment's current status is always offered, even if the viewer
  // couldn't have set it themselves (e.g. an Executive viewing a shipment a
  // Manager already moved to a Payment status) — otherwise the <select>
  // would have no matching <option> for its own value.
  const options = Array.from(
    new Set<ShipmentStatus>([
      shipment.status,
      ...BASE_STATUSES,
      ...(canPayment ? PAYMENT_STATUSES : []),
    ]),
  );

  function submitStatus(status: ShipmentStatus, actualDepartureAt?: string) {
    mutation.mutate(
      { id: shipment.id, input: { status, version: shipment.version, actualDepartureAt } },
      {
        onError: (error) => {
          showToast(
            error instanceof ApiClientError
              ? error.message
              : 'Unable to update status — please refresh and try again.',
          );
        },
      },
    );
  }

  function handleChange(event: ChangeEvent<HTMLSelectElement>) {
    const next = event.target.value as ShipmentStatus;
    if (next === shipment.status) return;
    if (next === 'DEPARTED') {
      if (missingCargoDetails) {
        showToast('Add box & weight first.');
        return;
      }
      if (shipment.actualDepartureAt === null) {
        setDepartureAt('');
        setDepartureDialogOpen(true);
        return;
      }
    }
    submitStatus(next);
  }

  return (
    <>
      <select
        aria-label={`Status for ${shipment.shipmentNo}`}
        className="border-input h-8 rounded-md border bg-transparent px-2 text-xs"
        value={shipment.status}
        disabled={mutation.isPending}
        onChange={handleChange}
      >
        {options.map((status) => (
          <option key={status} value={status}>
            {STATUS_LABELS[status]}
          </option>
        ))}
      </select>

      <Dialog open={departureDialogOpen} onOpenChange={setDepartureDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Enter departure date &amp; time</DialogTitle>
            <DialogDescription>
              When did shipment {shipment.shipmentNo} actually depart?
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="actual-departure-at">Departure date/time</Label>
            <Input
              id="actual-departure-at"
              type="datetime-local"
              value={departureAt}
              onChange={(e) => setDepartureAt(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDepartureDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              disabled={!departureAt || mutation.isPending}
              onClick={() => {
                submitStatus('DEPARTED', departureAt);
                setDepartureDialogOpen(false);
              }}
            >
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
