import { Clock } from '../../../shared/application/ports.js';
import {
  NotFoundError,
  ValidationError,
} from '../../../shared/domain/errors.js';
import { Principal, requireRole } from '../../../identity/domain/principal.js';
import {
  PlanRepository,
  SubscriptionRepository,
} from '../../domain/billing.repositories.js';
import { Plan, PlanLimits, UNLIMITED } from '../../domain/plan.js';
import {
  Subscription,
  assertValidPeriodEnd,
  effectivePlanId,
} from '../../domain/subscription.js';
import { UserDirectory } from '../ports/user-directory.port.js';

export class ListPlans {
  constructor(private readonly plans: PlanRepository) {}

  execute(): Promise<Plan[]> {
    return this.plans.list();
  }
}

export interface PlanStatus {
  plan: Plan;
  subscription: Subscription | null;
}

/** The plan that applies right now to a user. */
export class GetEffectivePlan {
  constructor(
    private readonly plans: PlanRepository,
    private readonly subscriptions: SubscriptionRepository,
    private readonly clock: Clock,
  ) {}

  async execute(userId: string): Promise<PlanStatus> {
    const subscription = await this.subscriptions.findByUser(userId);
    const planId = effectivePlanId(subscription, this.clock.now());
    const plan = await this.plans.findById(planId);
    if (!plan) throw new NotFoundError(`Plan ${planId} is not configured`);
    return { plan, subscription };
  }
}

/** Limits for an actor; admins are unlimited. Used by other contexts through their ports. */
export class GetPlanLimits {
  constructor(private readonly effectivePlan: GetEffectivePlan) {}

  async execute(
    actor: Pick<Principal, 'userId' | 'role'>,
  ): Promise<PlanLimits> {
    if (actor.role === 'admin') return UNLIMITED;
    return (await this.effectivePlan.execute(actor.userId)).plan.limits;
  }
}

export class SetSubscription {
  constructor(
    private readonly plans: PlanRepository,
    private readonly subscriptions: SubscriptionRepository,
    private readonly users: UserDirectory,
    private readonly clock: Clock,
  ) {}

  /** Admin-operated until a payment gateway is connected (e.g. after a confirmed transfer). */
  async execute(
    actor: Principal | null,
    input: { userId: string; planId: string; currentPeriodEnd: Date },
  ): Promise<Subscription> {
    requireRole(actor, 'admin');
    const now = this.clock.now();
    if (!(await this.plans.findById(input.planId))) {
      throw new ValidationError(`Unknown plan ${input.planId}`);
    }
    if (!(await this.users.exists(input.userId))) {
      throw new NotFoundError(
        `User ${input.userId} not found`,
        'USER_NOT_FOUND',
      );
    }
    assertValidPeriodEnd(input.currentPeriodEnd, now);
    const subscription: Subscription = {
      ...input,
      status: 'active',
      updatedAt: now,
    };
    await this.subscriptions.save(subscription);
    return subscription;
  }
}

export class CancelMySubscription {
  constructor(
    private readonly subscriptions: SubscriptionRepository,
    private readonly clock: Clock,
  ) {}

  /** Stops renewal; the plan keeps working until the current period ends. */
  async execute(actor: Principal): Promise<Subscription> {
    const subscription = await this.subscriptions.findByUser(actor.userId);
    if (!subscription) throw new NotFoundError('You have no subscription');
    const canceled: Subscription = {
      ...subscription,
      status: 'canceled',
      updatedAt: this.clock.now(),
    };
    await this.subscriptions.save(canceled);
    return canceled;
  }
}
