import {
  boolean,
  date,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  uuid,
} from 'drizzle-orm/pg-core';
import { usersTable } from '../../../../identity/infrastructure/persistence/drizzle/identity.schema.js';
import { COCKTLE_MODES } from '../../../domain/cocktle.js';

export const cocktleModeEnum = pgEnum('cocktle_mode', COCKTLE_MODES);

export const cocktleGamesTable = pgTable(
  'cocktle_games',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => usersTable.id, { onDelete: 'cascade' }),
    day: date('day', { mode: 'string' }).notNull(),
    mode: cocktleModeEnum('mode').notNull(),
    /** Guessed drink ids, in order. */
    guesses: text('guesses').array().notNull(),
    solved: boolean('solved').notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.day, t.mode] })],
);
