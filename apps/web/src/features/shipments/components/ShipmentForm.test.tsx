import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CreateShipmentRequest, Shipment, UpdateShipmentRequest } from '@hub-lanka/shared';
import { ShipmentForm } from './ShipmentForm';
import { useAuthStore } from '@/lib/authStore';

function jsonResponse(status: number, body: unknown) {
  return { ok: status < 400, status, json: () => Promise.resolve(body) };
}

// Create-flow flightDate must always be "today or later" (the form now
// rejects past dates), so this is computed rather than hardcoded.
const FUTURE_FLIGHT_DATE = (() => {
  const d = new Date();
  d.setDate(d.getDate() + 30);
  return d.toISOString().slice(0, 10);
})();

const airlines = [
  { id: 'airline-1', code: 'EK', name: 'Emirates', isActive: true, createdAt: '', updatedAt: '' },
];
const flights = [
  {
    id: 'flight-1',
    airlineId: 'airline-1',
    airlineName: 'Emirates',
    flightNo: '0435',
    depTime: '13:45',
    isActive: true,
    createdAt: '',
    updatedAt: '',
  },
];
const shippers = [
  {
    id: 'shipper-1',
    name: 'Acme Exports',
    address: null,
    isActive: true,
    createdAt: '',
    updatedAt: '',
  },
];
const consignees = [
  {
    id: 'consignee-1',
    name: 'Acme Imports',
    address: null,
    isActive: true,
    createdAt: '',
    updatedAt: '',
  },
];
const commodities = [
  {
    id: 'commodity-1',
    name: 'Edible Fish',
    code: '100200',
    delayHours: '02:00',
    isActive: true,
    createdByUserId: '',
    createdAt: '',
    updatedAt: '',
  },
];
const airports = [
  { id: 'airport-1', code: 'DXB', name: 'Dubai', isActive: true, createdAt: '', updatedAt: '' },
];

const editShipment: Shipment = {
  id: 'ship-1',
  shipmentNo: 'HUB 000001',
  mawbNo: '176 2853 0191',
  houseAwbNo: 'HL 0106',
  airlineId: 'airline-1',
  airlineCode: 'EK',
  airlineName: 'Emirates',
  flightNo: 'EK 0654',
  destinationAirportId: 'airport-1',
  destinationAirportCode: 'DXB',
  shipperId: 'shipper-1',
  shipperName: 'Acme Exports',
  shipperAddress: null,
  shipperContact: null,
  consigneeId: 'consignee-1',
  consigneeName: 'Acme Imports',
  consigneeAddress: null,
  consigneeContact: null,
  commodityId: 'commodity-1',
  commodityName: 'Edible Fish',
  serviceType: 'BOOKING_AND_HANDLING',
  flightDate: '2026-06-15',
  handlingDate: '2026-06-14',
  depTime: '03:05',
  cutoffTime: '22:05',
  cusdecNo: 'CUS-12345',
  boxCount: 10,
  weightKg: '444.500',
  appliedBuyingRate: null,
  appliedBuyingRateId: null,
  actualDepartureAt: null,
  status: 'PENDING',
  version: 0,
  createdByUserId: 'user-1',
  createdAt: '2026-06-01T00:00:00.000Z',
  updatedAt: '2026-06-02T00:00:00.000Z',
};

const createdPosts: { url: string; body: Record<string, string> }[] = [];
let nextCreatedId = 100;

function setupFetchMock() {
  createdPosts.length = 0;
  nextCreatedId = 100;
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string, init?: RequestInit) => {
      if (init?.method === 'POST' && url.includes('/masterdata/')) {
        const body = JSON.parse(init.body as string) as Record<string, string>;
        createdPosts.push({ url, body });
        const id = `created-${nextCreatedId++}`;
        return Promise.resolve(jsonResponse(201, { id, ...body, isActive: true }));
      }
      if (url.includes('/masterdata/airlines')) return Promise.resolve(jsonResponse(200, airlines));
      if (url.includes('/masterdata/shippers')) return Promise.resolve(jsonResponse(200, shippers));
      if (url.includes('/masterdata/consignees'))
        return Promise.resolve(jsonResponse(200, consignees));
      if (url.includes('/masterdata/commodities'))
        return Promise.resolve(jsonResponse(200, commodities));
      if (url.includes('/masterdata/airports')) return Promise.resolve(jsonResponse(200, airports));
      if (url.includes('/masterdata/flights')) return Promise.resolve(jsonResponse(200, flights));
      return Promise.resolve(jsonResponse(200, {}));
    }),
  );
}

