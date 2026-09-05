import { createRateRequestSchema } from '@hub-lanka/shared';
import { createZodDto } from 'nestjs-zod';

export class CreateRateDto extends createZodDto(createRateRequestSchema) {}
