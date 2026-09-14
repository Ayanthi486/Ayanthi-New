import { zodResolver } from '@hookform/resolvers/zod';
import {
  createShipmentRequestSchema,
  updateShipmentRequestSchema,
  type CreateShipmentRequest,
  type ServiceType,
  type Shipment,
  type UpdateShipmentRequest,
} from '@hub-lanka/shared';
import { forwardRef, useState, type ReactNode, type SelectHTMLAttributes } from 'react';
import { useForm, type Resolver } from 'react-hook-form';
import { MasterDataCombobox } from '@/components/shared/MasterDataCombobox';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  useAirlines,
  useAirports,
  useCommodities,
  useConsignees,
  useCreateAirport,
  useCreateCommodity,
  useCreateConsignee,
  useCreateFlight,
  useCreateShipper,
  useFlights,
  useShippers,
} from '@/features/masterdata/hooks/useMasterdata';
import { ApiClientError } from '@/lib/apiClient';
import { useAuthStore } from '@/lib/authStore';
import { formatFlightNumber, splitFlightNumber, displayFlight } from '@/lib/utils';

type FormValues = CreateShipmentRequest & { version?: number };

export const SERVICE_TYPE_OPTIONS: { value: ServiceType; label: string }[] = [
  { value: 'BOOKING_ONLY', label: 'Only Booking' },
  { value: 'HANDLING_ONLY', label: 'Only Handling' },
  { value: 'BOOKING_AND_HANDLING', label: 'Booking & Handling' },
];

export const SERVICE_TYPE_LABELS: Record<ServiceType, string> = Object.fromEntries(
  SERVICE_TYPE_OPTIONS.map((opt) => [opt.value, opt.label]),
) as Record<ServiceType, string>;

interface ShipmentFormProps {
  shipment?: Shipment;
  onSubmit: (values: CreateShipmentRequest | UpdateShipmentRequest) => void;
  onCancel: () => void;
  isSubmitting: boolean;
  errorMessage?: string;
}

function mutationErrorMessage(mutation: { isError: boolean; error: unknown }): string | undefined {
  if (!mutation.isError) return undefined;
  return mutation.error instanceof ApiClientError ? mutation.error.message : 'Unable to create.';
}

/** MAWB No is 11 digits, conventionally grouped and displayed as 3-4-4 (e.g. "123 4567 8912"). */
function formatMawbNo(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  return [digits.slice(0, 3), digits.slice(3, 7), digits.slice(7, 11)].filter(Boolean).join(' ');
}

/**
 * Add/Edit Shipment form (PRD §5.2). Two distinct layouts sharing one
 * `useForm`/schema pair:
 *
 * - Create: MAWB NO, DEST, FLIGHT (Airline + Flight No), DATE, SHIPPER,
 *   CONSIGNEE, COMMODITY, SERVICE TYPE (Only Booking/Only Handling/Booking
 *   & Handling) — every one of them mandatory. DEP TIME on the
 *   Shipment itself is still required (schema/DB unchanged), but it has no
 *   field of its own here — Flight.depTime is required at Flight creation
 *   (both here and in Master Data), so selecting/creating a Flight always
 *   fills the shipment's depTime automatically. Shipment ID and Cut-off
 *   are system-generated/computed and never shown here. House AWB, Handling
 *   Date, CUSDEC No, BOX and WEIGHT are deliberately deferred to Edit /
 *   Cargo Handling ("later workflow", not initial creation) — still
 *   optional in the schema, still fully editable there.
 * - Edit: the full field set, unchanged — House AWB/Handling Date/CUSDEC No
 *   remain editable there, which is the "appropriate later workflow" for
 *   them, not a separate screen. DEP TIME also remains a directly editable
 *   field here, since an edit may need to correct a specific shipment's
 *   time without touching the reusable Flight record.
 *
 * Shipper, Consignee, Airline, Flight, Airport (Destination) and Commodity
 * are all searchable `MasterDataCombobox` fields on create (UX spec §2/§8)
 * — one reusable component, configured per entity, each wired to its
 * already-existing masterdata list + create endpoint/permission rather than
 * inventing new backend surface (Phase 3). Flight No is stored on the
 * shipment as its own plain string (matching the Edit layout and the
 * `flightNo` schema field) — selecting/creating a Flight just fills in
 * `flightNo` and `depTime` together; there is no `flightId` on Shipment.
 */
