import { updateUserRequestSchema } from '@hub-lanka/shared';
import { createZodDto } from 'nestjs-zod';

export class UpdateUserDto extends createZodDto(updateUserRequestSchema) {}
