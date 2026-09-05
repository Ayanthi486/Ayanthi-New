import type {
  AnalyticsFilterQuery,
  AnalyticsGroupBy,
  AnalyticsPeriod,
  AnalyticsShipmentRow,
  AnalyticsSummaryResponse,
} from '@hub-lanka/shared';
import { apiFetch, ApiClientError } from '@/lib/apiClient';
import { useAuthStore } from '@/lib/authStore';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000/api/v1';

function toQueryString(params: Record<string, string | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) search.set(key, value);
  }
  const qs = search.toString();
  return qs ? `?${qs}` : '';
}

export async function getShipmentReport(
  filters: AnalyticsFilterQuery,
): Promise<AnalyticsShipmentRow[]> {
  return apiFetch<AnalyticsShipmentRow[]>(`/analytics/shipments${toQueryString(filters)}`);
}

export async function getAnalyticsSummary(
  filters: AnalyticsFilterQuery,
  groupBy: AnalyticsGroupBy,
  period?: AnalyticsPeriod,
): Promise<AnalyticsSummaryResponse> {
  return apiFetch<AnalyticsSummaryResponse>(
    `/analytics/summary${toQueryString({ ...filters, groupBy, period })}`,
  );
}

/** ARCHITECTURE §12: served only through an authenticated, permission-checked endpoint. */
async function downloadCsv(path: string): Promise<Blob> {
  const accessToken = useAuthStore.getState().accessToken;
  const response = await fetch(`${API_BASE_URL}${path}`, {
    credentials: 'include',
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
  });
  if (!response.ok) {
    throw new ApiClientError(
      'Unable to export the report.',
      'ANALYTICS_EXPORT_ERROR',
      response.status,
    );
  }
  return response.blob();
}

export async function downloadShipmentReportCsv(filters: AnalyticsFilterQuery): Promise<Blob> {
  return downloadCsv(`/analytics/shipments${toQueryString({ ...filters, format: 'csv' })}`);
}

export async function downloadAnalyticsSummaryCsv(
  filters: AnalyticsFilterQuery,
  groupBy: AnalyticsGroupBy,
  period: AnalyticsPeriod | undefined,
): Promise<Blob> {
  return downloadCsv(
    `/analytics/summary${toQueryString({ ...filters, groupBy, period, format: 'csv' })}`,
  );
}
