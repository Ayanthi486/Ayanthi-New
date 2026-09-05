import { useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import type { Shipment, UpdateShipmentRequest } from '@hub-lanka/shared';
import { RequirePermission } from '@/app/RequirePermission';
import { Button } from '@/components/ui/button';
import { CostSheetSection } from '@/features/costsheet/components/CostSheetSection';
import { DocumentsSection } from '@/features/documents/components/DocumentsSection';
import { InvoiceSection } from '@/features/invoice/components/InvoiceSection';
import { BuyingRateSection } from '@/features/shipments/components/BuyingRateSection';
import { CancellationRequestModal } from '@/features/shipments/components/CancellationRequestModal';
import { CargoSection } from '@/features/shipments/components/CargoSection';
import { ConflictDialog } from '@/features/shipments/components/ConflictDialog';
import { LockedBanner } from '@/features/shipments/components/LockedBanner';
import { ShipmentForm } from '@/features/shipments/components/ShipmentForm';
import {
  useCompleteShipment,
  useDeleteShipment,
  useRecordActualDeparture,
  useRequestCancellation,
  useShipment,
  useUpdateShipment,
} from '@/features/shipments/hooks/useShipments';
import { ApiClientError } from '@/lib/apiClient';

const FIELDS: { label: string; key: keyof Shipment }[] = [
  { label: 'Shipment ID', key: 'shipmentNo' },
  { label: 'Status', key: 'status' },
  { label: 'Airline', key: 'airlineName' },
  { label: 'Flight No', key: 'flightNo' },
  { label: 'MAWB No', key: 'mawbNo' },
  { label: 'House AWB', key: 'houseAwbNo' },
  { label: 'Destination', key: 'destinationAirportCode' },
  { label: 'Flight Date', key: 'flightDate' },
  { label: 'Dep Time', key: 'depTime' },
  { label: 'Handling Date', key: 'handlingDate' },
  { label: 'Shipper', key: 'shipperName' },
  { label: 'Consignee', key: 'consigneeName' },
  { label: 'Commodity', key: 'commodityName' },
  { label: 'CUSDEC No', key: 'cusdecNo' },
  { label: 'Box count', key: 'boxCount' },
  { label: 'Weight (kg)', key: 'weightKg' },
  { label: 'Actual Departure', key: 'actualDepartureAt' },
];

export function ShipmentViewPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const isEditing = searchParams.get('edit') === '1';

  const [isCancelling, setIsCancelling] = useState(false);
  const [showConflict, setShowConflict] = useState(false);

  const shipmentQuery = useShipment(id);
  const updateMutation = useUpdateShipment();
  const deleteMutation = useDeleteShipment();
  const requestCancellationMutation = useRequestCancellation();
  const completeMutation = useCompleteShipment();
  const recordActualDepartureMutation = useRecordActualDeparture();

  const shipment = shipmentQuery.data;

  if (shipmentQuery.isLoading || !shipment) {
    return <p className="text-muted-foreground text-sm">Loading…</p>;
  }

  const isCompleted = shipment.status === 'COMPLETED';

  const handleUpdate = (values: UpdateShipmentRequest) => {
    updateMutation.mutate(
      { id: shipment.id, input: values },
      {
        onSuccess: () => setSearchParams({}),
        onError: (error) => {
          if (error instanceof ApiClientError && error.status === 409) {
            setShowConflict(true);
          }
        },
      },
    );
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{shipment.shipmentNo}</h1>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            void navigate('/shipments');
          }}
        >
          Back to schedule
        </Button>
      </div>

      {isCompleted && <LockedBanner />}

      {isEditing && !isCompleted ? (
        <div className="border-border bg-card rounded-lg border p-6">
          <ShipmentForm
            shipment={shipment}
            onSubmit={(values) => handleUpdate(values as UpdateShipmentRequest)}
            onCancel={() => setSearchParams({})}
            isSubmitting={updateMutation.isPending}
            errorMessage={
              updateMutation.isError &&
              !(
                updateMutation.error instanceof ApiClientError &&
                updateMutation.error.status === 409
              )
                ? updateMutation.error instanceof ApiClientError
                  ? updateMutation.error.message
                  : 'Unable to save changes.'
                : undefined
            }
          />
        </div>
      ) : (
        <div className="border-border bg-card grid grid-cols-1 gap-4 rounded-lg border p-6 sm:grid-cols-3">
          {FIELDS.map((field) => (
            <div key={field.key}>
              <div className="text-muted-foreground text-xs">{field.label}</div>
              <div className="text-sm">{String(shipment[field.key] ?? '—')}</div>
            </div>
          ))}
        </div>
      )}

      {shipment.status === 'PENDING' && (
        <RequirePermission permission="cargo.boxweight.enter">
          <CargoSection shipment={shipment} />
        </RequirePermission>
      )}

      {shipment.status === 'PENDING' && (
        <RequirePermission permission="rate.buying.enter">
          <BuyingRateSection shipment={shipment} />
        </RequirePermission>
      )}

      {/* BR-67: the Cost Sheet lifecycle is independent of shipment status — not gated on PENDING. */}
      <RequirePermission permission="costsheet.view">
        <CostSheetSection shipmentId={shipment.id} />
      </RequirePermission>

      {/* Decision #11: invoice.view (Manager) and invoice.view.readonly (Director) are a genuine either/or. */}
      <RequirePermission permission={['invoice.view', 'invoice.view.readonly']}>
        <InvoiceSection shipmentId={shipment.id} />
      </RequirePermission>

      {/* CONTEXT.md §15: five document tabs, keyed to Shipment ID — not gated on PENDING. */}
      <RequirePermission permission={['documents.manage', 'documents.view.readonly']}>
        <DocumentsSection shipmentId={shipment.id} />
      </RequirePermission>

      <div className="flex flex-wrap gap-2">
        <RequirePermission permission="shipment.update">
          {!isCompleted && !isEditing && (
            <Button variant="outline" onClick={() => setSearchParams({ edit: '1' })}>
              Edit
            </Button>
          )}
        </RequirePermission>

        <RequirePermission permission="shipment.delete.own">
          {!isCompleted && (
            <Button
              variant="destructive"
              disabled={deleteMutation.isPending}
              onClick={() =>
                deleteMutation.mutate(shipment.id, {
                  onSuccess: () => {
                    void navigate('/shipments');
                  },
                })
              }
            >
              Delete
            </Button>
          )}
        </RequirePermission>

        <RequirePermission permission="shipment.cancellation.request">
          {shipment.status === 'PENDING' && (
            <Button variant="outline" onClick={() => setIsCancelling(true)}>
              Request cancellation
            </Button>
          )}
        </RequirePermission>

        <RequirePermission permission="shipment.completion.approve">
          {shipment.status === 'PENDING' && (
            <Button
              disabled={completeMutation.isPending}
              onClick={() => completeMutation.mutate(shipment.id)}
            >
              Mark completed
            </Button>
          )}
        </RequirePermission>

        {/* BR-50/OQ-11: immutable once set (423 on a second attempt), so hidden rather than merely disabled. */}
        <RequirePermission permission="shipment.actual_departure.record">
          {shipment.status !== 'CANCELLED' && shipment.actualDepartureAt === null && (
            <Button
              variant="outline"
              disabled={recordActualDepartureMutation.isPending}
              onClick={() => recordActualDepartureMutation.mutate(shipment.id)}
            >
              Record actual departure
            </Button>
          )}
        </RequirePermission>
      </div>

      {deleteMutation.isError && (
        <p className="text-destructive text-sm">
          {deleteMutation.error instanceof ApiClientError
            ? deleteMutation.error.message
            : 'Unable to delete this shipment.'}
        </p>
      )}

      {recordActualDepartureMutation.isError && (
        <p className="text-destructive text-sm">
          {recordActualDepartureMutation.error instanceof ApiClientError
            ? recordActualDepartureMutation.error.message
            : 'Unable to record the actual departure.'}
        </p>
      )}

      {isCancelling && (
        <CancellationRequestModal
          isSubmitting={requestCancellationMutation.isPending}
          errorMessage={
            requestCancellationMutation.isError
              ? requestCancellationMutation.error instanceof ApiClientError
                ? requestCancellationMutation.error.message
                : 'Unable to submit the cancellation request.'
              : undefined
          }
          onCancel={() => setIsCancelling(false)}
          onSubmit={(reason) =>
            requestCancellationMutation.mutate(
              { id: shipment.id, reason },
              { onSuccess: () => setIsCancelling(false) },
            )
          }
        />
      )}

      {showConflict && (
        <ConflictDialog
          onDismiss={() => setShowConflict(false)}
          onReload={() => {
            setShowConflict(false);
            void shipmentQuery.refetch();
          }}
        />
      )}
    </div>
  );
}
