import {
  boolean,
  char,
  integer,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { usersTable } from '../../../../identity/infrastructure/persistence/drizzle/identity.schema.js';

/** Plan catalog. Rows are seeded by a migration; limits are data, not code. */
export const plansTable = pgTable('plans', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  monthlyPrice: numeric('monthly_price', {
    precision: 14,
    scale: 2,
    mode: 'number',
  }).notNull(),
  currency: char('currency', { length: 3 }).notNull(),
  maxVenues: integer('max_venues'),
  maxInventoryItems: integer('max_inventory_items'),
  menuPricing: boolean('menu_pricing').notNull(),
  maxApiKeys: integer('max_api_keys').notNull(),
  apiDailyRequests: integer('api_daily_requests').notNull(),
});

export const subscriptionStatusEnum = pgEnum('subscription_status', [
  'active',
  'canceled',
]);

export const subscriptionsTable = pgTable('subscriptions', {
  userId: uuid('user_id')
    .primaryKey()
    .references(() => usersTable.id, { onDelete: 'cascade' }),
  planId: text('plan_id')
    .notNull()
    .references(() => plansTable.id),
  status: subscriptionStatusEnum('status').notNull(),
  currentPeriodEnd: timestamp('current_period_end', {
    withTimezone: true,
  }).notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull(),
});
