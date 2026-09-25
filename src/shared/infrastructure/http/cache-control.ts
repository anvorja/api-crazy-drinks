import {
  CallHandler,
  ExecutionContext,
  Inject,
  Injectable,
  NestInterceptor,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Response } from 'express';
import { Observable } from 'rxjs';
import { ENV } from '../config/config.module.js';
import type { Env } from '../config/env.js';

const CACHEABLE = 'http:cacheable';

/** Marks a read endpoint whose response can be cached by the client for a while. */
export const Cacheable = () => SetMetadata(CACHEABLE, true);

/**
 * Adds Cache-Control to @Cacheable() endpoints. Responses depend on who asks (age rule,
 * API key quota), so the cache is private and varies by credentials. Express already
 * sends an ETag, so revalidation is cheap (304 Not Modified).
 */
@Injectable()
export class CacheControlInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    @Inject(ENV) private readonly env: Env,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const cacheable = this.reflector.getAllAndOverride<boolean>(CACHEABLE, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (cacheable && this.env.CACHE_MAX_AGE_SECONDS > 0) {
      context
        .switchToHttp()
        .getResponse<Response>()
        .setHeader(
          'Cache-Control',
          `private, max-age=${this.env.CACHE_MAX_AGE_SECONDS}`,
        )
        .setHeader('Vary', 'Authorization, X-API-Key');
    }
    return next.handle();
  }
}
