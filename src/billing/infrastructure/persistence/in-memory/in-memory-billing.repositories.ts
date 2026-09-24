import { Payment, PaymentRepository } from '../../../domain/payment.js';
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

export class InMemoryPaymentRepository implements PaymentRepository {
  private readonly payments = new Map<string, Payment>();

  async create(payment: Payment): Promise<void> {
    this.payments.set(payment.id, { ...payment });
  }

  async findByReference(reference: string): Promise<Payment | null> {
    return (
      [...this.payments.values()].find((p) => p.reference === reference) ?? null
    );
  }

  async save(payment: Payment): Promise<void> {
    this.payments.set(payment.id, { ...payment });
  }

  async listByUser(userId: string): Promise<Payment[]> {
    return [...this.payments.values()]
      .filter((p) => p.userId === userId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }
}
