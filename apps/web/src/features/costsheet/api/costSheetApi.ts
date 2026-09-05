import type { CostSheet, CreateCostSheetRequest, UpdateCostSheetRequest } from '@hub-lanka/shared';
import { apiFetch } from '@/lib/apiClient';

export async function getCostSheetByShipmentId(shipmentId: string): Promise<CostSheet> {
  return apiFetch<CostSheet>(`/costsheets/by-shipment/${shipmentId}`);
}

export async function createCostSheet(input: CreateCostSheetRequest): Promise<CostSheet> {
  return apiFetch<CostSheet>('/costsheets', { method: 'POST', body: JSON.stringify(input) });
}

export async function updateCostSheet(
  id: string,
  input: UpdateCostSheetRequest,
): Promise<CostSheet> {
  return apiFetch<CostSheet>(`/costsheets/${id}`, { method: 'PATCH', body: JSON.stringify(input) });
}

export async function releaseCostSheet(id: string): Promise<CostSheet> {
  return apiFetch<CostSheet>(`/costsheets/${id}/release`, { method: 'POST' });
}

export async function approveCostSheet(id: string): Promise<CostSheet> {
  return apiFetch<CostSheet>(`/costsheets/${id}/approve`, { method: 'POST' });
}
