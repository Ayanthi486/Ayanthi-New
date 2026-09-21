import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Shipment } from '@hub-lanka/shared';
import { Toast } from '@/components/shared/Toast';
import { useAuthStore } from '@/lib/authStore';
import { ScheduleGrid } from './ScheduleGrid';

function setPermissions(permissions: string[]) {
  useAuthStore.setState({
    user: {
      id: 'u1',
      email: 'test@hublanka.dev',
      fullName: 'Test User',
      roles: ['Manager'],
      permissions,
      hasAvatar: false, hasSignature: false,
      idCardNo: null,
    },
    permissions: new Set(permissions),
    accessToken: 'token',
    isLoading: false,
  });
}

function jsonResponse(status: number, body: unknown) {
  return { ok: status < 400, status, json: () => Promise.resolve(body) };
}

const shipment: Shipment = {
  id: 'ship-1',
  shipmentNo: 'HUB 000001',
  mawbNo: '176 2853 0191',
  houseAwbNo: 'HL 0106',
  airlineId: 'airline-1',
  airlineCode: 'EK',
  airlineName: 'Emirates',
  flightNo: '0654',
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

function renderGrid(shipments: Shipment[] = [shipment]) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <ScheduleGrid shipments={shipments} isLoading={false} />
        <Toast />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const createdPatches: { url: string; body: Record<string, unknown> }[] = [];

describe('ScheduleGrid', () => {
  beforeEach(() => {
    createdPatches.length = 0;
    vi.stubGlobal('open', vi.fn());
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string, init?: RequestInit) => {
        if (init?.method === 'PATCH' && url.includes('/status')) {
          const body = JSON.parse(init.body as string) as Record<string, unknown>;
          createdPatches.push({ url, body });
          return Promise.resolve(
            jsonResponse(200, { ...shipment, ...body, version: shipment.version + 1 }),
          );
        }
        return Promise.resolve(jsonResponse(200, []));
      }),
    );
    Object.assign(navigator, { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } });
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

  it('renders exactly the confirmed columns (BR-23 excludes CUS NO / FLT ATD / BOOKED BOX / BOOKED WEIGHT; no Shipment ID/COMMODITY/alert-badge CUT-OFF columns)', () => {
    renderGrid();

    for (const header of [
      'DEP TIME',
      'MAWB NO',
      'DEST',
      'FLIGHT',
      'DATE',
      'SHIPPER',
      'CONSIGNEE',
      'BOX',
      'WEIGHT',
      'CUT-OFF TIME',
      'STATUS',
    ]) {
      expect(screen.getByText(header)).toBeInTheDocument();
    }

    for (const excluded of [
      'CUS NO',
      'FLT ATD',
      'BOOKED BOX',
      'BOOKED WEIGHT',
      'Shipment ID',
      'COMMODITY',
    ]) {
      expect(screen.queryByText(excluded)).not.toBeInTheDocument();
    }
    // Only one "CUT-OFF"-headed column — the alert badge is gone from this grid.
    expect(screen.getAllByText(/^CUT-OFF/)).toHaveLength(1);

    // The hidden field (BR-19) is never rendered in the grid.
    expect(screen.queryByText('CUS-12345')).not.toBeInTheDocument();
  });

  it('shows the airline code and flight number together, and the computed Cut-off Time', () => {
    renderGrid();
    expect(screen.getByText('EK 0654')).toBeInTheDocument();
    expect(screen.getByText('22:05')).toBeInTheDocument();
  });

  it('AC-24: View is an Actions-row button (no separate leftmost View column, no Edit button)', () => {
    renderGrid();
    expect(screen.getByRole('button', { name: 'View' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'View' })).toHaveAttribute('href', '/shipments/ship-1');
  });

  it('hides the Actions column when printing, but not the rest of the grid', () => {
    renderGrid();
    const actionsHeader = screen.getByText('Actions').closest('th');
    expect(actionsHeader).toHaveClass('print:hidden');
    const depTimeHeader = screen.getByText('DEP TIME').closest('th');
    expect(depTimeHeader).not.toHaveClass('print:hidden');
  });

  it('AC-07: Copy MAWB writes to the clipboard and shows a confirmation toast', async () => {
    renderGrid();

    fireEvent.click(screen.getByRole('button', { name: 'Copy MAWB' }));

    // eslint-disable-next-line @typescript-eslint/unbound-method -- vi.fn() mock, not a real bound method
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('176 2853 0191');
    await waitFor(() => expect(screen.getByText('MAWB copied')).toBeInTheDocument());
  });

  it('AC-08/BR-22: Track opens the company tracking URL in a new tab with noopener,noreferrer', () => {
    renderGrid();

    fireEvent.click(screen.getByRole('button', { name: 'Track' }));

    // eslint-disable-next-line @typescript-eslint/unbound-method -- vi.fn() mock, not a real bound method
    expect(window.open).toHaveBeenCalledWith(
      'https://hublanka.lk/tracking/',
      '_blank',
      'noopener,noreferrer',
    );
  });

  it('disables Copy MAWB when the shipment has no MAWB', () => {
    renderGrid([{ ...shipment, mawbNo: null }]);
    expect(screen.getByRole('button', { name: 'Copy MAWB' })).toBeDisabled();
  });

  describe('status change', () => {
    it('shows a read-only badge (no dropdown) without shipment.status.update', () => {
      renderGrid();
      expect(screen.getByText('Pending')).toBeInTheDocument();
      expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    });

    it('with shipment.status.update, offers exactly the base 4 values, no Payment options', () => {
      setPermissions(['shipment.status.update']);
      renderGrid();

      const select = screen.getByRole('combobox') as HTMLSelectElement;
      const optionLabels = Array.from(select.options).map((o) => o.textContent);
      expect(optionLabels).toEqual(['Pending', 'Confirmed', 'Cancelled', 'Departed']);
    });

    it('with shipment.status.payment too, also offers the 2 Payment values', () => {
      setPermissions(['shipment.status.update', 'shipment.status.payment']);
      renderGrid();

      const select = screen.getByRole('combobox') as HTMLSelectElement;
      const optionLabels = Array.from(select.options).map((o) => o.textContent);
      expect(optionLabels).toEqual([
        'Pending',
        'Confirmed',
        'Cancelled',
        'Departed',
        'Payment Pending',
        'Payment Received',
      ]);
    });

    it('picking Departed with no actualDepartureAt yet prompts for a timestamp before submitting', async () => {
      setPermissions(['shipment.status.update']);
      renderGrid();

      fireEvent.change(screen.getByRole('combobox'), { target: { value: 'DEPARTED' } });

      const dialog = await screen.findByRole('dialog');
      expect(within(dialog).getByText(/Enter departure date & time/)).toBeInTheDocument();
      expect(within(dialog).getByRole('button', { name: 'Confirm' })).toBeDisabled();
    });

    it('picking a non-Departed value submits immediately with no prompt', async () => {
      setPermissions(['shipment.status.update']);
      renderGrid();

      fireEvent.change(screen.getByRole('combobox'), { target: { value: 'CONFIRMED' } });

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      await waitFor(() =>
        expect(
          createdPatches.some(
            (p) => p.url.includes('/shipments/ship-1/status') && p.body.status === 'CONFIRMED',
          ),
        ).toBe(true),
      );
    });
  });
});
