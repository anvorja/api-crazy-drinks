import { ENV } from '../../src/shared/infrastructure/config/config.module.js';
import type { Env } from '../../src/shared/infrastructure/config/env.js';
import { configureApp } from '../../src/shared/infrastructure/http/configure-app.js';
import { InMemoryCocktleGameRepository } from '../../src/drinks/infrastructure/persistence/in-memory/in-memory-cocktle.repository.js';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { AppModule } from '../../src/app.module.js';
import {
  InMemoryPaymentRepository,
  InMemoryPlanRepository,
  InMemorySubscriptionRepository,
} from '../../src/billing/infrastructure/persistence/in-memory/in-memory-billing.repositories.js';
import {
  PAYMENT_REPOSITORY,
  PLAN_REPOSITORY,
  SUBSCRIPTION_REPOSITORY,
  WOMPI_GATEWAY,
} from '../../src/billing/infrastructure/tokens.js';
import { InMemoryDrinkRepository } from '../../src/drinks/infrastructure/persistence/in-memory/in-memory-drink.repository.js';
import {
  InMemoryFavoriteRepository,
  InMemoryReactionRepository,
  InMemoryUserPantryRepository,
} from '../../src/drinks/infrastructure/persistence/in-memory/in-memory-personal.repositories.js';
import {
  DRINK_REPOSITORY,
  DRINK_SOURCE,
  FAVORITE_REPOSITORY,
  COCKTLE_GAME_REPOSITORY,
  REACTION_REPOSITORY,
  TASTE_SHARE_REPOSITORY,
  USER_PANTRY_REPOSITORY,
} from '../../src/drinks/infrastructure/tokens.js';
import { InMemoryTasteShareRepository } from '../../src/drinks/infrastructure/persistence/in-memory/in-memory-taste-share.repository.js';
import {
  InMemoryApiKeyRepository,
  InMemoryApiUsageRepository,
  InMemoryLoginFailureRepository,
  InMemoryPasswordResetRepository,
  InMemoryRefreshTokenRepository,
  InMemoryUserRepository,
} from '../../src/identity/infrastructure/persistence/in-memory/in-memory-identity.repositories.js';
import {
  API_KEY_REPOSITORY,
  API_USAGE_REPOSITORY,
  LOGIN_FAILURE_REPOSITORY,
  PASSWORD_RESET_REPOSITORY,
  REFRESH_TOKEN_REPOSITORY,
  USER_REPOSITORY,
} from '../../src/identity/infrastructure/tokens.js';
import { PG_POOL } from '../../src/shared/infrastructure/database/database.module.js';
import { setupOpenApi } from '../../src/shared/infrastructure/http/setup-openapi.js';
import { InMemoryVenueRepository } from '../../src/venues/infrastructure/persistence/in-memory/in-memory-venue.repository.js';
import { VENUE_REPOSITORY } from '../../src/venues/infrastructure/tokens.js';
import { DRINKS } from './drinks.js';
import { FakeDrinkSource } from './fake-drink-source.js';
import { FakeMailer } from './fake-mailer.js';
import { FakeErrorReporter } from './fake-error-reporter.js';
import { ERROR_REPORTER } from '../../src/shared/infrastructure/observability/error-reporter.js';
import { FakeWompiGateway } from './fake-wompi.js';
import { MAILER } from '../../src/shared/infrastructure/mail/mail.module.js';
import { FakePgPool } from './fake-pg-pool.js';
import { TEST_PLANS } from './plans.js';

export interface TestApp {
  app: NestExpressApplication;
  source: FakeDrinkSource;
  pool: FakePgPool;
  mailer: FakeMailer;
  wompi: FakeWompiGateway;
  errors: FakeErrorReporter;
}

/** Full app with every outbound adapter replaced by an in-memory fake. */
/**
 * `env` overrides TEST_ENV for this app only (e.g. a low rate limit).
 * `snapshot`: no external source; the catalog starts with the test drinks already stored,
 * as the seed migration leaves it.
 */
export async function createTestApp(
  options: { env?: Record<string, string>; snapshot?: boolean } = {},
): Promise<TestApp> {
  const previous = { ...process.env };
  Object.assign(
    process.env,
    options.snapshot && { CATALOG_SOURCE: 'snapshot' },
    options.env,
  );
  const source = new FakeDrinkSource();
  const drinks = new InMemoryDrinkRepository();
  if (options.snapshot) await drinks.saveMany(DRINKS);
  const pool = new FakePgPool();
  const mailer = new FakeMailer();
  const wompi = new FakeWompiGateway();
  const errors = new FakeErrorReporter();
  const fakes: [symbol, unknown][] = [
    [PG_POOL, pool],
    [DRINK_SOURCE, options.snapshot ? null : source],
    [DRINK_REPOSITORY, drinks],
    [USER_PANTRY_REPOSITORY, new InMemoryUserPantryRepository()],
    [FAVORITE_REPOSITORY, new InMemoryFavoriteRepository()],
    [REACTION_REPOSITORY, new InMemoryReactionRepository()],
    [TASTE_SHARE_REPOSITORY, new InMemoryTasteShareRepository()],
    [COCKTLE_GAME_REPOSITORY, new InMemoryCocktleGameRepository()],
    [USER_REPOSITORY, new InMemoryUserRepository()],
    [REFRESH_TOKEN_REPOSITORY, new InMemoryRefreshTokenRepository()],
    [LOGIN_FAILURE_REPOSITORY, new InMemoryLoginFailureRepository()],
    [PASSWORD_RESET_REPOSITORY, new InMemoryPasswordResetRepository()],
    [MAILER, mailer],
    [API_KEY_REPOSITORY, new InMemoryApiKeyRepository()],
    [API_USAGE_REPOSITORY, new InMemoryApiUsageRepository()],
    [PLAN_REPOSITORY, new InMemoryPlanRepository(TEST_PLANS)],
    [SUBSCRIPTION_REPOSITORY, new InMemorySubscriptionRepository()],
    [PAYMENT_REPOSITORY, new InMemoryPaymentRepository()],
    [WOMPI_GATEWAY, wompi],
    [ERROR_REPORTER, errors],
    [VENUE_REPOSITORY, new InMemoryVenueRepository()],
  ];
  let builder = Test.createTestingModule({ imports: [AppModule] });
  for (const [token, fake] of fakes)
    builder = builder.overrideProvider(token).useValue(fake);

  let app: NestExpressApplication;
  try {
    app = (
      await builder.compile()
    ).createNestApplication<NestExpressApplication>();
  } finally {
    process.env = previous;
  }
  configureApp(app, app.get<Env>(ENV));
  setupOpenApi(app);
  await app.init();
  return { app, source, pool, mailer, wompi, errors };
}
