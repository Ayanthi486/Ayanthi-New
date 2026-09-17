import { type ReactNode, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import type { Shipment, UpdateShipmentRequest } from '@hub-lanka/shared';
import { RequirePermission } from '@/app/RequirePermission';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { Button } from '@/components/ui/button';
import { DocumentsSection } from '@/features/documents/components/DocumentsSection';
import { BuyingRateSection } from '@/features/shipments/components/BuyingRateSection';
import { CargoValueCell } from '@/features/shipments/components/CargoValueCell';
import { ConflictDialog } from '@/features/shipments/components/ConflictDialog';
import { LockedBanner } from '@/features/shipments/components/LockedBanner';
import { SERVICE_TYPE_LABELS, ShipmentForm } from '@/features/shipments/components/ShipmentForm';
import {
  useDeleteShipment,
  useShipment,
  useUpdateShipment,
} from '@/features/shipments/hooks/useShipments';
import { ApiClientError } from '@/lib/apiClient';
import { displayFlight } from '@/lib/utils';

/** Once a shipment is past Pending/Confirmed, the general edit path locks (BR-10) — matches shipment.service.ts's ACTIVE_STATUSES. */
const ACTIVE_STATUSES: Shipment['status'][] = ['PENDING', 'CONFIRMED'];
/** Delete locks later than editing does — only once Departed or Payment Received (matches shipment.service.ts's DELETE_LOCKED_STATUSES). */
const DELETE_LOCKED_STATUSES: Shipment['status'][] = ['DEPARTED', 'PAYMENT_RECEIVED'];

/** Grouped for the fields card below — one flat 17-field grid read as a single wall of text; three labeled groups scan in the order a reader actually needs them (what this shipment is, when it flies, what/who it's carrying). */
const FIELD_GROUP_ORDER = ['Shipment', 'Flight', 'Cargo & Parties'] as const;

const FIELDS: {
  label: string;
  key: keyof Shipment;
  group: (typeof FIELD_GROUP_ORDER)[number];
  format?: (value: unknown) => string;
  // Only Box count/Weight need a live component (click-to-edit while
  // Pending, via the shared CargoDialog) rather than a plain formatted
  // string — see CargoValueCell.
  render?: (shipment: Shipment) => ReactNode;
}[] = [
  { label: 'Shipment ID', key: 'shipmentNo', group: 'Shipment' },
  { label: 'MAWB No', key: 'mawbNo', group: 'Shipment' },
  { label: 'House AWB', key: 'houseAwbNo', group: 'Shipment' },
  { label: 'CUSDEC No', key: 'cusdecNo', group: 'Shipment' },
  {
    label: 'Service Type',
    key: 'serviceType',
    group: 'Shipment',
    format: (value) => SERVICE_TYPE_LABELS[value as Shipment['serviceType']],
  },
  { label: 'Commodity', key: 'commodityName', group: 'Shipment' },
  {
    label: 'Box count',
    key: 'boxCount',
    group: 'Shipment',
    render: (shipment) => <CargoValueCell shipment={shipment} value={shipment.boxCount ?? '—'} field="boxCount" />,
  },
  {
    label: 'Weight (kg)',
    key: 'weightKg',
    group: 'Shipment',
    value: (shipment) => (shipment.weightKg ? Number(shipment.weightKg).toFixed(3) : '—'),
    render: (shipment) => <CargoValueCell shipment={shipment} value={shipment.weightKg ?? '—'} field="weightKg" />,
  },
  { label: 'Airline', key: 'airlineName', group: 'Flight' },
  { 
    label: 'Flight No', 
    key: 'flightNo', 
    group: 'Flight',
    render: (shipment) => displayFlight(shipment.airlineCode, shipment.flightNo)
  },
  { label: 'Flight Date', key: 'flightDate', group: 'Flight' },
  { label: 'Dep Time', key: 'depTime', group: 'Flight' },
  { label: 'Handling Date', key: 'handlingDate', group: 'Flight' },
  { label: 'Destination', key: 'destinationAirportCode', group: 'Flight' },
  {
    label: 'Actual Departure',
    key: 'actualDepartureAt',
    group: 'Flight',
    format: (value) => (value ? new Date(value as string).toLocaleString() : '—'),
  },
  { label: 'Shipper', key: 'shipperName', group: 'Cargo & Parties' },
  { label: 'Consignee', key: 'consigneeName', group: 'Cargo & Parties' },
  { label: 'Shipper Address', key: 'shipperAddress', group: 'Cargo & Parties' },
  { label: 'Consignee Address', key: 'consigneeAddress', group: 'Cargo & Parties' },
  { label: 'Shipper Contact', key: 'shipperContact', group: 'Cargo & Parties' },
  { label: 'Consignee Contact', key: 'consigneeContact', group: 'Cargo & Parties' },

];

export function ShipmentViewPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const isEditing = searchParams.get('edit') === '1';

  const [showConflict, setShowConflict] = useState(false);

  const shipmentQuery = useShipment(id);
  const updateMutation = useUpdateShipment();
  const deleteMutation = useDeleteShipment();

  const shipment = shipmentQuery.data;

  if (shipmentQuery.isLoading || !shipment) {
    return <p className="text-muted-foreground text-sm">Loading…</p>;
  }

  const isEditLocked = !ACTIVE_STATUSES.includes(shipment.status);
  const isDeleteLocked = DELETE_LOCKED_STATUSES.includes(shipment.status);

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
      {/* Header and Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight">{shipment.shipmentNo}</h1>
          <StatusBadge status={shipment.status} />
        </div>
        
        <div className="flex items-center gap-2">
          <RequirePermission permission="shipment.update">
            {!isEditLocked && !isEditing && (
              <Button variant="outline" size="sm" onClick={() => setSearchParams({ edit: '1' })}>
                Edit
              </Button>
            )}
          </RequirePermission>

          <RequirePermission permission="shipment.delete.own">
            {!isDeleteLocked && (
              <Button
                variant="destructive"
                size="sm"
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

          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              void navigate('/shipments');
            }}
          >
            Back to schedule
          </Button>
        </div>
      </div>

      {deleteMutation.isError && (
        <p className="text-destructive text-sm bg-destructive/10 p-3 rounded-md">
          {deleteMutation.error instanceof ApiClientError
            ? deleteMutation.error.message
            : 'Unable to delete this shipment.'}
        </p>
      )}

      {isEditLocked && <LockedBanner status={shipment.status} />}

      {/* Main Content */}
      {isEditing && !isEditLocked ? (
        <div className="border-border bg-card rounded-xl border p-6 shadow-sm">
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
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {FIELD_GROUP_ORDER.map((group) => (
            <div key={group} className="border-border bg-card flex flex-col rounded-xl border p-5 shadow-sm">
              <h3 className="text-brand-navy border-b border-border/50 pb-3 mb-4 text-xs font-bold tracking-wider uppercase">
                {group}
              </h3>
              <div className="grid grid-cols-2 gap-y-5 gap-x-4">
                {FIELDS.filter((field) => field.group === group).map((field) => {
                  return (
                    <div key={field.key}>
                      <div className="text-muted-foreground mb-1 text-[11px] font-medium tracking-wide uppercase">{field.label}</div>
                      <div className="text-foreground text-sm font-medium whitespace-pre-line leading-relaxed">
                        {field.render
                          ? field.render(shipment)
                          : field.format
                            ? field.format(shipment[field.key])
                            : String(shipment[field.key] ?? '—')}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Optional Sections */}
      {shipment.status === 'PENDING' && (
        <RequirePermission permission="rate.buying.enter">
          <BuyingRateSection shipment={shipment} />
        </RequirePermission>
      )}

      <RequirePermission
        permission={[
          'documents.manage',
          'documents.view.readonly',
          'costsheet.view',
          'invoice.view',
          'invoice.view.readonly',
        ]}
      >
        <DocumentsSection shipmentId={shipment.id} />
      </RequirePermission>

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
