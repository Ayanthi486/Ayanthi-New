import { createAirportRequestSchema } from '@hub-lanka/shared';
import { createZodDto } from 'nestjs-zod';

export class CreateAirportDto extends createZodDto(createAirportRequestSchema) {}
