import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CreateShipmentRequest, Shipment, UpdateShipmentRequest } from '@hub-lanka/shared';
import { ShipmentForm } from './ShipmentForm';
import { useAuthStore } from '@/lib/authStore';

function jsonResponse(status: number, body: unknown) {
  return { ok: status < 400, status, json: () => Promise.resolve(body) };
}

const airlines = [
  { id: 'airline-1', name: 'Emirates', isActive: true, createdAt: '', updatedAt: '' },
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
  airlineName: 'Emirates',
  flightNo: 'EK654',
  destinationAirportId: 'airport-1',
  destinationAirportCode: 'DXB',
  shipperId: 'shipper-1',
  shipperName: 'Acme Exports',
  consigneeId: 'consignee-1',
  consigneeName: 'Acme Imports',
  commodityId: 'commodity-1',
  commodityName: 'Edible Fish',
  flightDate: '2026-06-15',
  handlingDate: '2026-06-14',
  depTime: '03:05',
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
      return Promise.resolve(jsonResponse(200, {}));
    }),
  );
}

/** Manager holds masterdata.manage (Shipper/Consignee/Airline/Destination create) + commodity.create. */
function setManagerPermissions() {
  useAuthStore.setState({
    user: {
      id: 'u1',
      email: 'manager@hublanka.dev',
      fullName: 'Test Manager',
      roles: ['Manager'],
      permissions: ['masterdata.manage', 'masterdata.commodity.create'],
      hasAvatar: false,
    },
    permissions: new Set(['masterdata.manage', 'masterdata.commodity.create']),
    accessToken: 'token',
    isLoading: false,
  });
}

