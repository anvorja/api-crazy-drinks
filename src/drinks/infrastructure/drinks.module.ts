import { Module, OnApplicationBootstrap } from '@nestjs/common';
import type { Clock } from '../../shared/application/ports.js';
import { ENV } from '../../shared/infrastructure/config/config.module.js';
import type { Env } from '../../shared/infrastructure/config/env.js';
import {
  DRIZZLE,
  type Database,
} from '../../shared/infrastructure/database/database.module.js';
import { provide } from '../../shared/infrastructure/di/provide.js';
import { CLOCK } from '../../shared/infrastructure/system.module.js';
import { DrinkCatalog } from '../application/drink-catalog.js';
import type { DrinkSource } from '../application/ports/drink-source.port.js';
import {
  FindDrinkTwins,
  GetFlavorDna,
} from '../application/use-cases/drink-insights.js';
import {
  GetDrink,
  GetDrinkOfTheDay,
  GetRandomDrink,
  SearchDrinks,
} from '../application/use-cases/drink-queries.js';
import {
  ListMoods,
  RecommendByMood,
  SuggestFromPantry,
} from '../application/use-cases/lab.js';
import {
  AddFavorite,
  GetMyPantry,
  ListFavorites,
  RemoveFavorite,
  SaveMyPantry,
  SuggestFromMyPantry,
} from '../application/use-cases/personal.js';
import type { DrinkRepository } from '../domain/drink.repository.js';
import type {
  FavoriteRepository,
  UserPantryRepository,
} from '../domain/personal.js';
import { CocktailDbSource } from './cocktaildb/cocktaildb.source.js';
import { AdminCatalogController } from './http/admin-catalog.controller.js';
import { DrinksController } from './http/drinks.controller.js';
import { LabController } from './http/lab.controller.js';
import { MeDrinksController } from './http/me-drinks.controller.js';
import { DrizzleDrinkRepository } from './persistence/drizzle/drizzle-drink.repository.js';
import {
  DrizzleFavoriteRepository,
  DrizzleUserPantryRepository,
} from './persistence/drizzle/drizzle-personal.repositories.js';
import {
  DRINK_REPOSITORY,
  DRINK_SOURCE,
  FAVORITE_REPOSITORY,
  USER_PANTRY_REPOSITORY,
} from './tokens.js';

@Module({
  controllers: [
    DrinksController,
    LabController,
    MeDrinksController,
    AdminCatalogController,
  ],
  providers: [
    // Outbound adapters
    provide(
      DRINK_REPOSITORY,
      (db: Database) => new DrizzleDrinkRepository(db),
      [DRIZZLE],
    ),
    provide(
      DRINK_SOURCE,
      (env: Env) =>
        new CocktailDbSource({
          baseUrl: env.COCKTAILDB_BASE_URL,
          apiKey: env.COCKTAILDB_API_KEY,
          timeoutMs: env.COCKTAILDB_TIMEOUT_MS,
          crawlConcurrency: env.COCKTAILDB_CRAWL_CONCURRENCY,
          retries: env.COCKTAILDB_RETRIES,
        }),
      [ENV],
    ),
    provide(
      USER_PANTRY_REPOSITORY,
      (db: Database) => new DrizzleUserPantryRepository(db),
      [DRIZZLE],
    ),
    provide(
      FAVORITE_REPOSITORY,
      (db: Database) => new DrizzleFavoriteRepository(db),
      [DRIZZLE],
    ),

    // Application
    provide(
      DrinkCatalog,
      (repo: DrinkRepository, source: DrinkSource, env: Env) =>
        new DrinkCatalog(repo, source, env.CATALOG_TTL_MS),
      [DRINK_REPOSITORY, DRINK_SOURCE, ENV],
    ),
    provide(SearchDrinks, (c: DrinkCatalog) => new SearchDrinks(c), [
      DrinkCatalog,
    ]),
    provide(GetDrink, (c: DrinkCatalog) => new GetDrink(c), [DrinkCatalog]),
    provide(GetRandomDrink, (c: DrinkCatalog) => new GetRandomDrink(c), [
      DrinkCatalog,
    ]),
    provide(GetDrinkOfTheDay, (c: DrinkCatalog) => new GetDrinkOfTheDay(c), [
      DrinkCatalog,
    ]),
    provide(GetFlavorDna, (g: GetDrink) => new GetFlavorDna(g), [GetDrink]),
    provide(
      FindDrinkTwins,
      (g: GetDrink, c: DrinkCatalog) => new FindDrinkTwins(g, c),
      [GetDrink, DrinkCatalog],
    ),
    provide(SuggestFromPantry, (c: DrinkCatalog) => new SuggestFromPantry(c), [
      DrinkCatalog,
    ]),
    provide(RecommendByMood, (c: DrinkCatalog) => new RecommendByMood(c), [
      DrinkCatalog,
    ]),
    provide(ListMoods, () => new ListMoods()),

    // Personal: saved pantry and favorites
    provide(GetMyPantry, (r: UserPantryRepository) => new GetMyPantry(r), [
      USER_PANTRY_REPOSITORY,
    ]),
    provide(
      SaveMyPantry,
      (r: UserPantryRepository, clock: Clock) => new SaveMyPantry(r, clock),
      [USER_PANTRY_REPOSITORY, CLOCK],
    ),
    provide(
      SuggestFromMyPantry,
      (g: GetMyPantry, s: SuggestFromPantry) => new SuggestFromMyPantry(g, s),
      [GetMyPantry, SuggestFromPantry],
    ),
    provide(
      ListFavorites,
      (r: FavoriteRepository, c: DrinkCatalog) => new ListFavorites(r, c),
      [FAVORITE_REPOSITORY, DrinkCatalog],
    ),
    provide(
      AddFavorite,
      (r: FavoriteRepository, g: GetDrink, clock: Clock) =>
        new AddFavorite(r, g, clock),
      [FAVORITE_REPOSITORY, GetDrink, CLOCK],
    ),
    provide(RemoveFavorite, (r: FavoriteRepository) => new RemoveFavorite(r), [
      FAVORITE_REPOSITORY,
    ]),
  ],
  exports: [DrinkCatalog, DRINK_SOURCE],
})
export class DrinksModule implements OnApplicationBootstrap {
  constructor(private readonly catalog: DrinkCatalog) {}

  onApplicationBootstrap(): void {
    // Warm up in the background; the first requests await it if it isn't done yet.
    this.catalog.ensureFresh().catch(() => undefined);
  }
}
