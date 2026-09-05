import { useQuery } from '@tanstack/react-query';
import type { AnalyticsFilterQuery, AnalyticsGroupBy, AnalyticsPeriod } from '@hub-lanka/shared';
import { getAnalyticsSummary, getShipmentReport } from '@/features/analytics/api/analyticsApi';

export function useShipmentReport(filters: AnalyticsFilterQuery) {
  return useQuery({
    queryKey: ['analytics', 'shipments', filters],
    queryFn: () => getShipmentReport(filters),
  });
}

export function useAnalyticsSummary(
  filters: AnalyticsFilterQuery,
  groupBy: AnalyticsGroupBy,
  period?: AnalyticsPeriod,
) {
  return useQuery({
    queryKey: ['analytics', 'summary', groupBy, period, filters],
    queryFn: () => getAnalyticsSummary(filters, groupBy, period),
  });
}