const BROADER_CREATE_PERMISSIONS = [
  'masterdata.commodity.create',
  'masterdata.airport.create',
  'masterdata.airline.create',
  'masterdata.flight.create',
  'masterdata.shipper.create',
  'masterdata.consignee.create',
] as const;

/** Manager holds masterdata.manage (deactivate) + every broader create grant. */
function setManagerPermissions() {
  useAuthStore.setState({
    user: {
      id: 'u1',
      email: 'manager@hublanka.dev',
      fullName: 'Test Manager',
      roles: ['Manager'],
      permissions: ['masterdata.manage', ...BROADER_CREATE_PERMISSIONS],
      hasAvatar: false,
      idCardNo: null,
    },
    permissions: new Set(['masterdata.manage', ...BROADER_CREATE_PERMISSIONS]),
    accessToken: 'token',
    isLoading: false,
  });
}

/** Executive holds every broader create grant, but NOT masterdata.manage. */
function setExecutivePermissions() {
  useAuthStore.setState({
    user: {
      id: 'u2',
      email: 'exec@hublanka.dev',
      fullName: 'Test Executive',
      roles: ['Executive'],
      permissions: [...BROADER_CREATE_PERMISSIONS],
      hasAvatar: false,
      idCardNo: null,
    },
    permissions: new Set(BROADER_CREATE_PERMISSIONS),
    accessToken: 'token',
    isLoading: false,
  });
}

function renderForm(props: Partial<Parameters<typeof ShipmentForm>[0]> = {}) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const onSubmit = vi.fn<(values: CreateShipmentRequest | UpdateShipmentRequest) => void>();
  render(
    <QueryClientProvider client={queryClient}>
      <ShipmentForm onSubmit={onSubmit} onCancel={() => {}} isSubmitting={false} {...props} />
    </QueryClientProvider>,
  );
  return { onSubmit };
}

/** Opens the combobox, types `query`, clicks the matching option. */
async function selectFromCombobox(labelText: string, query: string, optionName: RegExp) {
  const input = screen.getByLabelText(labelText);
  fireEvent.focus(input);
  fireEvent.change(input, { target: { value: query } });
  const option = await screen.findByRole('option', { name: optionName });
  fireEvent.click(option);
}

const FIELD_STEPS: { key: string; label: string; run: () => void | Promise<void> }[] = [
  {
    key: 'mawbNo',
    label: 'MAWB NO',
    run: () => {
      // Digits only — the field auto-formats as 3-4-4 with spaces.
      fireEvent.change(screen.getByLabelText('MAWB NO'), { target: { value: '17600018912' } });
    },
  },
  {
    key: 'destinationAirportId',
    label: 'DEST',
    run: () => selectFromCombobox('DEST', 'Dubai', /DXB — Dubai/),
  },
  {
    key: 'flight',
    label: 'FLIGHT',
    run: () => selectFromCombobox('FLIGHT', 'EK 0435', /EK 0435/),
  },
  {
    key: 'flightDate',
    label: 'DATE',
    run: () => {
      fireEvent.change(screen.getByLabelText('DATE'), { target: { value: FUTURE_FLIGHT_DATE } });
    },
  },
  {
    key: 'shipperId',
    label: 'SHIPPER',
    run: () => selectFromCombobox('SHIPPER', 'Acme Exports', /Acme Exports/),
  },
  {
    key: 'consigneeId',
    label: 'CONSIGNEE',
    run: () => selectFromCombobox('CONSIGNEE', 'Acme Imports', /Acme Imports/),
  },
  {
    key: 'commodityId',
    label: 'COMMODITY',
    run: () => selectFromCombobox('COMMODITY', 'Edible Fish', /Edible Fish/),
  },
  {
    key: 'serviceType',
    label: 'SERVICE TYPE',
    run: () => {
      fireEvent.change(screen.getByLabelText('SERVICE TYPE'), {
        target: { value: 'BOOKING_AND_HANDLING' },
      });
    },
  },
];

async function fillAllExcept(skipKey?: string) {
  for (const step of FIELD_STEPS) {
    if (step.key === skipKey) continue;
    await step.run();
  }
}

