import { createUserRequestSchema } from '@hub-lanka/shared';
import { createZodDto } from 'nestjs-zod';

export class CreateUserDto extends createZodDto(createUserRequestSchema) {}
