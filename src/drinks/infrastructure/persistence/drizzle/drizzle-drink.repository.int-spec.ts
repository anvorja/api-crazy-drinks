import { Pool } from 'pg';
import { MARGARITA, MOJITO } from '../../../../../test/support/drinks.js';
import {
  connectTestPool,
  inRollbackTransaction,
} from '../../../../../test/support/db-transaction.js';
import { DrizzleDrinkRepository } from './drizzle-drink.repository.js';

describe('DrizzleDrinkRepository (Postgres)', () => {
  let pool: Pool;
  const withRepo = (fn: (repo: DrizzleDrinkRepository) => Promise<void>) =>
    inRollbackTransaction(pool, (db) => fn(new DrizzleDrinkRepository(db)));

  beforeAll(() => {
    pool = connectTestPool();
  });

  afterAll(() => pool.end());

  it('round-trips drinks and upserts by id', () =>
    withRepo(async (repo) => {
      const id = `test-${Date.now()}`;
      await repo.saveMany([{ ...MOJITO, id }]);
      await repo.saveMany([{ ...MOJITO, id, name: 'Mojito Updated' }]);
      expect(await repo.findById(id)).toEqual({
        ...MOJITO,
        id,
        name: 'Mojito Updated',
      });
    }));

  it('searches names case-insensitively and escapes wildcards', () =>
    withRepo(async (repo) => {
      const id = `test-${Date.now()}`;
      await repo.saveMany([
        { ...MARGARITA, id, name: 'Zz 100% Test Margarita' },
      ]);
      expect((await repo.searchByName('100% test')).map((d) => d.id)).toContain(
        id,
      );
      expect((await repo.searchByName('zz_')).map((d) => d.id)).not.toContain(
        id,
      );
    }));

  it('records the last sync', () =>
    withRepo(async (repo) => {
      const at = new Date('2030-01-01T00:00:00Z');
      await repo.recordSync(at);
      expect(await repo.lastSyncedAt()).toEqual(at);
    }));
});
