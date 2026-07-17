export class AppError extends Error {
  constructor(
    public readonly message: string,
    public readonly statusCode: number,
    public readonly code: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: unknown) {
    super(message, 400, 'VALIDATION_ERROR', details);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Authentication required') {
    super(message, 401, 'UNAUTHORIZED');
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Insufficient permissions') {
    super(message, 403, 'FORBIDDEN');
  }
}

export class NotFoundError extends AppError {
  constructor(entity: string, id?: string | bigint) {
    super(
      id ? `${entity} '${id}' not found` : `${entity} not found`,
      404,
      'NOT_FOUND',
    );
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, 409, 'CONFLICT');
  }
}

export class BusinessRuleError extends AppError {
  constructor(message: string, details?: unknown) {
    super(message, 422, 'BUSINESS_RULE_VIOLATION', details);
  }
}

export class InvalidTransitionError extends AppError {
  constructor(from: string, to: string, entity?: string) {
    super(
      `Cannot transition ${entity ? `${entity} ` : ''}from '${from}' to '${to}'`,
      422,
      'INVALID_TRANSITION',
    );
  }
}

export class TooManyRequestsError extends AppError {
  constructor(message = 'Too many requests') {
    super(message, 429, 'TOO_MANY_REQUESTS');
  }
}

/**
 * Maps domain errors to HTTP status codes for the Express error handler.
 */
export function isAppError(err: unknown): err is AppError {
  return err instanceof AppError;
}
