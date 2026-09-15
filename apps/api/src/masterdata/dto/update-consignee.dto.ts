import { updateConsigneeRequestSchema } from '@hub-lanka/shared';
import { createZodDto } from 'nestjs-zod';

export class UpdateConsigneeDto extends createZodDto(updateConsigneeRequestSchema) {}