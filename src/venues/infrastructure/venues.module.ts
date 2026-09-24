import { Module } from '@nestjs/common';
import { GetPlanLimits } from '../../billing/application/use-cases/billing.js';
import { DrinkCatalog } from '../../drinks/application/drink-catalog.js';
import { DrinksModule } from '../../drinks/infrastructure/drinks.module.js';
import type { Clock, IdGenerator } from '../../shared/application/ports.js';
import {
  DRIZZLE,
  type Database,
} from '../../shared/infrastructure/database/database.module.js';
import { provide } from '../../shared/infrastructure/di/provide.js';
import {
  CLOCK,
  ID_GENERATOR,
} from '../../shared/infrastructure/system.module.js';
import type { VenueDrinkCatalog } from '../application/ports/drink-catalog.port.js';
import type { VenuePlanLimitsPort } from '../application/ports/plan-limits.port.js';
import {
  BuildVenueMenu,
  CreateVenue,
  GetInventory,
  GetManagedVenue,
  ListMyVenues,
  ReplaceInventory,
} from '../application/use-cases/venues.js';
import type { VenueRepository } from '../domain/venue.repository.js';
import { VenuesController } from './http/venues.controller.js';
import { DrizzleVenueRepository } from './persistence/drizzle/drizzle-venue.repository.js';
import {
  VENUE_DRINK_CATALOG,
  VENUE_PLAN_LIMITS,
  VENUE_REPOSITORY,
} from './tokens.js';

@Module({
  imports: [DrinksModule],
  controllers: [VenuesController],
  providers: [
    provide(
      VENUE_REPOSITORY,
      (db: Database) => new DrizzleVenueRepository(db),
      [DRIZZLE],
    ),
    // Adapter: the drinks catalog as venues need it (all drinks, alcohol included).
    provide(
      VENUE_DRINK_CATALOG,
      (catalog: DrinkCatalog): VenueDrinkCatalog => ({
        all: () => catalog.all(),
      }),
      [DrinkCatalog],
    ),
    // Adapter: venues' view of the billing plan.
    provide(
      VENUE_PLAN_LIMITS,
      (limits: GetPlanLimits): VenuePlanLimitsPort => ({
        limitsFor: async (actor) => {
          const { venues, inventoryItems, menuPricing } =
            await limits.execute(actor);
          return { venues, inventoryItems, menuPricing };
        },
      }),
      [GetPlanLimits],
    ),
    provide(
      CreateVenue,
      (
        venues: VenueRepository,
        limits: VenuePlanLimitsPort,
        ids: IdGenerator,
        clock: Clock,
      ) => new CreateVenue(venues, limits, ids, clock),
      [VENUE_REPOSITORY, VENUE_PLAN_LIMITS, ID_GENERATOR, CLOCK],
    ),
    provide(ListMyVenues, (v: VenueRepository) => new ListMyVenues(v), [
      VENUE_REPOSITORY,
    ]),
    provide(GetManagedVenue, (v: VenueRepository) => new GetManagedVenue(v), [
      VENUE_REPOSITORY,
    ]),
    provide(
      GetInventory,
      (v: VenueRepository, g: GetManagedVenue) => new GetInventory(v, g),
      [VENUE_REPOSITORY, GetManagedVenue],
    ),
    provide(
      ReplaceInventory,
      (v: VenueRepository, g: GetManagedVenue, l: VenuePlanLimitsPort) =>
        new ReplaceInventory(v, g, l),
      [VENUE_REPOSITORY, GetManagedVenue, VENUE_PLAN_LIMITS],
    ),
    provide(
      BuildVenueMenu,
      (
        v: VenueRepository,
        g: GetManagedVenue,
        c: VenueDrinkCatalog,
        l: VenuePlanLimitsPort,
      ) => new BuildVenueMenu(v, g, c, l),
      [
        VENUE_REPOSITORY,
        GetManagedVenue,
        VENUE_DRINK_CATALOG,
        VENUE_PLAN_LIMITS,
      ],
    ),
  ],
})
export class VenuesModule {}
