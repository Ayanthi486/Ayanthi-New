import { createCommodityRequestSchema } from '@hub-lanka/shared';
import { createZodDto } from 'nestjs-zod';

export class CreateCommodityDto extends createZodDto(createCommodityRequestSchema) {}
