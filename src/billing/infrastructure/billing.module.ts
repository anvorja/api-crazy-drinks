import { Global, Module } from '@nestjs/common';
import type { UserRepository } from '../../identity/domain/user.repository.js';
import { IdentityModule } from '../../identity/infrastructure/identity.module.js';
import { USER_REPOSITORY } from '../../identity/infrastructure/tokens.js';
import type { Clock } from '../../shared/application/ports.js';
import {
  DRIZZLE,
  type Database,
} from '../../shared/infrastructure/database/database.module.js';
import { provide } from '../../shared/infrastructure/di/provide.js';
import { CLOCK } from '../../shared/infrastructure/system.module.js';
import type { UserDirectory } from '../application/ports/user-directory.port.js';
import {
  CancelMySubscription,
  GetEffectivePlan,
  GetPlanLimits,
  ListPlans,
  SetSubscription,
} from '../application/use-cases/billing.js';
import type {
  PlanRepository,
  SubscriptionRepository,
} from '../domain/billing.repositories.js';
import { BillingController } from './http/billing.controller.js';
import {
  DrizzlePlanRepository,
  DrizzleSubscriptionRepository,
} from './persistence/drizzle/drizzle-billing.repositories.js';
import {
  PLAN_REPOSITORY,
  SUBSCRIPTION_REPOSITORY,
  USER_DIRECTORY,
} from './tokens.js';

/**
 * Global so other contexts (identity, venues) can adapt GetPlanLimits to their own ports
 * without importing this module (which would create an import cycle with identity).
 */
@Global()
@Module({
  imports: [IdentityModule],
  controllers: [BillingController],
  providers: [
    provide(PLAN_REPOSITORY, (db: Database) => new DrizzlePlanRepository(db), [
      DRIZZLE,
    ]),
    provide(
      SUBSCRIPTION_REPOSITORY,
      (db: Database) => new DrizzleSubscriptionRepository(db),
      [DRIZZLE],
    ),
    // Adapter: billing's view of accounts, over identity's repository.
    provide(
      USER_DIRECTORY,
      (users: UserRepository): UserDirectory => ({
        exists: async (id) => (await users.findById(id)) !== null,
      }),
      [USER_REPOSITORY],
    ),
    provide(ListPlans, (plans: PlanRepository) => new ListPlans(plans), [
      PLAN_REPOSITORY,
    ]),
    provide(
      GetEffectivePlan,
      (plans: PlanRepository, subs: SubscriptionRepository, clock: Clock) =>
        new GetEffectivePlan(plans, subs, clock),
      [PLAN_REPOSITORY, SUBSCRIPTION_REPOSITORY, CLOCK],
    ),
    provide(
      GetPlanLimits,
      (effective: GetEffectivePlan) => new GetPlanLimits(effective),
      [GetEffectivePlan],
    ),
    provide(
      SetSubscription,
      (
        plans: PlanRepository,
        subs: SubscriptionRepository,
        users: UserDirectory,
        clock: Clock,
      ) => new SetSubscription(plans, subs, users, clock),
      [PLAN_REPOSITORY, SUBSCRIPTION_REPOSITORY, USER_DIRECTORY, CLOCK],
    ),
    provide(
      CancelMySubscription,
      (subs: SubscriptionRepository, clock: Clock) =>
        new CancelMySubscription(subs, clock),
      [SUBSCRIPTION_REPOSITORY, CLOCK],
    ),
  ],
  exports: [GetPlanLimits],
})
export class BillingModule {}
