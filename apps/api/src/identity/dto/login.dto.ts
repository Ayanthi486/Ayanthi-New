import { loginRequestSchema } from '@hub-lanka/shared';
import { createZodDto } from 'nestjs-zod';

export class LoginDto extends createZodDto(loginRequestSchema) {}
