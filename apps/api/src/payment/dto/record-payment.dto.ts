import { recordPaymentRequestSchema } from '@hub-lanka/shared';
import { createZodDto } from 'nestjs-zod';

export class RecordPaymentDto extends createZodDto(recordPaymentRequestSchema) {}
