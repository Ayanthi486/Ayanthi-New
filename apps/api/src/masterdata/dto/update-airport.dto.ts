import { updateAirportRequestSchema } from '@hub-lanka/shared';
import { createZodDto } from 'nestjs-zod';

export class UpdateAirportDto extends createZodDto(updateAirportRequestSchema) {}
