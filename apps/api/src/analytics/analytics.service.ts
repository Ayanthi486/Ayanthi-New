import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type {
  AnalyticsGroupBy,
  AnalyticsShipmentRow,
  AnalyticsSummaryResponse,
} from '@hub-lanka/shared';
import type { EnvConfig } from '../config/env.validation';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { summarize, toAnalyticsRow, toCsv, type ShipmentReportViewRow } from './analytics.util';

export interface AnalyticsFilters {
  dateFrom?: string;
  dateTo?: string;
  commodityId?: string;
  airlineId?: string;
  shipperId?: string;
}

const SHIPMENT_CSV_HEADERS = [
  'Shipment No',
  'Flight Date',
  'Status',
  'Commodity',
  'Airline',
  'Consignee',
  'Shipper',
  'Destination',
  'Sales Person',
  'Weight (kg)',
  'Chargeable Weight (kg)',
  'Exchange Rate Used',
  'Revenue (USD)',
  'Revenue (LKR)',
  'Buying Cost (USD)',
  'Buying Cost (LKR)',
  'Operational Expenses (LKR)',
  'Profit (LKR)',
];

const SUMMARY_CSV_HEADERS = [
  'Group',
  'Shipment Count',
  'Weight (kg)',
  'Revenue (USD)',
  'Revenue (LKR)',
  'Buying Cost (USD)',
  'Buying Cost (LKR)',
  'Operational Expenses (LKR)',
  'Profit (LKR)',
];

/**
 * Phase 9 (Analytics and Reports), PRD §10, ARCHITECTURE §17. Every method
 * here reads `shipment_report_v` (the migration-owned report definition) —
 * this service resolves the one thing the view cannot express itself: OQ-5's
 * exchange-rate fallback, an application-config value.
 */
@Injectable()
export class AnalyticsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<EnvConfig, true>,
  ) {}

  private getFallbackExchangeRate(): number {
    return this.config.get('ANALYTICS_FALLBACK_EXCHANGE_RATE', { infer: true });
  }

  /** The single query both /analytics/shipments and /analytics/summary build on — see ARCHITECTURE §17. */
  async queryShipmentReport(filters: AnalyticsFilters): Promise<AnalyticsShipmentRow[]> {
    const conditions: Prisma.Sql[] = [];
    if (filters.dateFrom) conditions.push(Prisma.sql`flight_date >= ${filters.dateFrom}::date`);
    if (filters.dateTo) conditions.push(Prisma.sql`flight_date <= ${filters.dateTo}::date`);
    if (filters.commodityId) conditions.push(Prisma.sql`commodity_id = ${filters.commodityId}`);
    if (filters.airlineId) conditions.push(Prisma.sql`airline_id = ${filters.airlineId}`);
    if (filters.shipperId) conditions.push(Prisma.sql`shipper_id = ${filters.shipperId}`);

    const where =
      conditions.length > 0 ? Prisma.sql`WHERE ${Prisma.join(conditions, ' AND ')}` : Prisma.empty;

    const rows = await this.prisma.$queryRaw<ShipmentReportViewRow[]>(
      Prisma.sql`SELECT * FROM shipment_report_v ${where} ORDER BY flight_date ASC, shipment_no ASC`,
    );

    const fallback = this.getFallbackExchangeRate();
    return rows.map((row) => toAnalyticsRow(row, fallback));
  }

  async getSummary(
    filters: AnalyticsFilters,
    groupBy: AnalyticsGroupBy,
  ): Promise<AnalyticsSummaryResponse> {
    const rows = await this.queryShipmentReport(filters);
    const { groups, totals } = summarize(rows, groupBy);
    return {
      groupBy,
      groups,
      totals,
    };
  }

  async exportShipmentsCsv(filters: AnalyticsFilters): Promise<string> {
    const rows = await this.queryShipmentReport(filters);
    return toCsv(
      SHIPMENT_CSV_HEADERS,
      rows.map((row) => [
        row.shipmentNo,
        row.flightDate,
        row.status,
        row.commodityName,
        row.airlineName,
        row.consigneeName,
        row.shipperName,
        row.destinationAirportCode,
        row.salesPersonName,
        row.weightKg ?? '',
        row.chargeableWeightKg ?? '',
        row.exchangeRateUsed ?? '',
        row.revenueUsd,
        row.revenueLkr,
        row.buyingCostUsd,
        row.buyingCostLkr,
        row.opexLkr,
        row.profitLkr,
      ]),
    );
  }

  async exportSummaryCsv(
    filters: AnalyticsFilters,
    groupBy: AnalyticsGroupBy,
  ): Promise<string> {
    const summary = await this.getSummary(filters, groupBy);
    return toCsv(
      SUMMARY_CSV_HEADERS,
      [...summary.groups, summary.totals].map((group) => [
        group.label,
        String(group.shipmentCount),
        group.weightKg,
        group.revenueUsd,
        group.revenueLkr,
        group.buyingCostUsd,
        group.buyingCostLkr,
        group.opexLkr,
        group.profitLkr,
      ]),
    );
  }
}
