import { randomUUID } from 'node:crypto';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { PostgresRateLimitStore } from '../src/shared/infrastructure/rate-limit/rate-limit.store.js';
import {
  connectTestPool,
  inRollbackTransaction,
} from './support/db-transaction.js';

describe('PostgresRateLimitStore', () => {
  let pool: Pool;

  beforeAll(() => {
    pool = connectTestPool();
  });

  afterAll(() => pool.end());

  it('counts concurrent hits exactly (shared by every instance)', async () => {
    const store = new PostgresRateLimitStore(drizzle(pool));
    const key = `test:${randomUUID()}`;
    const window = new Date('2030-01-01T00:00:00Z');
    const results = await Promise.all(
      Array.from({ length: 20 }, () => store.hit(key, window)),
    );
    expect([...results].sort((a, b) => a - b)).toEqual(
      Array.from({ length: 20 }, (_, i) => i + 1),
    );
    await store.prune(new Date('2030-01-02T00:00:00Z'));
  });

  it('prunes old windows', () =>
    inRollbackTransaction(pool, async (db) => {
      const store = new PostgresRateLimitStore(db);
      const key = `test:${randomUUID()}`;
      await store.hit(key, new Date('2020-01-01T00:00:00Z'));
      await store.prune(new Date('2020-01-01T00:01:00Z'));
      expect(await store.hit(key, new Date('2020-01-01T00:00:00Z'))).toBe(1);
    }));
});
