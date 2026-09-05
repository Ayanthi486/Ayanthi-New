import type {
  CancellationRequest,
  CreateShipmentRequest,
  SetCargoRequest,
  Shipment,
  ShipmentListQuery,
  ShipmentListResponse,
  UpdateShipmentRequest,
} from '@hub-lanka/shared';
import { apiFetch } from '@/lib/apiClient';

function toQueryString(query: ShipmentListQuery): string {
  const params = new URLSearchParams();
  if (query.search) params.set('search', query.search);
  if (query.dateFrom) params.set('dateFrom', query.dateFrom);
  if (query.dateTo) params.set('dateTo', query.dateTo);
  if (query.page) params.set('page', String(query.page));
  if (query.pageSize) params.set('pageSize', String(query.pageSize));
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

export async function listShipments(query: ShipmentListQuery = {}): Promise<ShipmentListResponse> {
  return apiFetch<ShipmentListResponse>(`/shipments${toQueryString(query)}`);
}

export async function getShipment(id: string): Promise<Shipment> {
  return apiFetch<Shipment>(`/shipments/${id}`);
}

export async function createShipment(input: CreateShipmentRequest): Promise<Shipment> {
  return apiFetch<Shipment>('/shipments', { method: 'POST', body: JSON.stringify(input) });
}

export async function updateShipment(id: string, input: UpdateShipmentRequest): Promise<Shipment> {
  return apiFetch<Shipment>(`/shipments/${id}`, { method: 'PATCH', body: JSON.stringify(input) });
}

export async function deleteShipment(id: string): Promise<Shipment> {
  return apiFetch<Shipment>(`/shipments/${id}`, { method: 'DELETE' });
}

export async function requestCancellation(
  id: string,
  reason: string,
): Promise<CancellationRequest> {
  return apiFetch<CancellationRequest>(`/shipments/${id}/cancellation-request`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  });
}

export async function listCancellationQueue(): Promise<CancellationRequest[]> {
  return apiFetch<CancellationRequest[]>('/shipments/cancellation-requests?status=PENDING');
}

export async function reviewCancellation(
  requestId: string,
  decision: 'approve' | 'reject',
  note?: string,
): Promise<CancellationRequest> {
  return apiFetch<CancellationRequest>(
    `/shipments/cancellation-requests/${requestId}/${decision}`,
    {
      method: 'POST',
      body: JSON.stringify({ note }),
    },
  );
}

export async function completeShipment(id: string): Promise<Shipment> {
  return apiFetch<Shipment>(`/shipments/${id}/complete`, { method: 'POST' });
}

/** BR-06: the only place BOX/WEIGHT can be entered or edited (cargo module, Phase 3). */
export async function setCargo(id: string, input: SetCargoRequest): Promise<Shipment> {
  return apiFetch<Shipment>(`/shipments/${id}/cargo`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

/** BR-44: Manager-only capture of the airline's currently effective rate onto this shipment. */
export async function captureBuyingRate(id: string): Promise<Shipment> {
  return apiFetch<Shipment>(`/shipments/${id}/buying-rate`, { method: 'POST' });
}

/** BR-50/OQ-11: sets `actualDepartureAt` once and resolves any active cut-off alert to Passed. Immutable — 423 on a second attempt. */
export async function recordActualDeparture(id: string): Promise<Shipment> {
  return apiFetch<Shipment>(`/shipments/${id}/actual-departure`, { method: 'POST' });
}
