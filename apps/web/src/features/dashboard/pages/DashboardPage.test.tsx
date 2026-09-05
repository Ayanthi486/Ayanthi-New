import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Shipment } from '@hub-lanka/shared';
import { useAuthStore } from '@/lib/authStore';
import { DashboardPage } from './DashboardPage';

function jsonResponse(status: number, body: unknown) {
  return { ok: status < 400, status, json: () => Promise.resolve(body) };
}

const shipment: Shipment = {
  id: 'ship-1',
  shipmentNo: 'HUB 000001',
  mawbNo: '176 2853 0191',
  houseAwbNo: null,
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
  handlingDate: null,
  depTime: '03:05',
  cusdecNo: null,
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

const shipmentListResponse = {
  data: [shipment],
  meta: { page: 1, pageSize: 20, total: 1 },
  kpis: { total: 1, pending: 1, completed: 0, cancelled: 0 },
};

const analyticsSummaryResponse = {
  groupBy: 'commodity',
  period: null,
  groups: [],
  totals: {
    key: 'all',
    label: 'Total',
    shipmentCount: 1,
    weightKg: '444.500',
    revenueUsd: '100.00',
    revenueLkr: '34050.00',
    buyingCostUsd: '40.00',
    buyingCostLkr: '13620.00',
    opexLkr: '1000.00',
    profitLkr: '19430.00',
  },
};

function setUser(permissions: string[]) {
  useAuthStore.setState({
    user: {
      id: 'u1',
      email: 'user@hublanka.dev',
      fullName: 'Test User',
      roles: ['Executive'],
      permissions,
      hasAvatar: false,
    },
    permissions: new Set(permissions),
    accessToken: 'token',
    isLoading: false,
  });
}

function stubFetch(options: { cancellationQueue?: unknown[] } = {}) {
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string) => {
      if (url.includes('/shipments/cancellation-requests')) {
        return Promise.resolve(jsonResponse(200, options.cancellationQueue ?? []));
      }
      if (url.includes('/shipments')) {
        return Promise.resolve(jsonResponse(200, shipmentListResponse));
      }
      if (url.includes('/cutoff/active')) {
        return Promise.resolve(jsonResponse(200, []));
      }
      if (url.includes('/analytics/summary')) {
        return Promise.resolve(jsonResponse(200, analyticsSummaryResponse));
      }
      if (url.includes('/masterdata/')) {
        return Promise.resolve(jsonResponse(200, []));
      }
      return Promise.resolve(jsonResponse(200, {}));
    }),
  );
}

function renderDashboard() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('DashboardPage', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    useAuthStore.setState({
      user: null,
      permissions: new Set(),
      accessToken: null,
      isLoading: false,
    });
  });

  it('reads the same shipment data as Shipments (shared useShipments/KPI hook) and shows a compact preview, not the full grid', async () => {
    setUser(['shipment.view', 'shipment.create']);
    stubFetch();

    renderDashboard();

    await waitFor(() => expect(screen.getByText('HUB 000001')).toBeInTheDocument());
    // The same KPI totals the Shipments page's KpiRow shows, from the same endpoint.
    expect(screen.getByText('Total')).toBeInTheDocument();
    expect(screen.getAllByText('1').length).toBeGreaterThan(0);
    // Compact preview columns only — none of the full grid's MAWB/DEST/
    // FLIGHT/SHIPPER/CONSIGNEE/COMMODITY/BOX/WEIGHT columns or row actions.
    expect(screen.queryByText('MAWB NO')).not.toBeInTheDocument();
    expect(screen.queryByText('SHIPPER')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Copy MAWB' })).not.toBeInTheDocument();
  });

  it('Executive: sees Add Shipment, but no Business Overview and no approval queue', async () => {
    setUser(['shipment.view', 'shipment.create']);
    stubFetch();

    renderDashboard();

    await waitFor(() => expect(screen.getByText('HUB 000001')).toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'Add shipment' })).toBeInTheDocument();
    expect(screen.queryByText('Business Overview')).not.toBeInTheDocument();
    expect(screen.queryByText('Pending cancellation requests')).not.toBeInTheDocument();
  });

  it('Manager: sees Add Shipment, Business Overview, and the pending-approvals queue', async () => {
    setUser([
      'shipment.view',
      'shipment.create',
      'shipment.cancellation.approve',
      'analytics.view',
    ]);
    stubFetch({
      cancellationQueue: [{ id: 'req-1', shipmentNo: 'HUB 000002', reason: 'Wrong commodity' }],
    });

    renderDashboard();

    await waitFor(() => expect(screen.getByText('HUB 000001')).toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'Add shipment' })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('Business Overview')).toBeInTheDocument());
    await waitFor(() =>
      expect(screen.getByText('Pending cancellation requests')).toBeInTheDocument(),
    );
    expect(screen.getByText('HUB 000002')).toBeInTheDocument();
  });

  it('Director: sees Business Overview (BR-01: can also create shipments), but no approval queue', async () => {
    setUser(['shipment.view', 'shipment.create', 'analytics.view']);
    stubFetch();

    renderDashboard();

    await waitFor(() => expect(screen.getByText('HUB 000001')).toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'Add shipment' })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('Business Overview')).toBeInTheDocument());
    expect(screen.queryByText('Pending cancellation requests')).not.toBeInTheDocument();
  });

  it('links to the full Shipments page when there are more shipments than the preview shows', async () => {
    stubFetch();
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) => {
        if (url.includes('/shipments/cancellation-requests'))
          return Promise.resolve(jsonResponse(200, []));
        if (url.includes('/shipments')) {
          return Promise.resolve(
            jsonResponse(200, {
              ...shipmentListResponse,
              meta: { page: 1, pageSize: 20, total: 12 },
            }),
          );
        }
        if (url.includes('/cutoff/active')) return Promise.resolve(jsonResponse(200, []));
        return Promise.resolve(jsonResponse(200, {}));
      }),
    );
    setUser(['shipment.view']);

    renderDashboard();

    await waitFor(() => expect(screen.getByText('HUB 000001')).toBeInTheDocument());
    expect(screen.getByRole('link', { name: 'View all 12 in Shipments →' })).toHaveAttribute(
      'href',
      '/shipments',
    );
  });
});
