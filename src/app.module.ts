import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { BillingModule } from './billing/infrastructure/billing.module.js';
import { DrinksModule } from './drinks/infrastructure/drinks.module.js';
import { HealthModule } from './health/infrastructure/health.module.js';
import { IdentityModule } from './identity/infrastructure/identity.module.js';
import { ConfigModule } from './shared/infrastructure/config/config.module.js';
import { DatabaseModule } from './shared/infrastructure/database/database.module.js';
import { CacheControlInterceptor } from './shared/infrastructure/http/cache-control.js';
import { ApiExceptionFilter } from './shared/infrastructure/http/api-exception.filter.js';
import { APP_NAME, APP_VERSION } from './shared/infrastructure/app-info.js';
import {
  ERROR_REPORTER,
  NoopErrorReporter,
  SentryErrorReporter,
} from './shared/infrastructure/observability/error-reporter.js';
import { Metrics } from './shared/infrastructure/observability/metrics.js';
import { RequestContextMiddleware } from './shared/infrastructure/observability/request-context.middleware.js';
import { IndexController } from './shared/infrastructure/http/index.controller.js';
import { SystemModule } from './shared/infrastructure/system.module.js';
import { ENV } from './shared/infrastructure/config/config.module.js';
import type { Env } from './shared/infrastructure/config/env.js';
import {
  DRIZZLE,
  type Database,
} from './shared/infrastructure/database/database.module.js';
import {
  RATE_LIMIT_STORE,
  RateLimitMiddleware,
} from './shared/infrastructure/rate-limit/rate-limit.middleware.js';
import {
  InMemoryRateLimitStore,
  PostgresRateLimitStore,
} from './shared/infrastructure/rate-limit/rate-limit.store.js';
import { MailModule } from './shared/infrastructure/mail/mail.module.js';
import { VenuesModule } from './venues/infrastructure/venues.module.js';

@Module({
  imports: [
    ConfigModule,
    SystemModule,
    MailModule,
    DatabaseModule,
    IdentityModule,
    BillingModule,
    DrinksModule,
    VenuesModule,
    HealthModule,
  ],
  controllers: [IndexController],
  providers: [
    { provide: APP_FILTER, useClass: ApiExceptionFilter },
    { provide: APP_INTERCEPTOR, useClass: CacheControlInterceptor },
    {
      provide: RATE_LIMIT_STORE,
      useFactory: (env: Env, db: Database) =>
        env.RATE_LIMIT_STORE === 'postgres'
          ? new PostgresRateLimitStore(db)
          : new InMemoryRateLimitStore(),
      inject: [ENV, DRIZZLE],
    },
    RateLimitMiddleware,
    Metrics,
    RequestContextMiddleware,
    {
      provide: ERROR_REPORTER,
      useFactory: (env: Env) =>
        env.SENTRY_DSN
          ? new SentryErrorReporter({
              dsn: env.SENTRY_DSN,
              environment: env.NODE_ENV,
              release: `${APP_NAME}@${APP_VERSION}`,
            })
          : new NoopErrorReporter(),
      inject: [ENV],
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    // First on every request: request id + access log, then the rate limit, both before
    // authentication or any database work.
    consumer
      .apply(RequestContextMiddleware, RateLimitMiddleware)
      .forRoutes('*path');
  }
}
