import { Controller, Get, Query, StreamableFile } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { AnalyticsShipmentRow, AnalyticsSummaryResponse } from '@hub-lanka/shared';
import { RequirePermission } from '../identity/decorators/require-permission.decorator';
import { AnalyticsService } from './analytics.service';
import { AnalyticsFilterQueryDto } from './dto/analytics-filter-query.dto';
import { AnalyticsSummaryQueryDto } from './dto/analytics-summary-query.dto';

function csvFile(content: string, filename: string): StreamableFile {
  return new StreamableFile(Buffer.from(content, 'utf-8'), {
    type: 'text/csv; charset=utf-8',
    disposition: `attachment; filename="${filename}"`,
  });
}

@ApiTags('analytics')
@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  /** Drill-through list — PRD §10: "every figure must reconcile exactly with the underlying records." */
  @Get('shipments')
  @RequirePermission('analytics.view')
  async shipments(
    @Query() filters: AnalyticsFilterQueryDto,
    @Query('format') format?: string,
  ): Promise<AnalyticsShipmentRow[] | StreamableFile> {
    if (format === 'csv') {
      return csvFile(
        await this.analyticsService.exportShipmentsCsv(filters),
        'shipment-report.csv',
      );
    }
    return this.analyticsService.queryShipmentReport(filters);
  }

  @Get('summary')
  @RequirePermission('analytics.view')
  async summary(
    @Query() query: AnalyticsSummaryQueryDto,
    @Query('format') format?: string,
  ): Promise<AnalyticsSummaryResponse | StreamableFile> {
    const { groupBy, ...filters } = query;
    if (format === 'csv') {
      return csvFile(
        await this.analyticsService.exportSummaryCsv(filters, groupBy),
        `analytics-summary-${groupBy}.csv`,
      );
    }
    return this.analyticsService.getSummary(filters, groupBy);
  }
}
