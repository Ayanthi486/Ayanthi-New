import type {
  ChangeShipmentStatusRequest,
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

/**
 * The direct, no-approval status dropdown (Schedule grid) — replaces the
 * old cancellation-request/approve and completion-approve workflows
 * entirely. Setting DEPARTED for the first time also captures
 * `actualDepartureAt` in the same call (folds in what used to be the
 * separate "record actual departure" action).
 */
export async function changeShipmentStatus(
  id: string,
  input: ChangeShipmentStatusRequest,
): Promise<Shipment> {
  return apiFetch<Shipment>(`/shipments/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
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
