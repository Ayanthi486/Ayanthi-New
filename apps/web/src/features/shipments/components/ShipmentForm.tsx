import { zodResolver } from '@hookform/resolvers/zod';
import {
  createShipmentRequestSchema,
  updateShipmentRequestSchema,
  type CreateShipmentRequest,
  type ServiceType,
  type Shipment,
  type UpdateShipmentRequest,
} from '@hub-lanka/shared';
import {
  forwardRef,
  useState,
  type ChangeEvent,
  type ReactNode,
  type SelectHTMLAttributes,
} from 'react';
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
import { displayFlight, formatFlightNumber } from '@/lib/utils';

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

function mutationErrorMessage(mutation: {
  isError: boolean;
  error: unknown;
}): string | undefined {
  if (!mutation.isError) return undefined;

  return mutation.error instanceof ApiClientError
    ? mutation.error.message
    : 'Unable to create.';
}

/**
 * MAWB No is 11 digits, conventionally grouped and displayed as 3-4-4.
 * Example: 123 4567 8912
 */
function formatMawbNo(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11);

  return [digits.slice(0, 3), digits.slice(3, 7), digits.slice(7, 11)]
    .filter(Boolean)
    .join(' ');
}

/**
 * Add/Edit Shipment form.
 *
 * Create:
 * - MAWB NO
 * - DEST
 * - FLIGHT
 * - DATE
 * - SHIPPER
 * - CONSIGNEE
 * - COMMODITY
 * - SERVICE TYPE
 *
 * Edit:
 * - Full editable field set
 *
 * Flight:
 * - Existing flights are searchable.
 * - A new flight can be created from the combobox.
 * - Airline is selected from Airline Master Data.
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

  // Create form must not allow a past flight date.
  // Sri Lanka / Asia-Colombo is UTC+5:30.
  const todayDateString = (() => {
    const COLOMBO_OFFSET_MS = (5 * 60 + 30) * 60_000;

    return new Date(Date.now() + COLOMBO_OFFSET_MS)
      .toISOString()
      .slice(0, 10);
  })();

  // Flight record is selected by id for the combobox.
  // Shipment itself stores flightNo and depTime directly.
  const [selectedFlightId, setSelectedFlightId] = useState('');

  // Used for errors that are specific to creating a new flight.
  const [flightCreateError, setFlightCreateError] = useState<string>();

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    getValues,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(
      isEdit ? updateShipmentRequestSchema : createShipmentRequestSchema,
    ) as Resolver<FormValues>,

    defaultValues: shipment
      ? {
          mawbNo: shipment.mawbNo ?? undefined,
          houseAwbNo: shipment.houseAwbNo ?? undefined,
          airlineId: shipment.airlineId,
          flightNo: shipment.flightNo ?? undefined,
          destinationAirportId:
            shipment.destinationAirportId ?? undefined,
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
      : {
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

  const mawbNoField = register('mawbNo');

  const currentAirlineId = watch('airlineId');

  const handleMawbChange = (e: ChangeEvent<HTMLInputElement>) => {
    const formatted = formatMawbNo(e.target.value);

    e.target.value = formatted;
    void mawbNoField.onChange(e);

    const raw = formatted.replace(/\D/g, '');

    if (raw.length >= 3) {
      const prefix = raw.slice(0, 3);

      const airline = airlinesQuery.data?.find(
        (item) => item.awbPrefix === prefix,
      );

      if (airline) {
        if (getValues('airlineId') !== airline.id) {
          setValue('airlineId', airline.id, {
            shouldValidate: true,
            shouldDirty: true,
          });

          if (!isEdit) {
            setSelectedFlightId('');

            setValue('flightNo', '', {
              shouldValidate: true,
              shouldDirty: true,
            });

            setValue('depTime', '', {
              shouldValidate: true,
              shouldDirty: true,
            });
          }
        }
      }
    }
  };

  const submit = handleSubmit((values) => {
    onSubmit(values);
  });

  return (
    <form onSubmit={(e) => void submit(e)} className="flex flex-col gap-4">
      {isEdit && (
        <input
          type="hidden"
          {...register('version', { valueAsNumber: true })}
        />
      )}

      {isEdit ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field
            id="airlineId"
            label="Airline"
            required
            error={errors.airlineId?.message}
          >
            <Select id="airlineId" {...register('airlineId')}>
              <option value="">Select an airline…</option>

              {airlinesQuery.data?.map((airline) => (
                <option key={airline.id} value={airline.id}>
                  {airline.code} — {airline.name}
                </option>
              ))}
            </Select>
          </Field>

          <Field
            id="flightNo"
            label="Flight No"
            error={errors.flightNo?.message}
          >
            <Input id="flightNo" {...register('flightNo')} />
          </Field>

          <Field
            id="mawbNo"
            label="MAWB No"
            error={errors.mawbNo?.message}
          >
            <Input
              id="mawbNo"
              {...mawbNoField}
              inputMode="numeric"
              maxLength={13}
              placeholder="123 4567 8912"
              onChange={handleMawbChange}
            />
          </Field>

          <Field
            id="houseAwbNo"
            label="House AWB"
            error={errors.houseAwbNo?.message}
          >
            <Input
              id="houseAwbNo"
              {...register('houseAwbNo')}
            />
          </Field>

          <Field
            id="destinationAirportId"
            label="Destination"
            error={errors.destinationAirportId?.message}
          >
            <Select
              id="destinationAirportId"
              {...register('destinationAirportId')}
            >
              <option value="">Select a destination…</option>

              {airportsQuery.data?.map((airport) => (
                <option key={airport.id} value={airport.id}>
                  {airport.code} — {airport.name}
                </option>
              ))}
            </Select>
          </Field>

          <Field
            id="flightDate"
            label="Flight Date"
            required
            error={errors.flightDate?.message}
          >
            <Input
              id="flightDate"
              type="date"
              {...register('flightDate')}
            />
          </Field>

          <Field
            id="depTime"
            label="Dep Time (24h)"
            required
            error={errors.depTime?.message}
          >
            <Input
              id="depTime"
              type="time"
              {...register('depTime')}
            />
          </Field>

          <Field
            id="handlingDate"
            label="Handling Date"
            error={errors.handlingDate?.message}
          >
            <Input
              id="handlingDate"
              type="date"
              {...register('handlingDate')}
            />
          </Field>

          <Field
            id="shipperId"
            label="Shipper"
            required
            error={errors.shipperId?.message}
          >
            <Select id="shipperId" {...register('shipperId')}>
              <option value="">Select a shipper…</option>

              {shippersQuery.data?.map((shipper) => (
                <option key={shipper.id} value={shipper.id}>
                  {shipper.name}
                </option>
              ))}
            </Select>
          </Field>

          <Field
            id="consigneeId"
            label="Consignee"
            required
            error={errors.consigneeId?.message}
          >
            <Select id="consigneeId" {...register('consigneeId')}>
              <option value="">Select a consignee…</option>

              {consigneesQuery.data?.map((consignee) => (
                <option key={consignee.id} value={consignee.id}>
                  {consignee.name}
                </option>
              ))}
            </Select>
          </Field>

          <Field
            id="commodityId"
            label="Commodity"
            required
            error={errors.commodityId?.message}
          >
            <Select id="commodityId" {...register('commodityId')}>
              <option value="">Select a commodity…</option>

              {commoditiesQuery.data?.map((commodity) => (
                <option key={commodity.id} value={commodity.id}>
                  {commodity.name}
                </option>
              ))}
            </Select>
          </Field>

          <Field
            id="serviceType"
            label="Service Type"
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

          <Field
            id="cusdecNo"
            label="CUSDEC No"
            error={errors.cusdecNo?.message}
          >
            <Input
              id="cusdecNo"
              {...register('cusdecNo')}
            />
          </Field>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field
            id="mawbNo"
            label="MAWB NO"
            required
            error={errors.mawbNo?.message}
          >
            <Input
              id="mawbNo"
              {...mawbNoField}
              inputMode="numeric"
              maxLength={13}
              placeholder="123 4567 8912"
              onChange={handleMawbChange}
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
                setValue('destinationAirportId', id, {
                  shouldValidate: true,
                  shouldDirty: true,
                })
              }
              ariaInvalid={Boolean(errors.destinationAirportId)}
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
                  transform: (value) =>
                    value
                      .replace(/[^a-zA-Z]/g, '')
                      .slice(0, 3)
                      .toUpperCase(),
                },
                {
                  key: 'name',
                  label: 'Name',
                  required: true,
                  placeholder: 'Dubai',
                },
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

          <Field
            id="flight"
            label="FLIGHT"
            required
            error={
              errors.airlineId?.message ??
              errors.flightNo?.message
            }
          >
            <MasterDataCombobox
              inputId="flight"
              entityLabel="Flight"
              placeholder="e.g. EK 0654"
              inputTransform={formatFlightNumber}
              options={
                flightsQuery.data
                  ?.filter((flight) =>
                    currentAirlineId
                      ? flight.airlineId === currentAirlineId
                      : true,
                  )
                  .map((flight) => {
                    const airline = airlinesQuery.data?.find(
                      (a) => a.id === flight.airlineId,
                    );

                    return {
                      id: flight.id,
                      name: airline
                        ? displayFlight(
                            airline.code,
                            flight.flightNo,
                          )
                        : flight.flightNo,
                    };
                  }) ?? []
              }
              isLoading={
                flightsQuery.isLoading ||
                airlinesQuery.isLoading
              }
              value={selectedFlightId}
              onChange={(id) => {
                setSelectedFlightId(id);

                if (id === '') {
                  // Preserve airline derived from MAWB No where possible.
                  const mawbNo = getValues('mawbNo') || '';
                  const rawMawb = mawbNo.replace(/\D/g, '');

                  let lockedAirlineId = '';

                  if (rawMawb.length >= 3) {
                    const prefix = rawMawb.slice(0, 3);

                    const airline = airlinesQuery.data?.find(
                      (item) => item.awbPrefix === prefix,
                    );

                    if (airline) {
                      lockedAirlineId = airline.id;
                    }
                  }

                  setValue(
                    'airlineId',
                    lockedAirlineId,
                    {
                      shouldValidate: true,
                      shouldDirty: true,
                    },
                  );

                  setValue('flightNo', '', {
                    shouldValidate: true,
                    shouldDirty: true,
                  });

                  setValue('depTime', '', {
                    shouldValidate: true,
                    shouldDirty: true,
                  });

                  return;
                }

                const flight = flightsQuery.data?.find(
                  (item) => item.id === id,
                );

                if (!flight) return;

                setValue(
                  'airlineId',
                  flight.airlineId,
                  {
                    shouldValidate: true,
                    shouldDirty: true,
                  },
                );

                setValue(
                  'flightNo',
                  flight.flightNo,
                  {
                    shouldValidate: true,
                    shouldDirty: true,
                  },
                );

                setValue(
                  'depTime',
                  flight.depTime,
                  {
                    shouldValidate: true,
                    shouldDirty: true,
                  },
                );
              }}
              ariaInvalid={Boolean(
                errors.airlineId ?? errors.flightNo,
              )}
              canCreate={hasPermission(
                'masterdata.flight.create',
              )}
              isCreating={createFlightMutation.isPending}
              createError={
                mutationErrorMessage(createFlightMutation) ??
                flightCreateError
              }
              createFields={[
                {
                  key: 'airlineId',
                  label: 'Airline',
                  required: true,
                  type: 'select',
                  options:
                    airlinesQuery.data?.map((airline) => ({
                      value: airline.id,
                      label: `${airline.code} — ${airline.name}`,
                    })) ?? [],
                  value:
                    currentAirlineId || undefined,
                  readOnly:
                    Boolean(currentAirlineId),
                },
                {
                  key: 'name',
                  label: 'Flight Number',
                  required: true,
                  placeholder: 'e.g. 0654',
                  maxLength: 4,
                  transform: (value) =>
                    value
                      .replace(/\D/g, '')
                      .slice(0, 4),
                },
                {
                  key: 'depTime',
                  label: 'Departure Time',
                  required: true,
                  type: 'time',
                },
              ]}
              onCreate={async (input) => {
                setFlightCreateError(undefined);

                const airlineId = input.airlineId;
                const flightNo = input.name;

                if (!airlineId) {
                  const message =
                    'Airline is required';

                  setFlightCreateError(message);
                  throw new Error(message);
                }

                if (!flightNo) {
                  const message =
                    'Flight number is required';

                  setFlightCreateError(message);
                  throw new Error(message);
                }

                const airline =
                  airlinesQuery.data?.find(
                    (item) =>
                      item.id === airlineId,
                  );

                if (!airline) {
                  const message =
                    'Selected airline not found';

                  setFlightCreateError(message);
                  throw new Error(message);
                }

                const existingFlight =
                  flightsQuery.data?.find(
                    (flight) =>
                      flight.airlineId ===
                        airlineId &&
                      flight.flightNo ===
                        flightNo,
                  );

                if (existingFlight) {
                  setValue(
                    'airlineId',
                    airline.id,
                    {
                      shouldValidate: true,
                      shouldDirty: true,
                    },
                  );

                  setValue(
                    'flightNo',
                    existingFlight.flightNo,
                    {
                      shouldValidate: true,
                      shouldDirty: true,
                    },
                  );

                  setValue(
                    'depTime',
                    existingFlight.depTime,
                    {
                      shouldValidate: true,
                      shouldDirty: true,
                    },
                  );

                  return {
                    id: existingFlight.id,
                    name: displayFlight(
                      airline.code,
                      existingFlight.flightNo,
                    ),
                  };
                }

                const created =
                  await createFlightMutation.mutateAsync(
                    {
                      airlineCode: airline.code,
                      flightNo,
                      depTime:
                        input.depTime ?? '',
                    },
                  );

                setValue(
                  'airlineId',
                  airline.id,
                  {
                    shouldValidate: true,
                    shouldDirty: true,
                  },
                );

                setValue(
                  'flightNo',
                  created.flightNo,
                  {
                    shouldValidate: true,
                    shouldDirty: true,
                  },
                );

                setValue(
                  'depTime',
                  created.depTime,
                  {
                    shouldValidate: true,
                    shouldDirty: true,
                  },
                );

                return {
                  id: created.id,
                  name: displayFlight(
                    airline.code,
                    created.flightNo,
                  ),
                };
              }}
            />
          </Field>

          <Field
            id="flightDate"
            label="DATE"
            required
            error={errors.flightDate?.message}
          >
            <Input
              id="flightDate"
              type="date"
              min={todayDateString}
              {...register('flightDate')}
            />
          </Field>

          <Field
            id="shipperId"
            label="SHIPPER"
            required
            error={errors.shipperId?.message}
          >
            <MasterDataCombobox
              inputId="shipperId"
              entityLabel="Shipper"
              placeholder="Search or type shipper…"
              options={
                shippersQuery.data?.map((shipper) => ({
                  id: shipper.id,
                  name: shipper.name,
                })) ?? []
              }
              isLoading={shippersQuery.isLoading}
              value={watch('shipperId') ?? ''}
              onChange={(id) =>
                setValue('shipperId', id, {
                  shouldValidate: true,
                  shouldDirty: true,
                })
              }
              ariaInvalid={Boolean(errors.shipperId)}
              canCreate={hasPermission(
                'masterdata.shipper.create',
              )}
              isCreating={
                createShipperMutation.isPending
              }
              createError={mutationErrorMessage(
                createShipperMutation,
              )}
              createFields={[
                {
                  key: 'name',
                  label: 'Shipper Name',
                  required: true,
                },
                {
                  key: 'address',
                  label: 'Shipper Address',
                  type: 'textarea',
                  rows: 3,
                },
                {
                  key: 'contact',
                  label: 'Contact',
                },
              ]}
              onCreate={async (input) => {
                const created =
                  await createShipperMutation.mutateAsync(
                    {
                      name: input.name ?? '',
                      address:
                        input.address ||
                        undefined,
                      contact:
                        input.contact ||
                        undefined,
                    },
                  );

                return {
                  id: created.id,
                  name: created.name,
                };
              }}
            />
          </Field>

          <Field
            id="consigneeId"
            label="CONSIGNEE"
            required
            error={errors.consigneeId?.message}
          >
            <MasterDataCombobox
              inputId="consigneeId"
              entityLabel="Consignee"
              placeholder="Search or type consignee…"
              options={
                consigneesQuery.data?.map(
                  (consignee) => ({
                    id: consignee.id,
                    name: consignee.name,
                  }),
                ) ?? []
              }
              isLoading={
                consigneesQuery.isLoading
              }
              value={watch('consigneeId') ?? ''}
              onChange={(id) =>
                setValue('consigneeId', id, {
                  shouldValidate: true,
                  shouldDirty: true,
                })
              }
              ariaInvalid={Boolean(
                errors.consigneeId,
              )}
              canCreate={hasPermission(
                'masterdata.consignee.create',
              )}
              isCreating={
                createConsigneeMutation.isPending
              }
              createError={mutationErrorMessage(
                createConsigneeMutation,
              )}
              createFields={[
                {
                  key: 'name',
                  label: 'Consignee Name',
                  required: true,
                },
                {
                  key: 'address',
                  label: 'Consignee Address',
                  type: 'textarea',
                  rows: 3,
                },
                {
                  key: 'contact',
                  label: 'Contact',
                },
              ]}
              onCreate={async (input) => {
                const created =
                  await createConsigneeMutation.mutateAsync(
                    {
                      name: input.name ?? '',
                      address:
                        input.address ||
                        undefined,
                      contact:
                        input.contact ||
                        undefined,
                    },
                  );

                return {
                  id: created.id,
                  name: created.name,
                };
              }}
            />
          </Field>

          <Field
            id="commodityId"
            label="COMMODITY"
            required
            error={errors.commodityId?.message}
          >
            <MasterDataCombobox
              inputId="commodityId"
              entityLabel="Commodity"
              placeholder="Search or type commodity…"
              options={
                commoditiesQuery.data?.map(
                  (commodity) => ({
                    id: commodity.id,
                    name: commodity.name,
                  }),
                ) ?? []
              }
              isLoading={
                commoditiesQuery.isLoading
              }
              value={watch('commodityId') ?? ''}
              onChange={(id) =>
                setValue('commodityId', id, {
                  shouldValidate: true,
                  shouldDirty: true,
                })
              }
              ariaInvalid={Boolean(
                errors.commodityId,
              )}
              canCreate={hasPermission(
                'masterdata.commodity.create',
              )}
              isCreating={
                createCommodityMutation.isPending
              }
              createError={mutationErrorMessage(
                createCommodityMutation,
              )}
              createFields={[
                {
                  key: 'name',
                  label: 'Commodity Name',
                  required: true,
                },
                {
                  key: 'code',
                  label: 'Commodity Code',
                  required: true,
                  placeholder: 'e.g. 123456',
                  maxLength: 6,
                  transform: (value) =>
                    value
                      .replace(/\D/g, '')
                      .slice(0, 6),
                },
                {
                  key: 'delayHours',
                  label: 'Delay Hours',
                  required: true,
                  type: 'time',
                },
              ]}
              onCreate={async (input) => {
                const created =
                  await createCommodityMutation.mutateAsync(
                    {
                      name: input.name ?? '',
                      code: input.code ?? '',
                      delayHours:
                        input.delayHours ?? '',
                    },
                  );

                return {
                  id: created.id,
                  name: created.name,
                };
              }}
            />
          </Field>

          <Field
            id="serviceType"
            label="SERVICE TYPE"
            required
            error={errors.serviceType?.message}
          >
            <Select
              id="serviceType"
              {...register('serviceType')}
            >
              <option value="">
                Select a service type…
              </option>

              {SERVICE_TYPE_OPTIONS.map(
                (opt) => (
                  <option
                    key={opt.value}
                    value={opt.value}
                  >
                    {opt.label}
                  </option>
                ),
              )}
            </Select>
          </Field>
        </div>
      )}

      {errorMessage && (
        <p className="text-destructive text-sm">
          {errorMessage}
        </p>
      )}

      <div className="flex gap-2">
        <Button
          type="submit"
          disabled={isSubmitting}
        >
          {isSubmitting
            ? 'Saving…'
            : isEdit
              ? 'Save changes'
              : 'Create shipment'}
        </Button>

        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}

function RequiredMark() {
  return (
    <span
      className="text-destructive"
      aria-hidden="true"
    >
      *
    </span>
  );
}

function OptionalMark() {
  return (
    <span
      className="text-muted-foreground text-xs font-normal"
      aria-hidden="true"
    >
      (optional)
    </span>
  );
}

const Select = forwardRef<
  HTMLSelectElement,
  SelectHTMLAttributes<HTMLSelectElement>
>(function Select(props, ref) {
  return (
    <select
      ref={ref}
      className="border-input h-9 rounded-md border bg-transparent px-3 text-sm"
      {...props}
    />
  );
});

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
      <div className="flex items-center gap-2">
        <Label htmlFor={id}>
          {label}
        </Label>

        {required ? (
          <RequiredMark />
        ) : (
          <OptionalMark />
        )}
      </div>

      {children}

      {error && (
        <p className="text-destructive text-xs">
          {error}
        </p>
      )}
    </div>
  );
}