describe('ShipmentForm', () => {
  beforeEach(() => {
    setupFetchMock();
    setManagerPermissions();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    useAuthStore.setState({
      user: null,
      permissions: new Set(),
      accessToken: null,
      isLoading: false,
    });
  });

  describe('create (simplified, all fields required)', () => {
    it('shows exactly the required fields — nothing from later workflows, no Shipment ID or Cut-off, and no direct Dep Time input', () => {
      renderForm();

      // Dep Time comes from the selected/added Flight now (the "flight
      // adding feature"), not a direct field on this form.
      expect(screen.queryByLabelText('DEP TIME')).not.toBeInTheDocument();
      expect(screen.getByLabelText('MAWB NO')).toBeInTheDocument();
      expect(screen.getByLabelText('DEST')).toBeInTheDocument();
      expect(screen.getByLabelText('FLIGHT')).toBeInTheDocument();
      expect(screen.getByLabelText('DATE')).toBeInTheDocument();
      expect(screen.getByLabelText('SHIPPER')).toBeInTheDocument();
      expect(screen.getByLabelText('CONSIGNEE')).toBeInTheDocument();
      expect(screen.getByLabelText('COMMODITY')).toBeInTheDocument();
      expect(screen.getByLabelText('SERVICE TYPE')).toBeInTheDocument();

      // Not shown on the initial form at all (system-generated/computed).
      expect(screen.queryByText('Shipment ID')).not.toBeInTheDocument();
      expect(screen.queryByText('CUT-OFF')).not.toBeInTheDocument();
      // Deferred to later workflows (Edit / Cargo Handling).
      expect(screen.queryByLabelText('House AWB')).not.toBeInTheDocument();
      expect(screen.queryByLabelText('Handling Date')).not.toBeInTheDocument();
      expect(screen.queryByLabelText('CUSDEC No')).not.toBeInTheDocument();
      expect(screen.queryByLabelText(/box/i)).not.toBeInTheDocument();
      expect(screen.queryByLabelText(/weight/i)).not.toBeInTheDocument();

      // None of the nine are marked optional.
      expect(screen.queryByText('(optional)')).not.toBeInTheDocument();
    });

    it('auto-formats MAWB No as 3-4-4 digit groups and strips non-digit input', () => {
      renderForm();
      const input = screen.getByLabelText('MAWB NO');

      fireEvent.change(input, { target: { value: '176' } });
      expect(input).toHaveValue('176');

      fireEvent.change(input, { target: { value: '1762853' } });
      expect(input).toHaveValue('176 2853');

      fireEvent.change(input, { target: { value: '17628530191' } });
      expect(input).toHaveValue('176 2853 0191');

      // Letters/hyphens are stripped, and input beyond 11 digits is truncated.
      fireEvent.change(input, { target: { value: '176-2853-0191-999' } });
      expect(input).toHaveValue('176 2853 0191');
    });

    it.each(FIELD_STEPS.map((s) => [s.key, s.label] as const))(
      'blocks Create Shipment when %s (%s) is missing',
      async (skipKey) => {
        const { onSubmit } = renderForm();
        await fillAllExcept(skipKey);

        fireEvent.click(screen.getByRole('button', { name: 'Create shipment' }));

        await waitFor(() => expect(onSubmit).not.toHaveBeenCalled());
      },
    );

    it('submits with every field filled via search-and-select', async () => {
      const { onSubmit } = renderForm();
      await fillAllExcept();

      fireEvent.click(screen.getByRole('button', { name: 'Create shipment' }));

      await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
      expect(onSubmit.mock.calls[0]?.[0]).toMatchObject({
        // Populated automatically from the selected Flight, not typed directly.
        depTime: '13:45',
        mawbNo: '176 0001 8912',
        destinationAirportId: 'airport-1',
        airlineId: 'airline-1',
        flightNo: '0435',
        flightDate: FUTURE_FLIGHT_DATE,
        shipperId: 'shipper-1',
        consigneeId: 'consignee-1',
        commodityId: 'commodity-1',
      });
    });

    it('filters options by typing (search)', async () => {
      renderForm();
      const input = screen.getByLabelText('SHIPPER');
      fireEvent.focus(input);
      fireEvent.change(input, { target: { value: 'zzz-no-such-shipper' } });

      await waitFor(() => expect(screen.getByText('No Shipper found')).toBeInTheDocument());
      expect(screen.queryByRole('option', { name: /Acme Exports/ })).not.toBeInTheDocument();
    });

    it('shows a clear button once a value is selected, and clearing empties the field', async () => {
      renderForm();
      await selectFromCombobox('SHIPPER', 'Acme', /Acme Exports/);
      expect(screen.getByLabelText('SHIPPER')).toHaveValue('Acme Exports');

      fireEvent.click(screen.getByRole('button', { name: 'Clear Shipper' }));
      expect(screen.getByLabelText('SHIPPER')).toHaveValue('');
    });

    it('creates a new Shipper inline when there is no match, auto-selects it, and preserves other field values', async () => {
      const { onSubmit } = renderForm();
      // Fill something else first, to prove it survives the create round-trip.
      fireEvent.change(screen.getByLabelText('MAWB NO'), { target: { value: '99988877766' } });

      const input = screen.getByLabelText('SHIPPER');
      fireEvent.focus(input);
      fireEvent.change(input, { target: { value: 'Brand New Shipper' } });
      await waitFor(() => expect(screen.getByText('No Shipper found')).toBeInTheDocument());
      fireEvent.click(screen.getByRole('button', { name: 'Add New Shipper' }));

      const dialog = await screen.findByRole('dialog');
      expect(within(dialog).getByLabelText('Shipper Name')).toHaveValue('Brand New Shipper');
      fireEvent.click(within(dialog).getByRole('button', { name: 'Create' }));

      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
      expect(screen.getByLabelText('SHIPPER')).toHaveValue('Brand New Shipper');
      expect(
        createdPosts.some(
          (p) => p.url.includes('/masterdata/shippers') && p.body.name === 'Brand New Shipper',
        ),
      ).toBe(true);
      // The MAWB NO value entered before the detour is still there.
      expect(screen.getByLabelText('MAWB NO')).toHaveValue('999 8887 7766');

      await fillAllExcept('shipperId');
      fireEvent.click(screen.getByRole('button', { name: 'Create shipment' }));
      await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
      expect(onSubmit.mock.calls[0]?.[0]).toMatchObject({ shipperId: 'created-100' });
    });

    it('the FLIGHT field is a single "CODE NNNN" box, auto-formatted and auto-uppercased as you type', () => {
      renderForm();
      const flightInput = screen.getByLabelText('FLIGHT');
      fireEvent.focus(flightInput);
      fireEvent.change(flightInput, { target: { value: 'ek0435extra' } });
      expect(flightInput).toHaveValue('EK 0435');
    });

    it('the flight-adding feature: creating a new Flight fills airlineId/flightNo/depTime on the shipment', async () => {
      const { onSubmit } = renderForm();
      const flightInput = screen.getByLabelText('FLIGHT');
      fireEvent.focus(flightInput);
      fireEvent.change(flightInput, { target: { value: 'EK 0999' } });
      await waitFor(() => expect(screen.getByText('No Flight found')).toBeInTheDocument());
      fireEvent.click(screen.getByRole('button', { name: 'Add New Flight' }));

      const dialog = await screen.findByRole('dialog');
      expect(within(dialog).getByLabelText('Flight Number')).toHaveValue('EK 0999');
      const depTimeInput = within(dialog).getByLabelText('Departure Time');
      fireEvent.change(depTimeInput, { target: { value: '20:20' } });
      fireEvent.click(within(dialog).getByRole('button', { name: 'Create' }));

      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
      expect(screen.getByLabelText('FLIGHT')).toHaveValue('EK 0999');
      expect(
        createdPosts.some(
          (p) =>
            p.url.includes('/masterdata/flights') &&
            p.body.airlineId === 'airline-1' &&
            p.body.flightNo === '0999' &&
            p.body.depTime === '20:20',
        ),
      ).toBe(true);

      await fillAllExcept('flight');
      fireEvent.click(screen.getByRole('button', { name: 'Create shipment' }));
      await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
      expect(onSubmit.mock.calls[0]?.[0]).toMatchObject({
        airlineId: 'airline-1',
        flightNo: '0999',
        depTime: '20:20',
      });
    });

    it('requires both Flight Number and Departure Time in "Add New Flight"', async () => {
      renderForm();
      const flightInput = screen.getByLabelText('FLIGHT');
      fireEvent.focus(flightInput);
      fireEvent.change(flightInput, { target: { value: 'EK 0999' } });
      await waitFor(() => expect(screen.getByText('No Flight found')).toBeInTheDocument());
      fireEvent.click(screen.getByRole('button', { name: 'Add New Flight' }));

      const dialog = await screen.findByRole('dialog');
      expect(within(dialog).getByRole('button', { name: 'Create' })).toBeDisabled();
      fireEvent.change(within(dialog).getByLabelText('Departure Time'), {
        target: { value: '20:20' },
      });
      expect(within(dialog).getByRole('button', { name: 'Create' })).not.toBeDisabled();
    });

    it('rejects "Add New Flight" for a code with no matching Airline, without posting', async () => {
      renderForm();
      const flightInput = screen.getByLabelText('FLIGHT');
      fireEvent.focus(flightInput);
      fireEvent.change(flightInput, { target: { value: 'ZZ 1234' } });
      await waitFor(() => expect(screen.getByText('No Flight found')).toBeInTheDocument());
      fireEvent.click(screen.getByRole('button', { name: 'Add New Flight' }));

      const dialog = await screen.findByRole('dialog');
      fireEvent.change(within(dialog).getByLabelText('Departure Time'), {
        target: { value: '20:20' },
      });
      fireEvent.click(within(dialog).getByRole('button', { name: 'Create' }));

      expect(
        await within(dialog).findByText('No airline found with code "ZZ". Add it in Master Data first.'),
      ).toBeInTheDocument();
      expect(createdPosts.some((p) => p.url.includes('/masterdata/flights'))).toBe(false);
    });

    it('warns about a likely duplicate before creating, and "Use existing" selects the existing record without posting', async () => {
      renderForm();
      const input = screen.getByLabelText('CONSIGNEE');
      fireEvent.focus(input);
      fireEvent.change(input, { target: { value: 'Totally New Name' } });
      await waitFor(() => expect(screen.getByText('No Consignee found')).toBeInTheDocument());
      fireEvent.click(screen.getByRole('button', { name: 'Add New Consignee' }));

      const dialog = await screen.findByRole('dialog');
      const nameField = within(dialog).getByLabelText('Consignee Name');
      fireEvent.change(nameField, { target: { value: 'acme imports' } }); // matches existing, different case
      fireEvent.click(within(dialog).getByRole('button', { name: 'Create' }));

      expect(await within(dialog).findByText('Possible existing record')).toBeInTheDocument();
      expect(within(dialog).getByText('Acme Imports')).toBeInTheDocument();

      fireEvent.click(within(dialog).getByRole('button', { name: 'Use existing' }));

      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
      expect(screen.getByLabelText('CONSIGNEE')).toHaveValue('Acme Imports');
      expect(createdPosts.some((p) => p.url.includes('/masterdata/consignees'))).toBe(false);
    });

    it('lets a "Create anyway" past the duplicate warning actually create a new record', async () => {
      renderForm();
      const input = screen.getByLabelText('CONSIGNEE');
      fireEvent.focus(input);
      fireEvent.change(input, { target: { value: 'Totally New Name' } });
      await waitFor(() => expect(screen.getByText('No Consignee found')).toBeInTheDocument());
      fireEvent.click(screen.getByRole('button', { name: 'Add New Consignee' }));

      const dialog = await screen.findByRole('dialog');
      fireEvent.change(within(dialog).getByLabelText('Consignee Name'), {
        target: { value: 'Acme Imports' },
      });
      fireEvent.click(within(dialog).getByRole('button', { name: 'Create' }));
      await within(dialog).findByText('Possible existing record');

      fireEvent.click(within(dialog).getByRole('button', { name: 'Create anyway' }));

      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
      expect(
        createdPosts.some(
          (p) => p.url.includes('/masterdata/consignees') && p.body.name === 'Acme Imports',
        ),
      ).toBe(true);
    });

    it('"Add New Commodity" asks for Name, a 6-digit-max Code, and Delay Hours, and creates one', async () => {
      renderForm();
      const commodityInput = screen.getByLabelText('COMMODITY');
      fireEvent.focus(commodityInput);
      fireEvent.change(commodityInput, { target: { value: 'Frozen Prawns' } });
      await waitFor(() => expect(screen.getByText('No Commodity found')).toBeInTheDocument());
      fireEvent.click(screen.getByRole('button', { name: 'Add New Commodity' }));

      const dialog = await screen.findByRole('dialog');
      expect(within(dialog).getByLabelText('Commodity Name')).toHaveValue('Frozen Prawns');

      const codeInput = within(dialog).getByLabelText('Commodity Code');
      fireEvent.change(codeInput, { target: { value: '12345678' } });
      expect(codeInput).toHaveValue('123456');

      fireEvent.change(within(dialog).getByLabelText('Delay Hours'), {
        target: { value: '04:15' },
      });
      fireEvent.click(within(dialog).getByRole('button', { name: 'Create' }));

      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
      expect(screen.getByLabelText('COMMODITY')).toHaveValue('Frozen Prawns');
      expect(
        createdPosts.some(
          (p) =>
            p.url.includes('/masterdata/commodities') &&
            p.body.name === 'Frozen Prawns' &&
            p.body.code === '123456' &&
            p.body.delayHours === '04:15',
        ),
      ).toBe(true);
    });

    it('still allows "Add New Shipper" for Executive (masterdata.shipper.create: broader than masterdata.manage)', async () => {
      setExecutivePermissions();
      renderForm();

      const shipperInput = screen.getByLabelText('SHIPPER');
      fireEvent.focus(shipperInput);
      fireEvent.change(shipperInput, { target: { value: 'zzz-no-match' } });
      await waitFor(() => expect(screen.getByText('No Shipper found')).toBeInTheDocument());
      expect(screen.getByRole('button', { name: 'Add New Shipper' })).toBeInTheDocument();
    });

    it('still allows "Add New Consignee" for Executive (masterdata.consignee.create: broader than masterdata.manage)', async () => {
      setExecutivePermissions();
      renderForm();

      const consigneeInput = screen.getByLabelText('CONSIGNEE');
      fireEvent.focus(consigneeInput);
      fireEvent.change(consigneeInput, { target: { value: 'zzz-no-match' } });
      await waitFor(() => expect(screen.getByText('No Consignee found')).toBeInTheDocument());
      expect(screen.getByRole('button', { name: 'Add New Consignee' })).toBeInTheDocument();
    });

    it('still allows "Add New Commodity" for Executive (BR-17: broader than masterdata.manage)', async () => {
      setExecutivePermissions();
      renderForm();

      const commodityInput = screen.getByLabelText('COMMODITY');
      fireEvent.focus(commodityInput);
      fireEvent.change(commodityInput, { target: { value: 'zzz-no-match' } });
      await waitFor(() => expect(screen.getByText('No Commodity found')).toBeInTheDocument());
      expect(screen.getByRole('button', { name: 'Add New Commodity' })).toBeInTheDocument();
    });

    it('still allows "Add New Destination" for Executive (masterdata.airport.create: broader than masterdata.manage)', async () => {
      setExecutivePermissions();
      renderForm();

      const destInput = screen.getByLabelText('DEST');
      fireEvent.focus(destInput);
      fireEvent.change(destInput, { target: { value: 'zzz-no-match' } });
      await waitFor(() => expect(screen.getByText('No Destination found')).toBeInTheDocument());
      expect(screen.getByRole('button', { name: 'Add New Destination' })).toBeInTheDocument();
    });

    it('the Destination code field only accepts up to 3 letters, auto-uppercased', async () => {
      renderForm();
      const destInput = screen.getByLabelText('DEST');
      fireEvent.focus(destInput);
      fireEvent.change(destInput, { target: { value: 'zzz-no-match' } });
      await waitFor(() => expect(screen.getByText('No Destination found')).toBeInTheDocument());
      fireEvent.click(screen.getByRole('button', { name: 'Add New Destination' }));

      const dialog = await screen.findByRole('dialog');
      const codeInput = within(dialog).getByLabelText('Code');
      fireEvent.change(codeInput, { target: { value: 'kh1g99' } });
      expect(codeInput).toHaveValue('KHG');
    });

    it('still allows "Add New Flight" for Executive (masterdata.flight.create: broader than masterdata.manage)', async () => {
      setExecutivePermissions();
      renderForm();

      const flightInput = screen.getByLabelText('FLIGHT');
      fireEvent.focus(flightInput);
      fireEvent.change(flightInput, { target: { value: 'EK 9999' } });
      await waitFor(() => expect(screen.getByText('No Flight found')).toBeInTheDocument());
      expect(screen.getByRole('button', { name: 'Add New Flight' })).toBeInTheDocument();
    });
  });

  describe('edit (full field set, unchanged)', () => {
    it('still exposes House AWB, Handling Date and CUSDEC No for later-workflow edits', async () => {
      renderForm({ shipment: editShipment });
      await waitFor(() => expect(screen.getByText('EK — Emirates')).toBeInTheDocument());

      expect(screen.getByLabelText('House AWB')).toHaveValue('HL 0106');
      expect(screen.getByLabelText('Handling Date')).toHaveValue('2026-06-14');
      expect(screen.getByLabelText('CUSDEC No')).toHaveValue('CUS-12345');
      expect(screen.getByRole('button', { name: 'Save changes' })).toBeInTheDocument();
    });
  });
});
