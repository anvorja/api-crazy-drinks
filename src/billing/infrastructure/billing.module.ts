import { Global, Module } from '@nestjs/common';
import type { UserRepository } from '../../identity/domain/user.repository.js';
import { IdentityModule } from '../../identity/infrastructure/identity.module.js';
import { USER_REPOSITORY } from '../../identity/infrastructure/tokens.js';
import type { Clock, IdGenerator } from '../../shared/application/ports.js';
import { ENV } from '../../shared/infrastructure/config/config.module.js';
import type { Env } from '../../shared/infrastructure/config/env.js';
import {
  DRIZZLE,
  type Database,
} from '../../shared/infrastructure/database/database.module.js';
import { provide } from '../../shared/infrastructure/di/provide.js';
import {
  CLOCK,
  ID_GENERATOR,
} from '../../shared/infrastructure/system.module.js';
import type { PaymentRepository } from '../domain/payment.js';
import {
  ApplyPaymentOutcome,
  ListMyPayments,
  StartCheckout,
  VerifyPayment,
} from '../application/use-cases/payments.js';
import { PaymentsController } from './http/payments.controller.js';
import { WompiWebhookController } from './http/wompi-webhook.controller.js';
import { DrizzlePaymentRepository } from './persistence/drizzle/drizzle-payment.repository.js';
import { WompiGateway } from './wompi/wompi.gateway.js';
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
  PAYMENT_REPOSITORY,
  PLAN_REPOSITORY,
  SUBSCRIPTION_REPOSITORY,
  USER_DIRECTORY,
  WOMPI_GATEWAY,
} from './tokens.js';

/**
 * Global so other contexts (identity, venues) can adapt GetPlanLimits to their own ports
 * without importing this module (which would create an import cycle with identity).
 */
@Global()
@Module({
  imports: [IdentityModule],
  controllers: [BillingController, PaymentsController, WompiWebhookController],
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
        emailOf: async (id) => (await users.findById(id))?.email ?? null,
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

    // Payments
    provide(
      PAYMENT_REPOSITORY,
      (db: Database) => new DrizzlePaymentRepository(db),
      [DRIZZLE],
    ),
    provide(
      WOMPI_GATEWAY,
      (env: Env) =>
        env.PAYMENTS_PROVIDER === 'wompi'
          ? new WompiGateway({
              publicKey: env.WOMPI_PUBLIC_KEY!,
              integritySecret: env.WOMPI_INTEGRITY_SECRET!,
              eventsSecret: env.WOMPI_EVENTS_SECRET!,
              apiUrl: env.WOMPI_API_URL!,
              checkoutUrl: env.WOMPI_CHECKOUT_URL!,
              redirectUrl: env.PAYMENTS_REDIRECT_URL!,
              timeoutMs: env.WOMPI_TIMEOUT_MS,
            })
          : null,
      [ENV],
    ),
    provide(
      StartCheckout,
      (
        plans: PlanRepository,
        payments: PaymentRepository,
        users: UserDirectory,
        gateway: WompiGateway | null,
        ids: IdGenerator,
        clock: Clock,
        env: Env,
      ) =>
        new StartCheckout(plans, payments, users, gateway, ids, clock, {
          ttlMinutes: env.PAYMENTS_CHECKOUT_TTL_MINUTES,
        }),
      [
        PLAN_REPOSITORY,
        PAYMENT_REPOSITORY,
        USER_DIRECTORY,
        WOMPI_GATEWAY,
        ID_GENERATOR,
        CLOCK,
        ENV,
      ],
    ),
    provide(
      ApplyPaymentOutcome,
      (
        payments: PaymentRepository,
        subs: SubscriptionRepository,
        clock: Clock,
        env: Env,
      ) =>
        new ApplyPaymentOutcome(payments, subs, clock, {
          periodDays: env.SUBSCRIPTION_PERIOD_DAYS,
        }),
      [PAYMENT_REPOSITORY, SUBSCRIPTION_REPOSITORY, CLOCK, ENV],
    ),
    provide(
      VerifyPayment,
      (
        payments: PaymentRepository,
        gateway: WompiGateway | null,
        apply: ApplyPaymentOutcome,
      ) => new VerifyPayment(payments, gateway, apply),
      [PAYMENT_REPOSITORY, WOMPI_GATEWAY, ApplyPaymentOutcome],
    ),
    provide(
      ListMyPayments,
      (payments: PaymentRepository, clock: Clock) =>
        new ListMyPayments(payments, clock),
      [PAYMENT_REPOSITORY, CLOCK],
    ),
  ],
  exports: [GetPlanLimits],
})
export class BillingModule {}
