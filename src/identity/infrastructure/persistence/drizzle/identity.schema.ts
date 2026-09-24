import {
  bigserial,
  date,
  index,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { ROLES } from '../../../domain/role.js';

export const userRoleEnum = pgEnum('user_role', ROLES);

export const usersTable = pgTable('users', {
  id: uuid('id').primaryKey(),
  email: text('email').notNull().unique(),
  name: text('name').notNull(),
  passwordHash: text('password_hash').notNull(),
  role: userRoleEnum('role').notNull().default('user'),
  birthDate: date('birth_date', { mode: 'date' }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
});

export const refreshTokensTable = pgTable(
  'refresh_tokens',
  {
    id: uuid('id').primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => usersTable.id, { onDelete: 'cascade' }),
    familyId: uuid('family_id').notNull(),
    tokenHash: text('token_hash').notNull().unique(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
  },
  (t) => [index('refresh_tokens_family_idx').on(t.familyId)],
);

export type UserRecord = typeof usersTable.$inferSelect;

export const loginFailuresTable = pgTable(
  'login_failures',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    /** "account:<email>" or "ip:<address>" */
    key: text('key').notNull(),
    attemptedAt: timestamp('attempted_at', { withTimezone: true }).notNull(),
  },
  (t) => [index('login_failures_key_idx').on(t.key, t.attemptedAt)],
);

export const apiKeysTable = pgTable(
  'api_keys',
  {
    id: uuid('id').primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => usersTable.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    prefix: text('prefix').notNull(),
    keyHash: text('key_hash').notNull().unique(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
  },
  (t) => [index('api_keys_user_idx').on(t.userId)],
);

export const apiUsageTable = pgTable(
  'api_usage',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => usersTable.id, { onDelete: 'cascade' }),
    day: date('day', { mode: 'string' }).notNull(),
    requests: integer('requests').notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.day] })],
);
