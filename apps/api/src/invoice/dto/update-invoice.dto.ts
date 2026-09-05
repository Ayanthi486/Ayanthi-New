import { updateInvoiceRequestSchema } from '@hub-lanka/shared';
import { createZodDto } from 'nestjs-zod';

export class UpdateInvoiceDto extends createZodDto(updateInvoiceRequestSchema) {}
