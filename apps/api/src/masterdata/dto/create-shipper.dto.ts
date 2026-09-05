import { createShipperRequestSchema } from '@hub-lanka/shared';
import { createZodDto } from 'nestjs-zod';

export class CreateShipperDto extends createZodDto(createShipperRequestSchema) {}
