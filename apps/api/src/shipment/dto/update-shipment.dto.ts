import { updateShipmentRequestSchema } from '@hub-lanka/shared';
import { createZodDto } from 'nestjs-zod';

export class UpdateShipmentDto extends createZodDto(updateShipmentRequestSchema) {}
