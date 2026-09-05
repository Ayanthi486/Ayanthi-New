import { analyticsFilterQuerySchema } from '@hub-lanka/shared';
import { createZodDto } from 'nestjs-zod';

export class AnalyticsFilterQueryDto extends createZodDto(analyticsFilterQuerySchema) {}
