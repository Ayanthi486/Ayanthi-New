import { shipmentListQuerySchema } from '@hub-lanka/shared';
import { createZodDto } from 'nestjs-zod';

export class ListShipmentsQueryDto extends createZodDto(shipmentListQuerySchema) {}
