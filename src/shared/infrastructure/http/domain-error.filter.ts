import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
} from '@nestjs/common';
import type { Response } from 'express';
import {
  DomainError,
  DomainErrorKind,
  RateLimitedError,
} from '../../domain/errors.js';

const STATUS: Record<DomainErrorKind, HttpStatus> = {
  validation: HttpStatus.BAD_REQUEST,
  unauthorized: HttpStatus.UNAUTHORIZED,
  forbidden: HttpStatus.FORBIDDEN,
  not_found: HttpStatus.NOT_FOUND,
  conflict: HttpStatus.CONFLICT,
  plan_limit: HttpStatus.PAYMENT_REQUIRED,
  rate_limited: HttpStatus.TOO_MANY_REQUESTS,
  unavailable: HttpStatus.SERVICE_UNAVAILABLE,
};

/** Translates domain errors into HTTP responses with Nest's usual error shape. */
@Catch(DomainError)
export class DomainErrorFilter implements ExceptionFilter {
  catch(error: DomainError, host: ArgumentsHost): void {
    const status = STATUS[error.kind];
    const response = host.switchToHttp().getResponse<Response>();
    if (error instanceof RateLimitedError) {
      response.setHeader('Retry-After', String(error.retryAfterSeconds));
    }
    response
      .status(status)
      .json({ statusCode: status, message: error.message, error: error.name });
  }
}
