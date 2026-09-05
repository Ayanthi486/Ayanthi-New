import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Shipment } from '@hub-lanka/shared';
import { Toast } from '@/components/shared/Toast';
import { ScheduleGrid } from './ScheduleGrid';

function jsonResponse(status: number, body: unknown) {
  return { ok: status < 400, status, json: () => Promise.resolve(body) };
}

const shipment: Shipment = {
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

describe('ScheduleGrid', () => {
  beforeEach(() => {
    vi.stubGlobal('open', vi.fn());
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(jsonResponse(200, []))),
    );
    Object.assign(navigator, { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders exactly the confirmed columns (BR-23 excludes CUS NO / FLT ATD / BOOKED BOX / BOOKED WEIGHT)', () => {
    renderGrid();

    for (const header of [
      'Shipment ID',
      'DEP TIME',
      'MAWB NO',
      'DEST',
      'FLIGHT',
      'DATE',
      'SHIPPER',
      'CONSIGNEE',
      'COMMODITY',
      'BOX',
      'WEIGHT',
      'STATUS',
      'CUT-OFF',
    ]) {
      expect(screen.getByText(header)).toBeInTheDocument();
    }

    for (const excluded of ['CUS NO', 'FLT ATD', 'BOOKED BOX', 'BOOKED WEIGHT']) {
      expect(screen.queryByText(excluded)).not.toBeInTheDocument();
    }

    // The hidden field (BR-19) is never rendered in the grid.
    expect(screen.queryByText('CUS-12345')).not.toBeInTheDocument();
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
});
