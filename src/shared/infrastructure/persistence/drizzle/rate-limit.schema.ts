import {
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';

/** Request counters per client and fixed window (shared by every API instance). */
export const rateLimitHitsTable = pgTable(
  'rate_limit_hits',
  {
    key: text('key').notNull(),
    windowStart: timestamp('window_start', { withTimezone: true }).notNull(),
    hits: integer('hits').notNull(),
  },
  (t) => [primaryKey({ columns: [t.key, t.windowStart] })],
);
