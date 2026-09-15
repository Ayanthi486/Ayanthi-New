import { updateFlightRequestSchema } from '@hub-lanka/shared';
import { createZodDto } from 'nestjs-zod';

export class UpdateFlightDto extends createZodDto(updateFlightRequestSchema) {}
