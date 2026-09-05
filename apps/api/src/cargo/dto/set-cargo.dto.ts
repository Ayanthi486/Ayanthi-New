import { setCargoRequestSchema } from '@hub-lanka/shared';
import { createZodDto } from 'nestjs-zod';

export class SetCargoDto extends createZodDto(setCargoRequestSchema) {}
