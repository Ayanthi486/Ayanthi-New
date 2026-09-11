import { changeShipmentStatusRequestSchema } from '@hub-lanka/shared';
import { createZodDto } from 'nestjs-zod';

export class ChangeShipmentStatusDto extends createZodDto(changeShipmentStatusRequestSchema) {}
