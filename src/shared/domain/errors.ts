/**
 * Stable, machine-readable error codes. Clients switch on `code` (and show their own,
 * translated text); `message` is a human hint in English and may change.
 */
export const ERROR_CODES = [
  // Generic, one per kind
  'VALIDATION_ERROR',
  'UNAUTHORIZED',
  'FORBIDDEN',
  'NOT_FOUND',
  'CONFLICT',
  'PLAN_LIMIT',
  'RATE_LIMITED',
  'UNAVAILABLE',
  // Request shape and transport (infrastructure)
  'VALIDATION_FAILED',
  'ROUTE_NOT_FOUND',
  'PAYLOAD_TOO_LARGE',
  'INTERNAL_ERROR',
  // Authentication and authorization
  'AUTH_REQUIRED',
  'INVALID_CREDENTIALS',
  'INVALID_ACCESS_TOKEN',
  'INVALID_REFRESH_TOKEN',
  'INVALID_API_KEY',
  'API_KEY_NOT_ALLOWED',
  'AMBIGUOUS_CREDENTIALS',
  'ORIGIN_NOT_ALLOWED',
  'ROLE_REQUIRED',
  'AGE_RESTRICTED',
  'LOGIN_LOCKED',
  'API_QUOTA_EXCEEDED',
  // Accounts
  'EMAIL_TAKEN',
  'INVALID_EMAIL',
  'WEAK_PASSWORD',
  'INVALID_BIRTH_DATE',
  'ADMIN_SELF_DEMOTION',
  'USER_NOT_FOUND',
  // Drinks
  'DRINK_NOT_FOUND',
  'MOOD_NOT_FOUND',
  'CATALOG_UNAVAILABLE',
  'NO_TASTE_YET',
  'TASTE_LINK_NOT_FOUND',
  'OWN_TASTE_LINK',
  'GAME_OVER',
  'DUPLICATE_GUESS',
  // Venues
  'VENUE_NOT_FOUND',
  'NOT_VENUE_OWNER',
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

export type DomainErrorKind =
  | 'validation'
  | 'unauthorized'
  | 'forbidden'
  | 'not_found'
  | 'conflict'
  | 'plan_limit'
  | 'rate_limited'
  | 'unavailable';

const DEFAULT_CODES: Record<DomainErrorKind, ErrorCode> = {
  validation: 'VALIDATION_ERROR',
  unauthorized: 'UNAUTHORIZED',
  forbidden: 'FORBIDDEN',
  not_found: 'NOT_FOUND',
  conflict: 'CONFLICT',
  plan_limit: 'PLAN_LIMIT',
  rate_limited: 'RATE_LIMITED',
  unavailable: 'UNAVAILABLE',
};

/** Base error for business rules. Infrastructure translates `kind` to a transport status. */
export abstract class DomainError extends Error {
  abstract readonly kind: DomainErrorKind;
  private readonly specificCode?: ErrorCode;

  constructor(message: string, code?: ErrorCode) {
    super(message);
    this.name = new.target.name;
    this.specificCode = code;
  }

  get code(): ErrorCode {
    return this.specificCode ?? DEFAULT_CODES[this.kind];
  }
}

export class ValidationError extends DomainError {
  readonly kind = 'validation';
}

export class UnauthorizedError extends DomainError {
  readonly kind = 'unauthorized';
}

export class ForbiddenError extends DomainError {
  readonly kind = 'forbidden';
}

export class NotFoundError extends DomainError {
  readonly kind = 'not_found';
}

export class ConflictError extends DomainError {
  readonly kind = 'conflict';
}

/** The action exists but the user's plan doesn't include it (or its quota is used up). */
export class PlanLimitError extends DomainError {
  readonly kind = 'plan_limit';
}

export class RateLimitedError extends DomainError {
  readonly kind = 'rate_limited';

  constructor(
    message: string,
    readonly retryAfterSeconds: number,
    code?: ErrorCode,
  ) {
    super(message, code);
  }
}

export class UnavailableError extends DomainError {
  readonly kind = 'unavailable';
}
