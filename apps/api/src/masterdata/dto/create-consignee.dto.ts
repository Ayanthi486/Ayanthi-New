import { createConsigneeRequestSchema } from '@hub-lanka/shared';
import { createZodDto } from 'nestjs-zod';

export class CreateConsigneeDto extends createZodDto(createConsigneeRequestSchema) {}
