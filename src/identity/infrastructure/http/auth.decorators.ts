import {
  ExecutionContext,
  SetMetadata,
  createParamDecorator,
} from '@nestjs/common';
import type { Request } from 'express';
import { Principal } from '../../domain/principal.js';
import { Role } from '../../domain/role.js';

export const AUTH_REQUIREMENT = 'auth:requirement';

export interface AuthRequirement {
  /** Empty = any authenticated user. */
  roles: Role[];
  /** API keys are for data integrations; account management needs a user session. */
  allowApiKey: boolean;
}

export type RequestWithPrincipal = Request & { principal?: Principal | null };

/** Requires credentials. By default only a JWT; pass allowApiKey to also accept X-API-Key. */
export const Authenticated = (options: { allowApiKey?: boolean } = {}) =>
  SetMetadata(AUTH_REQUIREMENT, {
    roles: [],
    allowApiKey: options.allowApiKey ?? false,
  } satisfies AuthRequirement);

/** Requires a JWT with one of these roles. */
export const Roles = (...roles: Role[]) =>
  SetMetadata(AUTH_REQUIREMENT, {
    roles,
    allowApiKey: false,
  } satisfies AuthRequirement);

export const principalFrom = (context: ExecutionContext): Principal | null =>
  context.switchToHttp().getRequest<RequestWithPrincipal>().principal ?? null;

/** The authenticated principal, or null for anonymous requests. */
export const CurrentPrincipal = createParamDecorator(
  (_: unknown, context: ExecutionContext): Principal | null =>
    principalFrom(context),
);
