import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AnalyticsPage } from './AnalyticsPage';

function jsonResponse(status: number, body: unknown) {
  return { ok: status < 400, status, json: () => Promise.resolve(body) };
}

const summaryFixture = {
  groupBy: 'commodity',
  period: null,
  groups: [
    {
      key: 'c1',
      label: 'Fish',
      shipmentCount: 2,
      weightKg: '600.000',
      revenueUsd: '200.00',
      revenueLkr: '68100.00',
      buyingCostUsd: '80.00',
      buyingCostLkr: '27240.00',
      opexLkr: '2000.00',
      profitLkr: '38860.00',
    },
  ],
  totals: {
    key: 'all',
    label: 'Total',
    shipmentCount: 2,
    weightKg: '600.000',
    revenueUsd: '200.00',
    revenueLkr: '68100.00',
    buyingCostUsd: '80.00',
    buyingCostLkr: '27240.00',
    opexLkr: '2000.00',
    profitLkr: '38860.00',
  },
};

const shipmentsFixture = [
  {
    shipmentId: 'shipment-1',
    shipmentNo: 'HUB 000001',
    flightDate: '2026-08-04',
    status: 'PENDING',
    weightKg: '300.000',
    commodityId: 'c1',
    commodityName: 'Fish',
    airlineId: 'a1',
    airlineName: 'Emirates',
    consigneeId: 'co1',
    consigneeName: 'Test Consignee',
    shipperId: 's1',
    shipperName: 'Acme',
    destinationAirportId: 'da1',
    destinationAirportCode: 'DXB',
    salesPersonId: 'user-1',
    salesPersonName: 'John Doe',
    chargeableWeightKg: '300.000',
    exchangeRateUsed: '340.50',
    revenueUsd: '100.00',
    revenueLkr: '34050.00',
    buyingCostUsd: '40.00',
    buyingCostLkr: '13620.00',
    opexLkr: '1000.00',
    profitLkr: '19430.00',
  },
];

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <AnalyticsPage />
    </QueryClientProvider>,
  );
}

describe('AnalyticsPage', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders the drill-through table and the summary totals, reconciled', async () => {
    const requestedUrls: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) => {
        requestedUrls.push(url);
        if (url.includes('/analytics/summary'))
          return Promise.resolve(jsonResponse(200, summaryFixture));
        if (url.includes('/analytics/shipments'))
          return Promise.resolve(jsonResponse(200, shipmentsFixture));
        return Promise.resolve(jsonResponse(200, []));
      }),
    );

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('HUB 000001')).toBeInTheDocument();
    });
    // Totals row from the summary and the single shipment row's own figures
    // both surface as plain text — this is the reconciliation PRD §10 asks for.
    expect(screen.getAllByText('68100.00').length).toBeGreaterThan(0);
    expect(screen.getByText('19430.00')).toBeInTheDocument();

    expect(requestedUrls.some((u) => u.includes('groupBy=commodity'))).toBe(true);
  });

  it('switching dimension tabs re-queries the summary with the new groupBy', async () => {
    const requestedUrls: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) => {
        requestedUrls.push(url);
        if (url.includes('/analytics/summary'))
          return Promise.resolve(
            jsonResponse(200, { ...summaryFixture, groupBy: 'airline', period: null }),
          );
        if (url.includes('/analytics/shipments'))
          return Promise.resolve(jsonResponse(200, shipmentsFixture));
        return Promise.resolve(jsonResponse(200, []));
      }),
    );

    renderPage();
    await waitFor(() => expect(screen.getByText('HUB 000001')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: 'Airline' }));

    await waitFor(() => {
      expect(requestedUrls.some((u) => u.includes('groupBy=airline'))).toBe(true);
    });
  });

  it('offers CSV export actions for both the summary and the drill-through list', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) => {
        if (url.includes('/analytics/summary'))
          return Promise.resolve(jsonResponse(200, summaryFixture));
        if (url.includes('/analytics/shipments'))
          return Promise.resolve(jsonResponse(200, shipmentsFixture));
        return Promise.resolve(jsonResponse(200, []));
      }),
    );

    renderPage();
    await waitFor(() => expect(screen.getByText('HUB 000001')).toBeInTheDocument());

    expect(screen.getByRole('button', { name: 'Export summary Excel' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Export shipments Excel' })).toBeInTheDocument();
  });
});
