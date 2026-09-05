import { zodResolver } from '@hookform/resolvers/zod';
import {
  createShipmentRequestSchema,
  updateShipmentRequestSchema,
  type CreateShipmentRequest,
  type Shipment,
  type UpdateShipmentRequest,
} from '@hub-lanka/shared';
import { forwardRef, type ReactNode, type SelectHTMLAttributes } from 'react';
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
  useCreateAirline,
  useCreateAirport,
  useCreateCommodity,
  useCreateConsignee,
  useCreateShipper,
  useShippers,
} from '@/features/masterdata/hooks/useMasterdata';
import { ApiClientError } from '@/lib/apiClient';
import { useAuthStore } from '@/lib/authStore';

type FormValues = CreateShipmentRequest & { version?: number };

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

/**
 * Add/Edit Shipment form (PRD §5.2). Two distinct layouts sharing one
 * `useForm`/schema pair:
 *
 * - Create: exactly the 8 fields required to put a shipment on the Daily
 *   Schedule (DEP TIME, MAWB NO, DEST, FLIGHT, DATE, SHIPPER, CONSIGNEE,
 *   COMMODITY) — every one of them mandatory. Shipment ID and Cut-off are
 *   system-generated/computed and never shown here. House AWB, Handling
 *   Date, CUSDEC No, BOX and WEIGHT are deliberately deferred to Edit /
 *   Cargo Handling ("later workflow", not initial creation) — still
 *   optional in the schema, still fully editable there.
 * - Edit: the full field set, unchanged — House AWB/Handling Date/CUSDEC No
 *   remain editable there, which is the "appropriate later workflow" for
 *   them, not a separate screen.
 *
 * Shipper, Consignee, Airline, Airport (Destination) and Commodity are all
 * searchable `MasterDataCombobox` fields on create (UX spec §2/§8) — one
 * reusable component, configured per entity, each wired to its already-
 * existing masterdata list + create endpoint/permission rather than
 * inventing new backend surface (Phase 3).
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

  const createShipperMutation = useCreateShipper();
  const createConsigneeMutation = useCreateConsignee();
  const createAirlineMutation = useCreateAirline();
  const createAirportMutation = useCreateAirport();
  const createCommodityMutation = useCreateCommodity();
  const hasPermission = useAuthStore((state) => state.hasPermission);

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
          flightDate: '',
          depTime: '',
        },
  });

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
                  {airline.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field id="flightNo" label="Flight No" error={errors.flightNo?.message}>
            <Input id="flightNo" {...register('flightNo')} />
          </Field>
          <Field id="mawbNo" label="MAWB No" error={errors.mawbNo?.message}>
            <Input id="mawbNo" {...register('mawbNo')} />
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
          <Field id="cusdecNo" label="CUSDEC No" error={errors.cusdecNo?.message}>
            <Input id="cusdecNo" {...register('cusdecNo')} />
          </Field>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field id="depTime" label="DEP TIME" required error={errors.depTime?.message}>
            <Input id="depTime" type="time" {...register('depTime')} />
          </Field>
          <Field id="mawbNo" label="MAWB NO" required error={errors.mawbNo?.message}>
            <Input id="mawbNo" {...register('mawbNo')} />
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
              canCreate={hasPermission('masterdata.manage')}
              isCreating={createAirportMutation.isPending}
              createError={mutationErrorMessage(createAirportMutation)}
              createFields={[
                { key: 'code', label: 'Code', required: true, placeholder: 'DXB' },
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

          {/* Airline isn't one of the eight named fields, but it's a required FK
              (createShipmentRequestSchema) with no separate slot in this
              layout — grouped under FLIGHT, next to the flight number, since
              that's how a flight is actually identified operationally. */}
          <fieldset className="m-0 flex flex-col gap-1.5 border-0 p-0">
            <legend className="mb-0.5 text-sm leading-none font-medium">
              FLIGHT <RequiredMark />
            </legend>
            <div className="grid grid-cols-2 gap-2">
              <div className="flex flex-col gap-1">
                <Label htmlFor="airlineId" className="text-muted-foreground text-xs font-normal">
                  Airline
                </Label>
                <MasterDataCombobox
                  inputId="airlineId"
                  entityLabel="Airline"
                  placeholder="Search or type airline…"
                  options={
                    airlinesQuery.data?.map((airline) => ({
                      id: airline.id,
                      name: airline.name,
                    })) ?? []
                  }
                  isLoading={airlinesQuery.isLoading}
                  value={watch('airlineId') ?? ''}
                  onChange={(id) =>
                    setValue('airlineId', id, { shouldValidate: true, shouldDirty: true })
                  }
                  ariaInvalid={Boolean(errors.airlineId)}
                  canCreate={hasPermission('masterdata.manage')}
                  isCreating={createAirlineMutation.isPending}
                  createError={mutationErrorMessage(createAirlineMutation)}
                  onCreate={async (input) => {
                    const created = await createAirlineMutation.mutateAsync({
                      name: input.name ?? '',
                    });
                    return { id: created.id, name: created.name };
                  }}
                />
              </div>
              <div className="flex flex-col gap-1">
                <Label htmlFor="flightNo" className="text-muted-foreground text-xs font-normal">
                  Flight No
                </Label>
                <Input id="flightNo" {...register('flightNo')} />
              </div>
            </div>
            {(errors.airlineId?.message ?? errors.flightNo?.message) && (
              <p className="text-destructive text-xs">
                {errors.airlineId?.message ?? errors.flightNo?.message}
              </p>
            )}
          </fieldset>

          <Field id="flightDate" label="DATE" required error={errors.flightDate?.message}>
            <Input id="flightDate" type="date" {...register('flightDate')} />
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
              canCreate={hasPermission('masterdata.manage')}
              isCreating={createShipperMutation.isPending}
              createError={mutationErrorMessage(createShipperMutation)}
              onCreate={async (input) => {
                const created = await createShipperMutation.mutateAsync({ name: input.name ?? '' });
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
              canCreate={hasPermission('masterdata.manage')}
              isCreating={createConsigneeMutation.isPending}
              createError={mutationErrorMessage(createConsigneeMutation)}
              onCreate={async (input) => {
                const created = await createConsigneeMutation.mutateAsync({
                  name: input.name ?? '',
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
              onCreate={async (input) => {
                const created = await createCommodityMutation.mutateAsync({
                  name: input.name ?? '',
                });
                return { id: created.id, name: created.name };
              }}
            />
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
