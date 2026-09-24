import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Response } from 'express';
import {
  ForbiddenError,
  UnauthorizedError,
  ValidationError,
} from '../../../shared/domain/errors.js';
import type { AccessTokenIssuer } from '../../application/ports/security.ports.js';
import { AuthenticateApiKey } from '../../application/use-cases/api-keys.js';
import { ACCESS_TOKEN_ISSUER } from '../tokens.js';
import {
  AUTH_REQUIREMENT,
  AuthRequirement,
  RequestWithPrincipal,
} from './auth.decorators.js';

/**
 * Global guard. A request may carry a Bearer token or an X-API-Key: valid credentials
 * attach the principal, invalid ones are rejected, none means anonymous. Endpoints marked
 * with @Authenticated() or @Roles() additionally require a principal (and a role).
 * API keys charge one request to the owner's daily quota and report it in X-RateLimit-* headers.
 */
@Injectable()
export class AuthenticationGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject(ACCESS_TOKEN_ISSUER) private readonly tokens: AccessTokenIssuer,
    private readonly authenticateApiKey: AuthenticateApiKey,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const http = context.switchToHttp();
    const request = http.getRequest<RequestWithPrincipal>();
    const authorization = request.headers.authorization;
    const apiKey = request.headers['x-api-key'];

    request.principal = null;
    if (authorization && apiKey) {
      throw new ValidationError(
        'Send either Authorization or X-API-Key, not both',
      );
    }
    if (authorization) {
      const [scheme, token] = authorization.split(' ');
      if (scheme !== 'Bearer' || !token) {
        throw new UnauthorizedError('Use "Authorization: Bearer <token>"');
      }
      request.principal = await this.tokens.verify(token);
      if (!request.principal)
        throw new UnauthorizedError('Invalid or expired access token');
    } else if (typeof apiKey === 'string') {
      const { principal, quota } =
        await this.authenticateApiKey.execute(apiKey);
      request.principal = principal;
      http
        .getResponse<Response>()
        .setHeader('X-RateLimit-Limit', String(quota.limit))
        .setHeader('X-RateLimit-Remaining', String(quota.remaining))
        .setHeader('X-RateLimit-Reset', String(quota.resetsInSeconds));
    }

    const requirement = this.reflector.getAllAndOverride<
      AuthRequirement | undefined
    >(AUTH_REQUIREMENT, [context.getHandler(), context.getClass()]);
    if (!requirement) return true;
    const principal = request.principal;
    if (!principal) throw new UnauthorizedError('Authentication required');
    if (principal.via === 'api_key' && !requirement.allowApiKey) {
      throw new ForbiddenError(
        'This endpoint needs a user session (Bearer token), not an API key',
      );
    }
    if (
      requirement.roles.length &&
      !requirement.roles.includes(principal.role)
    ) {
      throw new ForbiddenError(
        `Requires one of these roles: ${requirement.roles.join(', ')}`,
      );
    }
    return true;
  }
}
