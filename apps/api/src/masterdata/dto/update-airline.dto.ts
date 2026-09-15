import { updateAirlineRequestSchema } from '@hub-lanka/shared';
import { createZodDto } from 'nestjs-zod';

export class UpdateAirlineDto extends createZodDto(updateAirlineRequestSchema) {}