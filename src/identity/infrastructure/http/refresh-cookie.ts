import { Inject, Injectable } from '@nestjs/common';
import type { Request, Response } from 'express';
import { UnauthorizedError } from '../../../shared/domain/errors.js';
import { ENV } from '../../../shared/infrastructure/config/config.module.js';
import type { Env } from '../../../shared/infrastructure/config/env.js';
import { API_VERSION } from '../../../shared/infrastructure/http/configure-app.js';

const COOKIE_NAME = 'refresh_token';
/** Only auth endpoints ever receive it. */
const COOKIE_PATH = `/v${API_VERSION}/auth`;
const DAY_MS = 86_400_000;

/** Reads a cookie from the raw header (the API needs just this one, no parser middleware). */
function readCookie(request: Request, name: string): string | undefined {
  for (const part of (request.headers.cookie ?? '').split(';')) {
    const [key, ...value] = part.trim().split('=');
    if (key === name) return decodeURIComponent(value.join('='));
  }
  return undefined;
}

/**
 * The refresh token for browsers: httpOnly (JavaScript can't read it, so XSS can't steal it),
 * scoped to /v1/auth, and only accepted from the allowed frontend origins (CSRF defense).
 */
@Injectable()
export class RefreshCookie {
  constructor(@Inject(ENV) private readonly env: Env) {}

  set(response: Response, token: string): void {
    response.cookie(COOKIE_NAME, token, {
      httpOnly: true,
      secure: this.env.REFRESH_COOKIE_SECURE,
      sameSite: this.env.REFRESH_COOKIE_SAMESITE,
      domain: this.env.REFRESH_COOKIE_DOMAIN,
      path: COOKIE_PATH,
      maxAge: this.env.REFRESH_TOKEN_TTL_DAYS * DAY_MS,
    });
  }

  clear(response: Response): void {
    response.clearCookie(COOKIE_NAME, {
      httpOnly: true,
      secure: this.env.REFRESH_COOKIE_SECURE,
      sameSite: this.env.REFRESH_COOKIE_SAMESITE,
      domain: this.env.REFRESH_COOKIE_DOMAIN,
      path: COOKIE_PATH,
    });
  }

  /** The token from the cookie, after checking the request comes from an allowed frontend. */
  read(request: Request): string | undefined {
    const token = readCookie(request, COOKIE_NAME);
    if (!token) return undefined;
    const origin = request.headers.origin;
    if (!origin || !this.env.CORS_ORIGINS.includes(origin)) {
      throw new UnauthorizedError(
        'The session cookie is only accepted from the allowed frontend origins',
        'ORIGIN_NOT_ALLOWED',
      );
    }
    return token;
  }
}
