import { analyticsSummaryQuerySchema } from '@hub-lanka/shared';
import { createZodDto } from 'nestjs-zod';

export class AnalyticsSummaryQueryDto extends createZodDto(analyticsSummaryQuerySchema) {}
