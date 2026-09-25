import { VersioningType } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import helmet from 'helmet';
import { Metrics } from '../observability/metrics.js';
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
  if (env.METRICS_ENABLED) {
    // Plain Express route: outside Nest guards, so its Bearer token is not a user JWT.
    const metrics = app.get(Metrics);
    app.use(
      '/metrics',
      async (req: Request, res: Response, next: NextFunction) => {
        if (req.method !== 'GET') return next();
        if (
          env.METRICS_TOKEN &&
          req.headers.authorization !== `Bearer ${env.METRICS_TOKEN}`
        ) {
          res.status(401).json({
            statusCode: 401,
            code: 'UNAUTHORIZED',
            message: 'Metrics token required',
            error: 'Unauthorized',
          });
          return;
        }
        res.setHeader('Content-Type', metrics.registry.contentType);
        res.send(await metrics.registry.metrics());
      },
    );
  }
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
      'X-Request-Id',
    ],
  });
}
