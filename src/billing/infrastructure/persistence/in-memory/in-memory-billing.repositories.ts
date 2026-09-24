import {
  PlanRepository,
  SubscriptionRepository,
} from '../../../domain/billing.repositories.js';
import { Plan } from '../../../domain/plan.js';
import { Subscription } from '../../../domain/subscription.js';

export class InMemoryPlanRepository implements PlanRepository {
  constructor(private readonly plans: Plan[]) {}

  async list(): Promise<Plan[]> {
    return this.plans;
  }

  async findById(id: string): Promise<Plan | null> {
    return this.plans.find((p) => p.id === id) ?? null;
  }
}

export class InMemorySubscriptionRepository implements SubscriptionRepository {
  private readonly subscriptions = new Map<string, Subscription>();

  async findByUser(userId: string): Promise<Subscription | null> {
    return this.subscriptions.get(userId) ?? null;
  }

  async save(subscription: Subscription): Promise<void> {
    this.subscriptions.set(subscription.userId, { ...subscription });
  }
}
