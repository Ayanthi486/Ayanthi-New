import { createInvoiceRequestSchema } from '@hub-lanka/shared';
import { createZodDto } from 'nestjs-zod';

export class CreateInvoiceDto extends createZodDto(createInvoiceRequestSchema) {}
