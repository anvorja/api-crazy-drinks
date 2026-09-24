import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { DrizzleDrinkRepository } from '../src/drinks/infrastructure/persistence/drizzle/drizzle-drink.repository.js';
import {
  connectTestPool,
  inRollbackTransaction,
} from './support/db-transaction.js';
import { MOJITO } from './support/drinks.js';

describe('catalog cache across instances (Postgres)', () => {
  let pool: Pool;

  beforeAll(() => {
    pool = connectTestPool();
  });

  afterAll(() => pool.end());

  it('an instance sees what another one saved once its check interval passes', () =>
    inRollbackTransaction(pool, async (db) => {
      let clock = 0;
      const instanceA = new DrizzleDrinkRepository(db, 30_000, () => clock);
      const instanceB = new DrizzleDrinkRepository(db, 30_000, () => clock);
      const before = (await instanceA.findAll()).length;

      await instanceB.saveMany([{ ...MOJITO, id: `test-${randomUUID()}` }]);
      expect((await instanceB.findAll()).length).toBe(before + 1);

      // Within the interval A serves its cache (no query)…
      clock += 10_000;
      expect((await instanceA.findAll()).length).toBe(before);
      // …after it, A notices the new signature and reloads.
      clock += 30_000;
      expect((await instanceA.findAll()).length).toBe(before + 1);
    }));
});
