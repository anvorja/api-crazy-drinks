import {
  bigint,
  boolean,
  char,
  index,
  integer,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { PAYMENT_STATUSES } from '../../../domain/payment.js';
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

export const paymentStatusEnum = pgEnum('payment_status', PAYMENT_STATUSES);

export const paymentsTable = pgTable(
  'payments',
  {
    id: uuid('id').primaryKey(),
    reference: text('reference').notNull().unique(),
    userId: uuid('user_id')
      .notNull()
      .references(() => usersTable.id, { onDelete: 'cascade' }),
    planId: text('plan_id')
      .notNull()
      .references(() => plansTable.id),
    amountInCents: bigint('amount_in_cents', { mode: 'number' }).notNull(),
    currency: char('currency', { length: 3 }).notNull(),
    status: paymentStatusEnum('status').notNull(),
    transactionId: text('transaction_id'),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull(),
  },
  (t) => [index('payments_user_idx').on(t.userId)],
);
