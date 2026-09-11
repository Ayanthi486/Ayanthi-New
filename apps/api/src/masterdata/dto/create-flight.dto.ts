import { createFlightRequestSchema } from '@hub-lanka/shared';
import { createZodDto } from 'nestjs-zod';

export class CreateFlightDto extends createZodDto(createFlightRequestSchema) {}
