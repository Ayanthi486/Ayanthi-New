import { reviewCancellationRequestInputSchema } from '@hub-lanka/shared';
import { createZodDto } from 'nestjs-zod';

export class ReviewCancellationDto extends createZodDto(reviewCancellationRequestInputSchema) {}
