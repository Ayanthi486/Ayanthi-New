import { HttpStatus } from '@nestjs/common';

/**
 * Base of the application error hierarchy (ARCHITECTURE §19). Business code
 * throws one of the subclasses below instead of a bare `Error` or a raw
 * `HttpException`; `AllExceptionsFilter` maps each to a stable HTTP status
 * and a machine-readable `code` so the frontend can branch without parsing
 * message text.
 */
export abstract class AppError extends Error {
  abstract readonly code: string;
  abstract readonly httpStatus: HttpStatus;
  readonly details?: unknown;

  constructor(message: string, details?: unknown) {
    super(message);
    this.name = new.target.name;
    this.details = details;
  }
}

export class ValidationError extends AppError {
  readonly code = 'VALIDATION_ERROR';
  readonly httpStatus = HttpStatus.BAD_REQUEST;
}

export class NotFoundError extends AppError {
  readonly code = 'NOT_FOUND';
  readonly httpStatus = HttpStatus.NOT_FOUND;
}

export class ForbiddenError extends AppError {
  readonly code = 'FORBIDDEN';
  readonly httpStatus = HttpStatus.FORBIDDEN;
}

/** A confirmed business rule (PRD.md) was violated. */
export class BusinessRuleError extends AppError {
  readonly code = 'BUSINESS_RULE_VIOLATION';
  readonly httpStatus = HttpStatus.UNPROCESSABLE_ENTITY;
}

export class ConflictError extends AppError {
  readonly code = 'CONFLICT';
  readonly httpStatus = HttpStatus.CONFLICT;
}

/** Attempted write against a Completed shipment or similarly locked record. */
export class LockedError extends AppError {
  readonly code = 'LOCKED';
  readonly httpStatus = HttpStatus.LOCKED;
}
