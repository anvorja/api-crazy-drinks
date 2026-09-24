import { randomUUID } from 'node:crypto';
import { sql } from 'drizzle-orm';
import { Pool } from 'pg';
import { DrizzleDrinkRepository } from '../src/drinks/infrastructure/persistence/drizzle/drizzle-drink.repository.js';
import {
  DrizzleFavoriteRepository,
  DrizzleReactionRepository,
} from '../src/drinks/infrastructure/persistence/drizzle/drizzle-personal.repositories.js';
import { DrizzlePasswordResetRepository } from '../src/identity/infrastructure/persistence/drizzle/drizzle-password-reset.repository.js';
import { DrizzleRefreshTokenRepository } from '../src/identity/infrastructure/persistence/drizzle/drizzle-refresh-token.repository.js';
import { DrizzleUserRepository } from '../src/identity/infrastructure/persistence/drizzle/drizzle-user.repository.js';
import {
  connectTestPool,
  inRollbackTransaction,
} from './support/db-transaction.js';
import { MOJITO } from './support/drinks.js';

describe('account persistence (Postgres)', () => {
  let pool: Pool;

  beforeAll(() => {
    pool = connectTestPool();
  });

  afterAll(() => pool.end());

  const newUser = () => ({
    id: randomUUID(),
    email: `acct-${randomUUID()}@test.local`,
    name: 'Account',
    passwordHash: 'x',
    role: 'user' as const,
    birthDate: new Date('1990-01-01T00:00:00Z'),
    createdAt: new Date(),
  });

  it('deleting a user removes everything that belongs to it', () =>
    inRollbackTransaction(pool, async (db) => {
      const users = new DrizzleUserRepository(db);
      const user = newUser();
      await users.create(user);
      const drinkId = `test-${randomUUID()}`;
      await new DrizzleDrinkRepository(db).saveMany([
        { ...MOJITO, id: drinkId },
      ]);
      await new DrizzleFavoriteRepository(db).add({
        userId: user.id,
        drinkId,
        createdAt: new Date(),
      });
      await new DrizzleReactionRepository(db).save({
        userId: user.id,
        drinkId,
        kind: 'like',
        createdAt: new Date(),
      });
      await new DrizzleRefreshTokenRepository(db).create({
        id: randomUUID(),
        userId: user.id,
        familyId: randomUUID(),
        tokenHash: randomUUID(),
        expiresAt: new Date(Date.now() + 86_400_000),
        revokedAt: null,
      });

      await users.delete(user.id);

      const result = (await db.execute(sql`
        select (select count(*) from favorites where user_id = ${user.id})
             + (select count(*) from drink_reactions where user_id = ${user.id})
             + (select count(*) from refresh_tokens where user_id = ${user.id}) as total`)) as unknown as {
        rows: { total: string }[];
      };
      expect(Number(result.rows[0].total)).toBe(0);
      expect(await users.findById(user.id)).toBeNull();
    }));

  it('a reset link is used only once and old ones can be invalidated', () =>
    inRollbackTransaction(pool, async (db) => {
      const user = newUser();
      await new DrizzleUserRepository(db).create(user);
      const resets = new DrizzlePasswordResetRepository(db);
      const reset = {
        id: randomUUID(),
        userId: user.id,
        tokenHash: randomUUID(),
        expiresAt: new Date(Date.now() + 60_000),
        usedAt: null,
      };
      await resets.create(reset);
      expect(await resets.markUsed(reset.id, new Date())).toBe(true);
      expect(await resets.markUsed(reset.id, new Date())).toBe(false);

      const other = { ...reset, id: randomUUID(), tokenHash: randomUUID() };
      await resets.create(other);
      await resets.invalidateForUser(user.id, new Date());
      expect((await resets.findByHash(other.tokenHash))?.usedAt).not.toBeNull();
    }));
});
