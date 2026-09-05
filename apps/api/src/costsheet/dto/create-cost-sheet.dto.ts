import { createCostSheetRequestSchema } from '@hub-lanka/shared';
import { createZodDto } from 'nestjs-zod';

export class CreateCostSheetDto extends createZodDto(createCostSheetRequestSchema) {}
