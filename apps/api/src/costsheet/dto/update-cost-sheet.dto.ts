import { updateCostSheetRequestSchema } from '@hub-lanka/shared';
import { createZodDto } from 'nestjs-zod';

export class UpdateCostSheetDto extends createZodDto(updateCostSheetRequestSchema) {}
