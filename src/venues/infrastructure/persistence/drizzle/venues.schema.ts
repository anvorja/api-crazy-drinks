import {
  boolean,
  char,
  doublePrecision,
  index,
  numeric,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { usersTable } from '../../../../identity/infrastructure/persistence/drizzle/identity.schema.js';

export const venuesTable = pgTable(
  'venues',
  {
    id: uuid('id').primaryKey(),
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => usersTable.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    city: text('city').notNull(),
    currency: char('currency', { length: 3 }).notNull(),
    targetPourCost: doublePrecision('target_pour_cost').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
  },
  (t) => [index('venues_owner_idx').on(t.ownerId)],
);

export const venueInventoryTable = pgTable(
  'venue_inventory',
  {
    venueId: uuid('venue_id')
      .notNull()
      .references(() => venuesTable.id, { onDelete: 'cascade' }),
    /** Normalized name, unique per venue. */
    ingredientKey: text('ingredient_key').notNull(),
    ingredient: text('ingredient').notNull(),
    bottleSizeMl: doublePrecision('bottle_size_ml'),
    bottleCost: numeric('bottle_cost', {
      precision: 14,
      scale: 2,
      mode: 'number',
    }),
    costPerServing: numeric('cost_per_serving', {
      precision: 14,
      scale: 2,
      mode: 'number',
    }),
    inStock: boolean('in_stock').notNull(),
  },
  (t) => [primaryKey({ columns: [t.venueId, t.ingredientKey] })],
);
