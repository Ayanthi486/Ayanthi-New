import { updateCommodityRequestSchema } from '@hub-lanka/shared';
import { createZodDto } from 'nestjs-zod';

export class UpdateCommodityDto extends createZodDto(updateCommodityRequestSchema) {}
