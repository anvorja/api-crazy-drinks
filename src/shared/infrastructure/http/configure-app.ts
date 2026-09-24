import { VersioningType } from '@nestjs/common';
import helmet from 'helmet';
import type { NestExpressApplication } from '@nestjs/platform-express';
import type { Env } from '../config/env.js';

export const API_VERSION = '1';

/** HTTP setup shared by main.ts and the e2e tests, so both run the same app. */
export function configureApp(app: NestExpressApplication, env: Env): void {
  app.set('trust proxy', env.TRUST_PROXY);
  app.use(
    helmet({
      // JSON API: no pages to protect, and Swagger UI (/docs) needs inline scripts.
      contentSecurityPolicy: false,
      // The frontend (another origin) must be able to load card images.
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );
  app.useBodyParser('json', { limit: `${env.BODY_LIMIT_KB}kb` });
  // /v1/...; health checks and the index stay unversioned (see VERSION_NEUTRAL).
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: API_VERSION,
  });
  app.enableCors({
    origin: env.CORS_ORIGINS,
    // The refresh token travels in a cookie: the browser must send it cross-site.
    credentials: true,
    exposedHeaders: [
      'Retry-After',
      'RateLimit-Limit',
      'RateLimit-Remaining',
      'RateLimit-Reset',
      'X-RateLimit-Limit',
      'X-RateLimit-Remaining',
      'X-RateLimit-Reset',
    ],
  });
}
