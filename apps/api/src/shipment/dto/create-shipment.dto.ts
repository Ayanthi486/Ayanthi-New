import { createShipmentRequestSchema } from '@hub-lanka/shared';
import { createZodDto } from 'nestjs-zod';

export class CreateShipmentDto extends createZodDto(createShipmentRequestSchema) {}
