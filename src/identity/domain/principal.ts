import {
  ForbiddenError,
  UnauthorizedError,
} from '../../shared/domain/errors.js';
import { Role } from './role.js';
import { User, isAdult } from './user.js';

/** Who is making a request, as proven by an access token. */
export interface Principal {
  userId: string;
  role: Role;
  adult: boolean;
  /** How the request authenticated: first-party access token or third-party API key. */
  via: 'token' | 'api_key';
}

export const principalOf = (
  user: User,
  today: Date,
  via: Principal['via'] = 'token',
): Principal => ({
  userId: user.id,
  role: user.role,
  adult: isAdult(user, today),
  via,
});

/** Alcohol is only shown to authenticated adults. */
export const canSeeAlcohol = (principal: Principal | null): boolean =>
  principal?.adult === true;

export function requireRole(
  principal: Principal | null,
  ...roles: Role[]
): Principal {
  if (!principal)
    throw new UnauthorizedError('Authentication required', 'AUTH_REQUIRED');
  if (!roles.includes(principal.role)) {
    throw new ForbiddenError(
      `Requires one of these roles: ${roles.join(', ')}`,
      'ROLE_REQUIRED',
    );
  }
  return principal;
}
