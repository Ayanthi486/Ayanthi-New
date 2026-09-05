import { HttpStatus } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { BusinessRuleError, LockedError, NotFoundError } from './app-error';

describe('AppError hierarchy', () => {
  it('maps NotFoundError to 404', () => {
    const error = new NotFoundError('Shipment not found');
    expect(error.httpStatus).toBe(HttpStatus.NOT_FOUND);
    expect(error.code).toBe('NOT_FOUND');
  });

  it('maps BusinessRuleError to 422', () => {
    const error = new BusinessRuleError(
      'Cannot generate document. Please enter Box and Weight information.',
    );
    expect(error.httpStatus).toBe(HttpStatus.UNPROCESSABLE_ENTITY);
  });

  it('maps LockedError to 423', () => {
    const error = new LockedError('Shipment is completed and locked');
    expect(error.httpStatus).toBe(423);
  });

  it('carries optional structured details', () => {
    const error = new NotFoundError('not found', { id: 'HUB000001' });
    expect(error.details).toEqual({ id: 'HUB000001' });
  });
});
