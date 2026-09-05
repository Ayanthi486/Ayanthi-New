import { assignRoleRequestSchema } from '@hub-lanka/shared';
import { createZodDto } from 'nestjs-zod';

export class AssignRoleDto extends createZodDto(assignRoleRequestSchema) {}
