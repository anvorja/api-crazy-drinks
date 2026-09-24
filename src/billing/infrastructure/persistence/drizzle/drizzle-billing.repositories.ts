import { asc, eq } from 'drizzle-orm';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import {
  PlanRepository,
  SubscriptionRepository,
} from '../../../domain/billing.repositories.js';
import { Plan } from '../../../domain/plan.js';
import { Subscription } from '../../../domain/subscription.js';
import { plansTable, subscriptionsTable } from './billing.schema.js';

const toPlan = (r: typeof plansTable.$inferSelect): Plan => ({
  id: r.id,
  name: r.name,
  monthlyPrice: r.monthlyPrice,
  currency: r.currency,
  limits: {
    venues: r.maxVenues,
    inventoryItems: r.maxInventoryItems,
    menuPricing: r.menuPricing,
    apiKeys: r.maxApiKeys,
    apiDailyRequests: r.apiDailyRequests,
  },
});

export class DrizzlePlanRepository implements PlanRepository {
  constructor(private readonly db: PgDatabase<PgQueryResultHKT>) {}

  async list(): Promise<Plan[]> {
    return (
      await this.db
        .select()
        .from(plansTable)
        .orderBy(asc(plansTable.monthlyPrice))
    ).map(toPlan);
  }

  async findById(id: string): Promise<Plan | null> {
    const [record] = await this.db
      .select()
      .from(plansTable)
      .where(eq(plansTable.id, id));
    return record ? toPlan(record) : null;
  }
}

export class DrizzleSubscriptionRepository implements SubscriptionRepository {
  constructor(private readonly db: PgDatabase<PgQueryResultHKT>) {}

  async findByUser(userId: string): Promise<Subscription | null> {
    const [record] = await this.db
      .select()
      .from(subscriptionsTable)
      .where(eq(subscriptionsTable.userId, userId));
    return record ?? null;
  }

  async save(subscription: Subscription): Promise<void> {
    const { planId, status, currentPeriodEnd, updatedAt } = subscription;
    await this.db
      .insert(subscriptionsTable)
      .values(subscription)
      .onConflictDoUpdate({
        target: subscriptionsTable.userId,
        set: { planId, status, currentPeriodEnd, updatedAt },
      });
  }
}
