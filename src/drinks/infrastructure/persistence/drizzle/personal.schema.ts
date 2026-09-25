import {
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { REACTIONS } from '../../../domain/reactions.js';
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

export const reactionKindEnum = pgEnum('reaction_kind', REACTIONS);

export const drinkReactionsTable = pgTable(
  'drink_reactions',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => usersTable.id, { onDelete: 'cascade' }),
    drinkId: text('drink_id')
      .notNull()
      .references(() => drinksTable.id, { onDelete: 'cascade' }),
    kind: reactionKindEnum('kind').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.drinkId] })],
);

export const tasteSharesTable = pgTable('taste_shares', {
  userId: uuid('user_id')
    .primaryKey()
    .references(() => usersTable.id, { onDelete: 'cascade' }),
  slug: text('slug').notNull().unique(),
  displayName: text('display_name').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
});
