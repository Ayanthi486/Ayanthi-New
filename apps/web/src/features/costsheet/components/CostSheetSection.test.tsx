import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuthStore } from '@/lib/authStore';
import { CostSheetSection } from './CostSheetSection';

function jsonResponse(status: number, body: unknown) {
  return { ok: status < 400, status, json: () => Promise.resolve(body) };
}

function renderSection() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <CostSheetSection shipmentId="shipment-1" />
    </QueryClientProvider>,
  );
}

const costSheetFixture = {
  id: 'cs-1',
  shipmentId: 'shipment-1',
  shipmentNo: 'HUB 000001',
  snNo: 'SN-1',
  status: 'DRAFT',
  remarks: null,
  shiftLeaderSignature: null,
  lines: [
    { lineType: 'SL_CUSTOMS_RECEIPTS', amount: '1800.00' },
    { lineType: 'TRANSPORT', amount: '12209.54' },
    { lineType: 'ANIMAL_QUARANTINE', amount: null },
    { lineType: 'PLANT_QUARANTINE', amount: null },
    { lineType: 'AASL_VEHICLE_PASS', amount: null },
    { lineType: 'LABOUR', amount: '1300' },
    { lineType: 'SRILANKAN_SECURITY_CHARGES_RECEIPTS', amount: null },
    { lineType: 'SRILANKAN_SECURITY_OFFICER_EXPENSES', amount: null },
    { lineType: 'INSPECTION', amount: '1000' },
    { lineType: 'OPERATIONAL', amount: '1320' },
    { lineType: 'OTHER', amount: null },
  ],
  total: '17629.54',
  version: 0,
  createdByUserId: 'user-1',
  releasedByUserId: null,
  releasedAt: null,
  approvedByUserId: null,
  approvedAt: null,
  createdAt: '2026-06-01T00:00:00.000Z',
  updatedAt: '2026-06-01T00:00:00.000Z',
};

describe('CostSheetSection', () => {
  beforeEach(() => {
    useAuthStore.setState({
      permissions: new Set(['costsheet.prepare', 'costsheet.view', 'costsheet.approve']),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    useAuthStore.setState({ permissions: new Set() });
  });

  it('offers to create a Cost Sheet when none exists yet (404)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve(
          jsonResponse(404, { error: { code: 'NOT_FOUND', message: 'No Cost Sheet exists yet' } }),
        ),
      ),
    );

    renderSection();

    await waitFor(() => {
      expect(screen.getByText('No Cost Sheet has been prepared yet.')).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: 'Create Cost Sheet' })).toBeInTheDocument();
  });

  it('reconciles the company reference total and shows the Release action while Draft', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(jsonResponse(200, costSheetFixture))),
    );

    renderSection();

    await waitFor(() => {
      expect(screen.getByText('Total: LKR 17629.54')).toBeInTheDocument();
    });
    expect(screen.getByLabelText('SL Customs Receipts')).toHaveValue('1800.00');
    expect(screen.getByLabelText('Transport')).toHaveValue('12209.54');
    expect(screen.getByRole('button', { name: 'Release' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Approve' })).not.toBeInTheDocument();
  });

  it('shows Approve (not Release) once the sheet is Released', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(jsonResponse(200, { ...costSheetFixture, status: 'RELEASED' }))),
    );

    renderSection();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Approve' })).toBeInTheDocument();
    });
    expect(screen.queryByRole('button', { name: 'Release' })).not.toBeInTheDocument();
  });

  it('disables every field once Approved and shows no edit action', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve(
          jsonResponse(200, {
            ...costSheetFixture,
            status: 'APPROVED',
            approvedAt: '2026-06-02T00:00:00.000Z',
          }),
        ),
      ),
    );

    renderSection();

    await waitFor(() => {
      expect(screen.getByLabelText('SL Customs Receipts')).toBeDisabled();
    });
    expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Release' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Approve' })).not.toBeInTheDocument();
  });

  it('triggers create when the button is clicked', async () => {
    const fetchMock = vi.fn((_url: string, init?: RequestInit) => {
      if (init?.method === 'POST') {
        return Promise.resolve(jsonResponse(201, { ...costSheetFixture }));
      }
      return Promise.resolve(
        jsonResponse(404, { error: { code: 'NOT_FOUND', message: 'No Cost Sheet exists yet' } }),
      );
    });
    vi.stubGlobal('fetch', fetchMock);

    renderSection();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Create Cost Sheet' })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Create Cost Sheet' }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/costsheets'),
        expect.objectContaining({ method: 'POST' }),
      );
    });
  });
});