export function ShipmentForm({
  shipment,
  onSubmit,
  onCancel,
  isSubmitting,
  errorMessage,
}: ShipmentFormProps) {
  const isEdit = Boolean(shipment);

  const shippersQuery = useShippers();
  const consigneesQuery = useConsignees();
  const airlinesQuery = useAirlines();
  const airportsQuery = useAirports();
  const commoditiesQuery = useCommodities();
  const flightsQuery = useFlights();

  const createShipperMutation = useCreateShipper();
  const createConsigneeMutation = useCreateConsignee();
  const createAirportMutation = useCreateAirport();
  const createCommodityMutation = useCreateCommodity();
  const createFlightMutation = useCreateFlight();
  const hasPermission = useAuthStore((state) => state.hasPermission);

  // BR: shipments can't be created for a date that's already passed — the
  // date picker floors at today in Asia/Colombo (BR-15's same fixed,
  // no-DST UTC+5:30 offset), matching the createShipmentRequestSchema
  // check that actually enforces this on submit, regardless of the
  // browser's own timezone.
  const todayDateString = (() => {
    const COLOMBO_OFFSET_MS = (5 * 60 + 30) * 60_000;
    return new Date(Date.now() + COLOMBO_OFFSET_MS).toISOString().slice(0, 10);
  })();

  // Flight is selected by its own id (for combobox highlighting/display),
  // but the shipment stores `flightNo`/`depTime` directly — there's no
  // `flightId` column on Shipment, so this id is tracked here, not in the
  // form's own values.
  const [selectedFlightId, setSelectedFlightId] = useState('');
  // Set when "Add New Flight" is submitted with a code that doesn't match
  // any existing Airline — surfaced next to the dialog's own fields, since
  // there's no dedicated Airline field on this form to attach the error to.
  const [flightCreateError, setFlightCreateError] = useState<string>();

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    // The create/update schemas differ (update adds a required `version`
    // and relaxes required fields), so their inferred types don't unify
    // into one Resolver<FormValues> — both are still validating the same
    // runtime `values` shape this component submits, so this cast is safe.
    resolver: zodResolver(
      isEdit ? updateShipmentRequestSchema : createShipmentRequestSchema,
    ) as Resolver<FormValues>,
    defaultValues: shipment
      ? {
          mawbNo: shipment.mawbNo ?? undefined,
          houseAwbNo: shipment.houseAwbNo ?? undefined,
          airlineId: shipment.airlineId,
          flightNo: shipment.flightNo ?? undefined,
          destinationAirportId: shipment.destinationAirportId ?? undefined,
          shipperId: shipment.shipperId,
          consigneeId: shipment.consigneeId,
          commodityId: shipment.commodityId,
          serviceType: shipment.serviceType,
          flightDate: shipment.flightDate,
          handlingDate: shipment.handlingDate ?? undefined,
          depTime: shipment.depTime,
          cusdecNo: shipment.cusdecNo ?? undefined,
          version: shipment.version,
        }
      : // Every required field starts as '' rather than absent — the
        // Airline/Destination/Shipper/Consignee/Commodity comboboxes are
        // never natively `register()`-ed (they're set via `setValue`), so
        // without this their key would be entirely missing from the form's
        // values until first touched, and Zod's `min(1, '…is required')`
        // message only fires on an empty *string*, not a missing key.
        {
          mawbNo: '',
          airlineId: '',
          flightNo: '',
          destinationAirportId: '',
          shipperId: '',
          consigneeId: '',
          commodityId: '',
          serviceType: '' as ServiceType,
          flightDate: '',
          handlingDate: new Date().toISOString().split('T')[0],
          depTime: '',
        },
  });

  // Bound once and reused by both layouts' MAWB No field so the
  // digits-only-with-spaces formatting (below) lives in one place.
  const mawbNoField = register('mawbNo');

  const submit = handleSubmit((values) => {
    onSubmit(values);
  });

  return (
    <form onSubmit={(e) => void submit(e)} className="flex flex-col gap-4">
      {isEdit && <input type="hidden" {...register('version', { valueAsNumber: true })} />}

      {isEdit ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field id="airlineId" label="Airline" required error={errors.airlineId?.message}>
            <Select id="airlineId" {...register('airlineId')}>
              <option value="">Select an airline…</option>
              {airlinesQuery.data?.map((airline) => (
                <option key={airline.id} value={airline.id}>
                  {airline.code} — {airline.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field id="flightNo" label="Flight No" error={errors.flightNo?.message}>
            <Input id="flightNo" {...register('flightNo')} />
          </Field>
          <Field id="mawbNo" label="MAWB No" error={errors.mawbNo?.message}>
            <Input
              id="mawbNo"
              {...mawbNoField}
              inputMode="numeric"
              maxLength={13}
              placeholder="123 4567 8912"
              onChange={(e) => {
                e.target.value = formatMawbNo(e.target.value);
                void mawbNoField.onChange(e);
              }}
            />
          </Field>
          <Field id="houseAwbNo" label="House AWB" error={errors.houseAwbNo?.message}>
            <Input id="houseAwbNo" {...register('houseAwbNo')} />
          </Field>
          <Field
            id="destinationAirportId"
            label="Destination"
            error={errors.destinationAirportId?.message}
          >
            <Select id="destinationAirportId" {...register('destinationAirportId')}>
              <option value="">Select a destination…</option>
              {airportsQuery.data?.map((airport) => (
                <option key={airport.id} value={airport.id}>
                  {airport.code} — {airport.name}
                </option>
              ))}
            </Select>
          </Field>
          {/* BR-16: calendar picker for DATE, 24-hour picker (no AM/PM) for DEP TIME. */}
          <Field id="flightDate" label="Flight Date" required error={errors.flightDate?.message}>
            <Input id="flightDate" type="date" {...register('flightDate')} />
          </Field>
          <Field id="depTime" label="Dep Time (24h)" required error={errors.depTime?.message}>
            <Input id="depTime" type="time" {...register('depTime')} />
          </Field>
          {/* BR-13: Handling Date is a separate field from Flight Date, never merged. */}
          <Field id="handlingDate" label="Handling Date" error={errors.handlingDate?.message}>
            <Input id="handlingDate" type="date" {...register('handlingDate')} />
          </Field>
          <Field id="shipperId" label="Shipper" required error={errors.shipperId?.message}>
            <Select id="shipperId" {...register('shipperId')}>
              <option value="">Select a shipper…</option>
              {shippersQuery.data?.map((shipper) => (
                <option key={shipper.id} value={shipper.id}>
                  {shipper.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field id="consigneeId" label="Consignee" required error={errors.consigneeId?.message}>
            <Select id="consigneeId" {...register('consigneeId')}>
              <option value="">Select a consignee…</option>
              {consigneesQuery.data?.map((consignee) => (
                <option key={consignee.id} value={consignee.id}>
                  {consignee.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field id="commodityId" label="Commodity" required error={errors.commodityId?.message}>
            <Select id="commodityId" {...register('commodityId')}>
              <option value="">Select a commodity…</option>
              {commoditiesQuery.data?.map((commodity) => (
                <option key={commodity.id} value={commodity.id}>
                  {commodity.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field id="serviceType" label="Service Type" required error={errors.serviceType?.message}>
            <Select id="serviceType" {...register('serviceType')}>
              <option value="">Select a service type…</option>
              {SERVICE_TYPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field id="cusdecNo" label="CUSDEC No" error={errors.cusdecNo?.message}>
            <Input id="cusdecNo" {...register('cusdecNo')} />
          </Field>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field id="mawbNo" label="MAWB NO" required error={errors.mawbNo?.message}>
            <Input
              id="mawbNo"
              {...mawbNoField}
              inputMode="numeric"
              maxLength={13}
              placeholder="123 4567 8912"
              onChange={(e) => {
                e.target.value = formatMawbNo(e.target.value);
                void mawbNoField.onChange(e);
              }}
            />
          </Field>

          <Field
            id="destinationAirportId"
            label="DEST"
            required
            error={errors.destinationAirportId?.message}
          >
            <MasterDataCombobox
              inputId="destinationAirportId"
              entityLabel="Destination"
              placeholder="Search or type destination…"
              options={
                airportsQuery.data?.map((airport) => ({
                  id: airport.id,
                  name: `${airport.code} — ${airport.name}`,
                  matchName: airport.name,
                })) ?? []
              }
              isLoading={airportsQuery.isLoading}
              value={watch('destinationAirportId') ?? ''}
              onChange={(id) =>
                setValue('destinationAirportId', id, { shouldValidate: true, shouldDirty: true })
              }
              ariaInvalid={Boolean(errors.destinationAirportId)}
              // Broader than masterdata.manage — Executive and Manager may
              // both add destinations (mirrors BR-17's commodity exception).
              canCreate={hasPermission('masterdata.airport.create')}
              isCreating={createAirportMutation.isPending}
              createError={mutationErrorMessage(createAirportMutation)}
              createFields={[
                {
                  key: 'code',
                  label: 'Code',
                  required: true,
                  placeholder: 'DXB',
                  maxLength: 3,
                  transform: (value) => value.replace(/[^a-zA-Z]/g, '').slice(0, 3).toUpperCase(),
                },
                { key: 'name', label: 'Name', required: true, placeholder: 'Dubai' },
              ]}
              onCreate={async (input) => {
                const created = await createAirportMutation.mutateAsync({
                  code: input.code ?? '',
                  name: input.name ?? '',
                });
                return {
                  id: created.id,
                  name: `${created.code} — ${created.name}`,
                  matchName: created.name,
                };
              }}
            />
          </Field>

          {/* Airline isn't one of the eight named fields, but it's a required
              FK (createShipmentRequestSchema) with no separate slot in this
              layout — captured together with the flight number as a single
              "EK 0654"-style FLIGHT field, since that's how a flight is
              actually identified operationally. Selecting/creating a Flight
              still fills in airlineId, flightNo and depTime together. */}
          <Field
            id="flight"
            label="FLIGHT"
            required
            error={errors.airlineId?.message ?? errors.flightNo?.message}
          >
            <MasterDataCombobox
              inputId="flight"
              entityLabel="Flight"
              placeholder="e.g. EK 0654"
              inputTransform={formatFlightNumber}
              options={
                flightsQuery.data?.map((flight) => {
                  const airline = airlinesQuery.data?.find((a) => a.id === flight.airlineId);
                  return {
                    id: flight.id,
                    name: airline ? displayFlight(airline.code, flight.flightNo) : flight.flightNo,
                  };
                }) ?? []
              }
              isLoading={flightsQuery.isLoading || airlinesQuery.isLoading}
              value={selectedFlightId}
              onChange={(id) => {
                setSelectedFlightId(id);
                if (id === '') {
                  setValue('airlineId', '', { shouldValidate: true, shouldDirty: true });
                  setValue('flightNo', '', { shouldValidate: true, shouldDirty: true });
                  setValue('depTime', '', { shouldValidate: true, shouldDirty: true });
                  return;
                }
                // MasterDataCombobox also calls this itself right after a
                // successful create (auto-selecting the new record) —
                // `flightsQuery.data` hasn't refetched by then, so the
                // lookup below misses. That's fine: `onCreate` (below)
                // already set airlineId/flightNo/depTime from the create
                // response, so there's nothing to overwrite them with.
                const flight = flightsQuery.data?.find((f) => f.id === id);
                if (!flight) return;
                setValue('airlineId', flight.airlineId, { shouldValidate: true, shouldDirty: true });
                setValue('flightNo', flight.flightNo, { shouldValidate: true, shouldDirty: true });
                setValue('depTime', flight.depTime, { shouldValidate: true, shouldDirty: true });
              }}
              ariaInvalid={Boolean(errors.airlineId ?? errors.flightNo)}
              // Broader than masterdata.manage — Executive and Manager may
              // both add flights.
              canCreate={hasPermission('masterdata.flight.create')}
              isCreating={createFlightMutation.isPending}
              createError={mutationErrorMessage(createFlightMutation) ?? flightCreateError}
              createFields={[
                // key 'name' (not 'flightNo') deliberately — it's what plugs
                // this field into the dialog's existing
                // prefill-from-search-query and duplicate-detection behaviour.
                {
                  key: 'name',
                  label: 'Flight Number',
                  required: true,
                  placeholder: 'EK 0654',
                  transform: formatFlightNumber,
                },
                { key: 'depTime', label: 'Departure Time', required: true, type: 'time' },
              ]}
              onCreate={async (input) => {
                setFlightCreateError(undefined);
                const { code, flightNo } = splitFlightNumber(input.name ?? '');
                const airline = airlinesQuery.data?.find((a) => a.code === code);
                if (!airline) {
                  setFlightCreateError(
                    `No airline found with code "${code}". Add it in Master Data first.`,
                  );
                  throw new Error('Unknown airline code');
                }
                const created = await createFlightMutation.mutateAsync({
                  airlineId: airline.id,
                  flightNo,
                  depTime: input.depTime ?? '',
                });
                setValue('airlineId', airline.id, { shouldValidate: true, shouldDirty: true });
                setValue('flightNo', created.flightNo, { shouldValidate: true, shouldDirty: true });
                setValue('depTime', created.depTime, { shouldValidate: true, shouldDirty: true });
                return { id: created.id, name: displayFlight(airline.code, created.flightNo) };
              }}
            />
          </Field>

          <Field id="flightDate" label="DATE" required error={errors.flightDate?.message}>
            <Input id="flightDate" type="date" min={todayDateString} {...register('flightDate')} />
          </Field>
          <Field id="shipperId" label="SHIPPER" required error={errors.shipperId?.message}>
            <MasterDataCombobox
              inputId="shipperId"
              entityLabel="Shipper"
              placeholder="Search or type shipper…"
              options={
                shippersQuery.data?.map((shipper) => ({ id: shipper.id, name: shipper.name })) ?? []
              }
              isLoading={shippersQuery.isLoading}
              value={watch('shipperId') ?? ''}
              onChange={(id) =>
                setValue('shipperId', id, { shouldValidate: true, shouldDirty: true })
              }
              ariaInvalid={Boolean(errors.shipperId)}
              // Broader than masterdata.manage — Executive and Manager may
              // both add shippers.
              canCreate={hasPermission('masterdata.shipper.create')}
              isCreating={createShipperMutation.isPending}
              createError={mutationErrorMessage(createShipperMutation)}
              createFields={[
                { key: 'name', label: 'Shipper Name', required: true },
                { key: 'address', label: 'Shipper Address', type: 'textarea', rows: 3 },
                { key: 'contact', label: 'Contact' },
              ]}
              onCreate={async (input) => {
                const created = await createShipperMutation.mutateAsync({
                  name: input.name ?? '',
                  address: input.address || undefined,
                  contact: input.contact || undefined,
                });
                return { id: created.id, name: created.name };
              }}
            />
          </Field>

          <Field id="consigneeId" label="CONSIGNEE" required error={errors.consigneeId?.message}>
            <MasterDataCombobox
              inputId="consigneeId"
              entityLabel="Consignee"
              placeholder="Search or type consignee…"
              options={
                consigneesQuery.data?.map((consignee) => ({
                  id: consignee.id,
                  name: consignee.name,
                })) ?? []
              }
              isLoading={consigneesQuery.isLoading}
              value={watch('consigneeId') ?? ''}
              onChange={(id) =>
                setValue('consigneeId', id, { shouldValidate: true, shouldDirty: true })
              }
              ariaInvalid={Boolean(errors.consigneeId)}
              // Broader than masterdata.manage — Executive and Manager may
              // both add consignees.
              canCreate={hasPermission('masterdata.consignee.create')}
              isCreating={createConsigneeMutation.isPending}
              createError={mutationErrorMessage(createConsigneeMutation)}
              createFields={[
                { key: 'name', label: 'Consignee Name', required: true },
                { key: 'address', label: 'Consignee Address', type: 'textarea', rows: 3 },
                { key: 'contact', label: 'Contact' },
              ]}
              onCreate={async (input) => {
                const created = await createConsigneeMutation.mutateAsync({
                  name: input.name ?? '',
                  address: input.address || undefined,
                  contact: input.contact || undefined,
                });
                return { id: created.id, name: created.name };
              }}
            />
          </Field>
          <Field id="commodityId" label="COMMODITY" required error={errors.commodityId?.message}>
            <MasterDataCombobox
              inputId="commodityId"
              entityLabel="Commodity"
              placeholder="Search or type commodity…"
              options={
                commoditiesQuery.data?.map((commodity) => ({
                  id: commodity.id,
                  name: commodity.name,
                })) ?? []
              }
              isLoading={commoditiesQuery.isLoading}
              value={watch('commodityId') ?? ''}
              onChange={(id) =>
                setValue('commodityId', id, { shouldValidate: true, shouldDirty: true })
              }
              ariaInvalid={Boolean(errors.commodityId)}
              // BR-17: Executive and Manager may both add commodities — a
              // broader grant than masterdata.manage (Manager only).
              canCreate={hasPermission('masterdata.commodity.create')}
              isCreating={createCommodityMutation.isPending}
              createError={mutationErrorMessage(createCommodityMutation)}
              createFields={[
                { key: 'name', label: 'Commodity Name', required: true },
                {
                  key: 'code',
                  label: 'Commodity Code',
                  required: true,
                  placeholder: 'e.g. 123456',
                  maxLength: 6,
                  transform: (value) => value.replace(/\D/g, '').slice(0, 6),
                },
                { key: 'delayHours', label: 'Delay Hours', required: true, type: 'time' },
              ]}
              onCreate={async (input) => {
                const created = await createCommodityMutation.mutateAsync({
                  name: input.name ?? '',
                  code: input.code ?? '',
                  delayHours: input.delayHours ?? '',
                });
                return { id: created.id, name: created.name };
              }}
            />
          </Field>
          <Field
            id="serviceType"
            label="SERVICE TYPE"
            required
            error={errors.serviceType?.message}
          >
            <Select id="serviceType" {...register('serviceType')}>
              <option value="">Select a service type…</option>
              {SERVICE_TYPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      )}

      {errorMessage && <p className="text-destructive text-sm">{errorMessage}</p>}

      <div className="flex gap-2">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Saving…' : isEdit ? 'Save changes' : 'Create shipment'}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

function RequiredMark() {
  return (
    <span className="text-destructive" aria-hidden="true">
      *
    </span>
  );
}

function OptionalMark() {
  return (
    <span className="text-muted-foreground text-xs font-normal" aria-hidden="true">
      (optional)
    </span>
  );
}

// forwardRef so react-hook-form's `register()` ref lands on the real
// <select> element (needed for focus-on-error and RHF's internal tracking).
const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  function Select(props, ref) {
    return (
      <select
        ref={ref}
        className="border-input h-9 rounded-md border bg-transparent px-3 text-sm"
        {...props}
      />
    );
  },
);

function Field({
  id,
  label,
  required,
  error,
  children,
}: {
  id: string;
  label: string;
  required?: boolean;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      {/* The marker is a sibling, not a child, of <Label> — inside it, its
          text would become part of the label's accessible name/text, which
          breaks `getByLabelText('SHIPPER')`-style exact matches (and, for a
          screen reader, would read as "Shipper (optional)" every time). */}
      <div className="flex items-center gap-2">
        <Label htmlFor={id}>{label}</Label>
        {required ? <RequiredMark /> : <OptionalMark />}
      </div>
      {children}
      {error && <p className="text-destructive text-xs">{error}</p>}
    </div>
  );
}
