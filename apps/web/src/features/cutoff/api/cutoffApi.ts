import type { CutoffAlert } from '@hub-lanka/shared';
import { apiFetch } from '@/lib/apiClient';

/** No separate view permission — keyed to shipment.view like the schedule it augments. */
export async function listActiveCutoffAlerts(): Promise<CutoffAlert[]> {
  return apiFetch<CutoffAlert[]>('/cutoff/active');
}

export async function acknowledgeCutoffAlert(shipmentId: string): Promise<CutoffAlert> {
  return apiFetch<CutoffAlert>(`/shipments/${shipmentId}/cutoff/acknowledge`, { method: 'POST' });
}
