import type { CreateRateRequest, RateTableEntry } from '@hub-lanka/shared';
import { apiFetch } from '@/lib/apiClient';

export async function listRates(airlineId?: string): Promise<RateTableEntry[]> {
  const qs = airlineId ? `?airlineId=${encodeURIComponent(airlineId)}` : '';
  return apiFetch<RateTableEntry[]>(`/rates${qs}`);
}

export async function createRate(input: CreateRateRequest): Promise<RateTableEntry> {
  return apiFetch<RateTableEntry>('/rates', { method: 'POST', body: JSON.stringify(input) });
}
