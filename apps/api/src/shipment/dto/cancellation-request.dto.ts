import { cancellationRequestInputSchema } from '@hub-lanka/shared';
import { createZodDto } from 'nestjs-zod';

export class CancellationRequestDto extends createZodDto(cancellationRequestInputSchema) {}