/** Executive holds masterdata.commodity.create but NOT masterdata.manage. */
function setExecutivePermissions() {
  useAuthStore.setState({
    user: {
      id: 'u2',
      email: 'exec@hublanka.dev',
      fullName: 'Test Executive',
      roles: ['Executive'],
      permissions: ['masterdata.commodity.create'],
      hasAvatar: false,
    },
    permissions: new Set(['masterdata.commodity.create']),
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
    key: 'depTime',
    label: 'DEP TIME',
    run: () => {
      fireEvent.change(screen.getByLabelText('DEP TIME'), { target: { value: '14:30' } });
    },
  },
  {
    key: 'mawbNo',
    label: 'MAWB NO',
    run: () => {
      fireEvent.change(screen.getByLabelText('MAWB NO'), { target: { value: '176-0001' } });
    },
  },
  {
    key: 'destinationAirportId',
    label: 'DEST',
    run: () => selectFromCombobox('DEST', 'Dubai', /DXB — Dubai/),
  },
  {
    key: 'airlineId',
    label: 'Airline',
    run: () => selectFromCombobox('Airline', 'Emirates', /Emirates/),
  },
  {
    key: 'flightNo',
    label: 'Flight No',
    run: () => {
      fireEvent.change(screen.getByLabelText('Flight No'), { target: { value: 'EK650' } });
    },
  },
  {
    key: 'flightDate',
    label: 'DATE',
    run: () => {
      fireEvent.change(screen.getByLabelText('DATE'), { target: { value: '2026-06-15' } });
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
    it('shows exactly the eight required fields — nothing from later workflows, no Shipment ID or Cut-off', () => {
      renderForm();

      expect(screen.getByLabelText('DEP TIME')).toBeInTheDocument();
      expect(screen.getByLabelText('MAWB NO')).toBeInTheDocument();
      expect(screen.getByLabelText('DEST')).toBeInTheDocument();
      expect(screen.getByRole('group', { name: 'FLIGHT' })).toBeInTheDocument();
      expect(screen.getByLabelText('Airline')).toBeInTheDocument();
      expect(screen.getByLabelText('Flight No')).toBeInTheDocument();
      expect(screen.getByLabelText('DATE')).toBeInTheDocument();
      expect(screen.getByLabelText('SHIPPER')).toBeInTheDocument();
      expect(screen.getByLabelText('CONSIGNEE')).toBeInTheDocument();
      expect(screen.getByLabelText('COMMODITY')).toBeInTheDocument();

      // Not shown on the initial form at all (system-generated/computed).
      expect(screen.queryByText('Shipment ID')).not.toBeInTheDocument();
      expect(screen.queryByText('CUT-OFF')).not.toBeInTheDocument();
      // Deferred to later workflows (Edit / Cargo Handling).
      expect(screen.queryByLabelText('House AWB')).not.toBeInTheDocument();
      expect(screen.queryByLabelText('Handling Date')).not.toBeInTheDocument();
      expect(screen.queryByLabelText('CUSDEC No')).not.toBeInTheDocument();
      expect(screen.queryByLabelText(/box/i)).not.toBeInTheDocument();
      expect(screen.queryByLabelText(/weight/i)).not.toBeInTheDocument();

      // None of the eight are marked optional.
      expect(screen.queryByText('(optional)')).not.toBeInTheDocument();
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
        depTime: '14:30',
        mawbNo: '176-0001',
        destinationAirportId: 'airport-1',
        airlineId: 'airline-1',
        flightNo: 'EK650',
        flightDate: '2026-06-15',
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
      fireEvent.change(screen.getByLabelText('MAWB NO'), { target: { value: 'KEEP-ME-0001' } });

      const input = screen.getByLabelText('SHIPPER');
      fireEvent.focus(input);
      fireEvent.change(input, { target: { value: 'Brand New Shipper' } });
      await waitFor(() => expect(screen.getByText('No Shipper found')).toBeInTheDocument());
      fireEvent.click(screen.getByRole('button', { name: 'Add New Shipper' }));

      const dialog = await screen.findByRole('dialog');
      expect(within(dialog).getByLabelText('Name')).toHaveValue('Brand New Shipper');
      fireEvent.click(within(dialog).getByRole('button', { name: 'Create' }));

      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
      expect(screen.getByLabelText('SHIPPER')).toHaveValue('Brand New Shipper');
      expect(
        createdPosts.some(
          (p) => p.url.includes('/masterdata/shippers') && p.body.name === 'Brand New Shipper',
        ),
      ).toBe(true);
      // The MAWB NO value entered before the detour is still there.
      expect(screen.getByLabelText('MAWB NO')).toHaveValue('KEEP-ME-0001');

      await fillAllExcept('shipperId');
      fireEvent.click(screen.getByRole('button', { name: 'Create shipment' }));
      await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
      expect(onSubmit.mock.calls[0]?.[0]).toMatchObject({ shipperId: 'created-100' });
    });

    it('warns about a likely duplicate before creating, and "Use existing" selects the existing record without posting', async () => {
      renderForm();
      const input = screen.getByLabelText('CONSIGNEE');
      fireEvent.focus(input);
      fireEvent.change(input, { target: { value: 'Totally New Name' } });
      await waitFor(() => expect(screen.getByText('No Consignee found')).toBeInTheDocument());
      fireEvent.click(screen.getByRole('button', { name: 'Add New Consignee' }));

      const dialog = await screen.findByRole('dialog');
      const nameField = within(dialog).getByLabelText('Name');
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
      fireEvent.change(within(dialog).getByLabelText('Name'), {
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

    it('hides "Add New X" for a field the signed-in role cannot create (Executive lacks masterdata.manage)', async () => {
      setExecutivePermissions();
      renderForm();

      const shipperInput = screen.getByLabelText('SHIPPER');
      fireEvent.focus(shipperInput);
      fireEvent.change(shipperInput, { target: { value: 'zzz-no-match' } });
      await waitFor(() => expect(screen.getByText('No Shipper found')).toBeInTheDocument());
      expect(screen.queryByRole('button', { name: 'Add New Shipper' })).not.toBeInTheDocument();
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
  });

  describe('edit (full field set, unchanged)', () => {
    it('still exposes House AWB, Handling Date and CUSDEC No for later-workflow edits', async () => {
      renderForm({ shipment: editShipment });
      await waitFor(() => expect(screen.getByText('Emirates')).toBeInTheDocument());

      expect(screen.getByLabelText('House AWB')).toHaveValue('HL 0106');
      expect(screen.getByLabelText('Handling Date')).toHaveValue('2026-06-14');
      expect(screen.getByLabelText('CUSDEC No')).toHaveValue('CUS-12345');
      expect(screen.getByRole('button', { name: 'Save changes' })).toBeInTheDocument();
    });
  });
});
