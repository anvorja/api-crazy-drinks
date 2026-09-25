import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Inject,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';
import {
  ERROR_REPORTER,
  type ErrorReporter,
} from '../observability/error-reporter.js';
import type { RequestWithId } from '../observability/request-context.middleware.js';
import {
  DomainError,
  DomainErrorKind,
  ErrorCode,
  RateLimitedError,
} from '../../domain/errors.js';
import { ValidationFailedException } from './zod-validation.pipe.js';

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

/** Codes for errors raised by the framework itself (unknown route, huge body…). */
const HTTP_CODES: Partial<Record<number, ErrorCode>> = {
  400: 'VALIDATION_ERROR',
  401: 'UNAUTHORIZED',
  403: 'FORBIDDEN',
  404: 'ROUTE_NOT_FOUND',
  409: 'CONFLICT',
  413: 'PAYLOAD_TOO_LARGE',
  429: 'RATE_LIMITED',
  503: 'UNAVAILABLE',
};

export interface ErrorBody {
  statusCode: number;
  code: ErrorCode;
  message: string;
  error: string;
  details?: { path: string; message: string }[];
  /** Same as the X-Request-Id header: quote it when reporting a problem. */
  requestId?: string;
}

/**
 * Every error leaves the API with the same shape: { statusCode, code, message, error, details? }.
 * Unexpected errors become a generic 500 (logged, never leaked).
 */
@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(ApiExceptionFilter.name);

  constructor(
    @Inject(ERROR_REPORTER) private readonly reporter: ErrorReporter,
  ) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const response = http.getResponse<Response>();
    const request = http.getRequest<RequestWithId>();
    const body = { ...this.toBody(exception, request), requestId: request.id };
    if (exception instanceof RateLimitedError) {
      response.setHeader('Retry-After', String(exception.retryAfterSeconds));
    }
    response.status(body.statusCode).json(body);
  }

  private toBody(exception: unknown, request: RequestWithId): ErrorBody {
    if (exception instanceof DomainError) {
      return {
        statusCode: STATUS[exception.kind],
        code: exception.code,
        message: exception.message,
        error: exception.name,
      };
    }
    if (exception instanceof ValidationFailedException) {
      return {
        statusCode: HttpStatus.BAD_REQUEST,
        code: 'VALIDATION_FAILED',
        message: 'The request is not valid',
        error: 'ValidationFailed',
        details: exception.details,
      };
    }
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      return {
        statusCode: status,
        code:
          HTTP_CODES[status] ??
          (status >= 500 ? 'INTERNAL_ERROR' : 'VALIDATION_ERROR'),
        message: exception.message,
        error: exception.name,
      };
    }
    const bodyError = bodyParserError(exception);
    if (bodyError) return bodyError;
    const path = request.originalUrl?.split('?')[0];
    this.logger.error({
      msg: 'unexpected error',
      requestId: request.id,
      method: request.method,
      path,
      error:
        exception instanceof Error
          ? (exception.stack ?? exception.message)
          : String(exception),
    });
    this.reporter.report(exception, {
      requestId: request.id,
      method: request.method,
      path,
    });
    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      code: 'INTERNAL_ERROR',
      message: 'Something went wrong on our side',
      error: 'InternalError',
    };
  }
}

/**
 * A body over BODY_LIMIT_KB: the JSON parser rejects it (http-errors, `type`) before Nest sees
 * the request. (Invalid JSON already arrives as a 400 from Nest's Express adapter.)
 */
function bodyParserError(exception: unknown): ErrorBody | null {
  const e = exception as { status?: unknown; type?: unknown };
  if (e?.type === 'entity.too.large') {
    return {
      statusCode: HttpStatus.PAYLOAD_TOO_LARGE,
      code: 'PAYLOAD_TOO_LARGE',
      message: 'The request body is too large',
      error: 'PayloadTooLarge',
    };
  }
  return null;
}
