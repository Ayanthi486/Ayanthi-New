import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuthStore } from '@/lib/authStore';
import { InvoiceSection } from './InvoiceSection';

function jsonResponse(status: number, body: unknown) {
  return { ok: status < 400, status, json: () => Promise.resolve(body) };
}

function renderSection() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <InvoiceSection shipmentId="shipment-1" />
    </QueryClientProvider>,
  );
}

const invoiceFixture = {
  id: 'inv-1',
  shipmentId: 'shipment-1',
  shipmentNo: 'HUB 000001',
  awbNumber: '157 0659 8944',
  flights: 'QR0655/QR0123',
  etdColombo: '2026-08-04',
  destinationAirportCode: 'MXP',
  commodityName: 'FRESH FISH',
  shipperName: 'OCEAN LINE SEA FOODS PVT LTD',
  shipperAddress: 'MEDA MUKALANA WATTA',
  consigneeName: 'SEA FISH ITALIA SRL',
  noOfPkgs: 26,
  grossWeightKg: '444.5',
  invoiceNo: 'HUB/IU/0676/2026',
  invoiceDate: '2026-08-04',
  exchangeRate: '340.50',
  termDays: 5,
  dueDate: '2026-08-09',
  chargeableWeightKg: '500',
  status: 'DRAFT',
  version: 0,
  lines: [
    {
      id: 'line-1',
      sortOrder: 0,
      description: 'FREIGHT CHARGES',
      weightBasis: 'CHARGEABLE',
      weightKg: '500',
      rateUsd: '4.75',
      amountUsd: '2375',
      amountLkr: '808687.5',
    },
  ],
  totalUsd: '2375.00',
  totalLkr: '808687.50',
  airlineBuyingCostUsd: '2375.00',
  createdByUserId: 'user-1',
  issuedByUserId: null,
  issuedAt: null,
  createdAt: '2026-08-01T00:00:00.000Z',
  updatedAt: '2026-08-01T00:00:00.000Z',
};

describe('InvoiceSection', () => {
  beforeEach(() => {
    useAuthStore.setState({
      permissions: new Set(['invoice.manage', 'invoice.view']),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    useAuthStore.setState({ permissions: new Set() });
  });

  it('offers to create an Invoice when none exists yet (404)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve(
          jsonResponse(404, { error: { code: 'NOT_FOUND', message: 'No Invoice exists yet' } }),
        ),
      ),
    );

    renderSection();

    await waitFor(() => {
      expect(screen.getByText('No Invoice has been created yet.')).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: 'Create Invoice' })).toBeInTheDocument();
  });

  it('shows the resolved header fields, lines and totals, and the Issue action while Draft', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(jsonResponse(200, invoiceFixture))),
    );

    renderSection();

    await waitFor(() => {
      expect(screen.getByText('2375.00')).toBeInTheDocument();
    });
    expect(screen.getByText('157 0659 8944')).toBeInTheDocument();
    expect(screen.getByText('808687.50')).toBeInTheDocument();
    expect(screen.getByLabelText('Description')).toHaveValue('FREIGHT CHARGES');
    expect(screen.getByRole('button', { name: 'Issue' })).toBeInTheDocument();
  });

  it('disables every field once Issued and shows no Save/Issue action', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve(
          jsonResponse(200, {
            ...invoiceFixture,
            status: 'ISSUED',
            issuedByUserId: 'user-2',
            issuedAt: '2026-08-05T00:00:00.000Z',
          }),
        ),
      ),
    );

    renderSection();

    await waitFor(() => {
      expect(screen.getByLabelText('Invoice No')).toBeDisabled();
    });
    expect(screen.getByLabelText('Description')).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Issue' })).not.toBeInTheDocument();
  });

  it('triggers create when the button is clicked', async () => {
    const fetchMock = vi.fn((_url: string, init?: RequestInit) => {
      if (init?.method === 'POST') {
        return Promise.resolve(jsonResponse(201, { ...invoiceFixture }));
      }
      return Promise.resolve(
        jsonResponse(404, { error: { code: 'NOT_FOUND', message: 'No Invoice exists yet' } }),
      );
    });
    vi.stubGlobal('fetch', fetchMock);

    renderSection();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Create Invoice' })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Create Invoice' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/invoices'),
        expect.objectContaining({ method: 'POST' }),
      );
    });
  });

  it('fields start read-only with an Edit button; Cancel reverts without saving', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(jsonResponse(200, invoiceFixture))),
    );

    renderSection();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument());

    const input = screen.getByLabelText('Invoice No');
    expect(input).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Add line' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    expect(input).not.toBeDisabled();
    expect(screen.getByRole('button', { name: 'Add line' })).toBeInTheDocument();
    fireEvent.change(input, { target: { value: 'CHANGED' } });

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument();
    expect(screen.getByLabelText('Invoice No')).toHaveValue('HUB/IU/0676/2026');
  });

  it('Print opens a new window and writes a printable summary into it', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(jsonResponse(200, invoiceFixture))),
    );
    const fakeWindow = { document: { write: vi.fn(), close: vi.fn() }, focus: vi.fn(), print: vi.fn() };
    vi.stubGlobal('open', vi.fn().mockReturnValue(fakeWindow));

    renderSection();
    fireEvent.click(await screen.findByRole('button', { name: 'Print' }));

    expect(fakeWindow.document.write).toHaveBeenCalledWith(expect.stringContaining('Invoice'));
    expect(fakeWindow.print).toHaveBeenCalledTimes(1);
  });
});
