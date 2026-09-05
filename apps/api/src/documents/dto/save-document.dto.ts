import { saveDocumentRequestSchema } from '@hub-lanka/shared';
import { createZodDto } from 'nestjs-zod';

export class SaveDocumentDto extends createZodDto(saveDocumentRequestSchema) {}
