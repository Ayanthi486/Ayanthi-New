import { updateShipperRequestSchema } from '@hub-lanka/shared';
import { createZodDto } from 'nestjs-zod';

export class UpdateShipperDto extends createZodDto(updateShipperRequestSchema) {}