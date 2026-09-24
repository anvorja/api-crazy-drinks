export type DomainErrorKind =
  | 'validation'
  | 'unauthorized'
  | 'forbidden'
  | 'not_found'
  | 'conflict'
  | 'plan_limit'
  | 'rate_limited'
  | 'unavailable';

/** Base error for business rules. Infrastructure translates `kind` to a transport status. */
export abstract class DomainError extends Error {
  abstract readonly kind: DomainErrorKind;

  constructor(message: string) {
    super(message);
    this.name = new.target.name;
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
  ) {
    super(message);
  }
}

export class UnavailableError extends DomainError {
  readonly kind = 'unavailable';
}
