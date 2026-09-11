import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import type { CutoffAlert, Shipment } from '@hub-lanka/shared';
import { useAuthStore } from '@/lib/authStore';
import { CutoffIndicator } from './CutoffIndicator';

const baseShipment: Shipment = {
  id: 'shipment-1',
  shipmentNo: 'HUB 000001',
  mawbNo: null,
  houseAwbNo: null,
  airlineId: 'airline-1',
  airlineCode: 'EK',
  airlineName: 'Emirates',
  flightNo: null,
  destinationAirportId: null,
  destinationAirportCode: null,
  shipperId: 'shipper-1',
  shipperName: 'Acme Exports',
  consigneeId: 'consignee-1',
  consigneeName: 'Acme Imports',
  commodityId: 'commodity-1',
  commodityName: 'Edible Fish',
  flightDate: '2026-08-04',
  handlingDate: null,
  depTime: '14:00',
  cutoffTime: '09:00',
  cusdecNo: null,
  boxCount: null,
  weightKg: null,
  appliedBuyingRate: null,
  appliedBuyingRateId: null,
  actualDepartureAt: null,
  status: 'PENDING',
  version: 0,
  createdByUserId: 'user-1',
  createdAt: '2026-08-01T00:00:00.000Z',
  updatedAt: '2026-08-01T00:00:00.000Z',
};

const baseAlert: CutoffAlert = {
  id: 'alert-1',
  shipmentId: 'shipment-1',
  state: 'APPROACHING',
  raisedAt: '2026-08-04T03:30:00.000Z',
  acknowledgedAt: null,
  acknowledgedByUserId: null,
  resolvedAt: null,
};

function renderIndicator(shipment: Shipment, alert: CutoffAlert | undefined) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <CutoffIndicator shipment={shipment} alert={alert} />
    </QueryClientProvider>,
  );
}

describe('CutoffIndicator', () => {
  afterEach(() => {
    useAuthStore.setState({ permissions: new Set() });
  });

  it('renders nothing for Normal (no alert, no actual departure)', () => {
    const { container } = renderIndicator(baseShipment, undefined);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows the Approaching badge and countdown', () => {
    renderIndicator(baseShipment, baseAlert);
    expect(screen.getByText('Approaching')).toBeInTheDocument();
    expect(screen.getByText(/Departs in|Departure was/)).toBeInTheDocument();
  });

  it('shows the Acknowledge button only when the caller has permission and it is unacknowledged', () => {
    useAuthStore.setState({ permissions: new Set(['cutoff.acknowledge']) });
    renderIndicator(baseShipment, baseAlert);
    expect(screen.getByRole('button', { name: 'Acknowledge' })).toBeInTheDocument();
  });

  it('hides the Acknowledge button without permission', () => {
    renderIndicator(baseShipment, baseAlert);
    expect(screen.queryByRole('button', { name: 'Acknowledge' })).not.toBeInTheDocument();
  });

  it('hides the Acknowledge button once already acknowledged', () => {
    useAuthStore.setState({ permissions: new Set(['cutoff.acknowledge']) });
    renderIndicator(baseShipment, {
      ...baseAlert,
      acknowledgedAt: '2026-08-04T03:35:00.000Z',
      acknowledgedByUserId: 'user-2',
    });
    expect(screen.queryByRole('button', { name: 'Acknowledge' })).not.toBeInTheDocument();
  });

  it('shows Passed when actualDepartureAt is set, regardless of the active-alerts list', () => {
    renderIndicator({ ...baseShipment, actualDepartureAt: '2026-08-04T08:35:00.000Z' }, undefined);
    expect(screen.getByText('Passed')).toBeInTheDocument();
    expect(screen.queryByText(/Departs in|Departure was/)).not.toBeInTheDocument();
  });
});
