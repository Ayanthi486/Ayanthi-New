import { createAirlineRequestSchema } from '@hub-lanka/shared';
import { createZodDto } from 'nestjs-zod';

export class CreateAirlineDto extends createZodDto(createAirlineRequestSchema) {}
