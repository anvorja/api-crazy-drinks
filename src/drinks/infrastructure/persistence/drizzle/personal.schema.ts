import {
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { usersTable } from '../../../../identity/infrastructure/persistence/drizzle/identity.schema.js';
import { drinksTable } from './drinks.schema.js';

export const userPantriesTable = pgTable('user_pantries', {
  userId: uuid('user_id')
    .primaryKey()
    .references(() => usersTable.id, { onDelete: 'cascade' }),
  ingredients: text('ingredients').array().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull(),
});

export const favoritesTable = pgTable(
  'favorites',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => usersTable.id, { onDelete: 'cascade' }),
    drinkId: text('drink_id')
      .notNull()
      .references(() => drinksTable.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.drinkId] })],
);
