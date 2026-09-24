import { drizzle } from 'drizzle-orm/node-postgres';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import { Pool } from 'pg';
import {
  loadEnvFile,
  parseEnv,
} from '../../src/shared/infrastructure/config/env.js';

class Rollback extends Error {}

/** Pool to the real database from .env, for integration tests. */
export function connectTestPool(): Pool {
  loadEnvFile();
  const env = parseEnv();
  return new Pool({
    host: env.DB_HOST,
    port: env.DB_PORT,
    database: env.DB_NAME,
    user: env.DB_USER,
    password: env.DB_PASSWORD,
  });
}

/** Runs `fn` inside a transaction that is always rolled back: tests leave no data behind. */
export async function inRollbackTransaction(
  pool: Pool,
  fn: (db: PgDatabase<PgQueryResultHKT>) => Promise<void>,
): Promise<void> {
  await drizzle(pool)
    .transaction(async (tx) => {
      await fn(tx);
      throw new Rollback();
    })
    .catch((error) => {
      if (!(error instanceof Rollback)) throw error;
    });
}
