import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { App } from 'supertest/types.js';
import { AppModule } from '../../src/app.module.js';
import {
  InMemoryPlanRepository,
  InMemorySubscriptionRepository,
} from '../../src/billing/infrastructure/persistence/in-memory/in-memory-billing.repositories.js';
import {
  PLAN_REPOSITORY,
  SUBSCRIPTION_REPOSITORY,
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
  REACTION_REPOSITORY,
  USER_PANTRY_REPOSITORY,
} from '../../src/drinks/infrastructure/tokens.js';
import {
  InMemoryApiKeyRepository,
  InMemoryApiUsageRepository,
  InMemoryLoginFailureRepository,
  InMemoryRefreshTokenRepository,
  InMemoryUserRepository,
} from '../../src/identity/infrastructure/persistence/in-memory/in-memory-identity.repositories.js';
import {
  API_KEY_REPOSITORY,
  API_USAGE_REPOSITORY,
  LOGIN_FAILURE_REPOSITORY,
  REFRESH_TOKEN_REPOSITORY,
  USER_REPOSITORY,
} from '../../src/identity/infrastructure/tokens.js';
import { PG_POOL } from '../../src/shared/infrastructure/database/database.module.js';
import { setupOpenApi } from '../../src/shared/infrastructure/http/setup-openapi.js';
import { InMemoryVenueRepository } from '../../src/venues/infrastructure/persistence/in-memory/in-memory-venue.repository.js';
import { VENUE_REPOSITORY } from '../../src/venues/infrastructure/tokens.js';
import { FakeDrinkSource } from './fake-drink-source.js';
import { FakePgPool } from './fake-pg-pool.js';
import { TEST_PLANS } from './plans.js';

export interface TestApp {
  app: INestApplication<App>;
  source: FakeDrinkSource;
  pool: FakePgPool;
}

/** Full app with every outbound adapter replaced by an in-memory fake. */
export async function createTestApp(): Promise<TestApp> {
  const source = new FakeDrinkSource();
  const pool = new FakePgPool();
  const fakes: [symbol, unknown][] = [
    [PG_POOL, pool],
    [DRINK_SOURCE, source],
    [DRINK_REPOSITORY, new InMemoryDrinkRepository()],
    [USER_PANTRY_REPOSITORY, new InMemoryUserPantryRepository()],
    [FAVORITE_REPOSITORY, new InMemoryFavoriteRepository()],
    [REACTION_REPOSITORY, new InMemoryReactionRepository()],
    [USER_REPOSITORY, new InMemoryUserRepository()],
    [REFRESH_TOKEN_REPOSITORY, new InMemoryRefreshTokenRepository()],
    [LOGIN_FAILURE_REPOSITORY, new InMemoryLoginFailureRepository()],
    [API_KEY_REPOSITORY, new InMemoryApiKeyRepository()],
    [API_USAGE_REPOSITORY, new InMemoryApiUsageRepository()],
    [PLAN_REPOSITORY, new InMemoryPlanRepository(TEST_PLANS)],
    [SUBSCRIPTION_REPOSITORY, new InMemorySubscriptionRepository()],
    [VENUE_REPOSITORY, new InMemoryVenueRepository()],
  ];
  let builder = Test.createTestingModule({ imports: [AppModule] });
  for (const [token, fake] of fakes)
    builder = builder.overrideProvider(token).useValue(fake);

  const app = (await builder.compile()).createNestApplication<
    INestApplication<App>
  >();
  setupOpenApi(app);
  await app.init();
  return { app, source, pool };
}
