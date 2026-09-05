import { useState } from 'react';
import {
  ANALYTICS_GROUP_BY,
  ANALYTICS_PERIODS,
  type AnalyticsFilterQuery,
} from '@hub-lanka/shared';
import { Button } from '@/components/ui/button';
import {
  downloadAnalyticsSummaryCsv,
  downloadShipmentReportCsv,
} from '@/features/analytics/api/analyticsApi';
import { AnalyticsFilters } from '@/features/analytics/components/AnalyticsFilters';
import { ShipmentReportTable } from '@/features/analytics/components/ShipmentReportTable';
import { SummaryChart } from '@/features/analytics/components/SummaryChart';
import { useAnalyticsSummary, useShipmentReport } from '@/features/analytics/hooks/useAnalytics';

const DIMENSION_LABELS: Record<(typeof ANALYTICS_GROUP_BY)[number], string> = {
  time: 'Time',
  commodity: 'Commodity',
  airline: 'Airline',
  shipper: 'Shipper',
};

const PERIOD_LABELS: Record<(typeof ANALYTICS_PERIODS)[number], string> = {
  day: 'Daily',
  week: 'Weekly',
  month: 'Monthly',
  year: 'Yearly',
};

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/** Manager + Director dashboard (PRD §10) — one dimension tab set behind the shared `analytics.view` permission (decision #5, Phase 9 report). */
export function AnalyticsPage() {
  const [filters, setFilters] = useState<AnalyticsFilterQuery>({});
  const [groupBy, setGroupBy] = useState<(typeof ANALYTICS_GROUP_BY)[number]>('time');
  const [period, setPeriod] = useState<(typeof ANALYTICS_PERIODS)[number]>('month');

  const summaryQuery = useAnalyticsSummary(
    filters,
    groupBy,
    groupBy === 'time' ? period : undefined,
  );
  const shipmentsQuery = useShipmentReport(filters);

  const exportSummary = () => {
    void downloadAnalyticsSummaryCsv(
      filters,
      groupBy,
      groupBy === 'time' ? period : undefined,
    ).then((blob) => triggerDownload(blob, `analytics-summary-${groupBy}.csv`));
  };

  const exportShipments = () => {
    void downloadShipmentReportCsv(filters).then((blob) =>
      triggerDownload(blob, 'shipment-report.csv'),
    );
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Analytics</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Weight, revenue, buying cost, operational expenses and profit — every figure reconciles
          with the shipment list below for the same filters (PRD §10).
        </p>
      </div>

      <AnalyticsFilters value={filters} onChange={setFilters} />

      <div className="flex flex-wrap items-center justify-between gap-2 border-b">
        <div className="flex flex-wrap gap-1">
          {ANALYTICS_GROUP_BY.map((dimension) => (
            <button
              key={dimension}
              type="button"
              onClick={() => setGroupBy(dimension)}
              className={`rounded-t px-3 py-1.5 text-sm ${
                groupBy === dimension
                  ? 'border-primary text-foreground border-b-2 font-medium'
                  : 'text-muted-foreground'
              }`}
            >
              {DIMENSION_LABELS[dimension]}
            </button>
          ))}
        </div>
        {groupBy === 'time' && (
          <select
            className="border-input h-8 rounded-md border bg-transparent px-2 text-sm"
            value={period}
            onChange={(e) => setPeriod(e.target.value as (typeof ANALYTICS_PERIODS)[number])}
          >
            {ANALYTICS_PERIODS.map((p) => (
              <option key={p} value={p}>
                {PERIOD_LABELS[p]}
              </option>
            ))}
          </select>
        )}
      </div>

      {summaryQuery.isLoading && <p className="text-muted-foreground text-sm">Loading…</p>}
      {summaryQuery.data && (
        <SummaryChart groups={summaryQuery.data.groups} totals={summaryQuery.data.totals} />
      )}

      <div className="flex items-center justify-between">
        <h2 className="font-medium">Shipments (drill-through)</h2>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={exportSummary}>
            Export summary CSV
          </Button>
          <Button variant="outline" size="sm" onClick={exportShipments}>
            Export shipments CSV
          </Button>
        </div>
      </div>
      <ShipmentReportTable rows={shipmentsQuery.data ?? []} isLoading={shipmentsQuery.isLoading} />
    </div>
  );
}
