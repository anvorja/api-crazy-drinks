import { DrizzleTasteShareRepository } from '../src/drinks/infrastructure/persistence/drizzle/drizzle-taste-share.repository.js';
import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import {
  DrizzlePlanRepository,
  DrizzleSubscriptionRepository,
} from '../src/billing/infrastructure/persistence/drizzle/drizzle-billing.repositories.js';
import { DrizzleDrinkRepository } from '../src/drinks/infrastructure/persistence/drizzle/drizzle-drink.repository.js';
import {
  DrizzleFavoriteRepository,
  DrizzleReactionRepository,
  DrizzleUserPantryRepository,
} from '../src/drinks/infrastructure/persistence/drizzle/drizzle-personal.repositories.js';
import {
  DrizzleApiKeyRepository,
  DrizzleApiUsageRepository,
} from '../src/identity/infrastructure/persistence/drizzle/drizzle-api-key.repositories.js';
import { DrizzleLoginFailureRepository } from '../src/identity/infrastructure/persistence/drizzle/drizzle-login-failure.repository.js';
import { DrizzleUserRepository } from '../src/identity/infrastructure/persistence/drizzle/drizzle-user.repository.js';
import {
  connectTestPool,
  inRollbackTransaction,
} from './support/db-transaction.js';
import { MOJITO } from './support/drinks.js';

const newUser = () => ({
  id: randomUUID(),
  email: `int-${randomUUID()}@test.local`,
  name: 'Integration',
  passwordHash: 'x',
  role: 'user' as const,
  birthDate: new Date('1990-01-01T00:00:00Z'),
  createdAt: new Date(),
});

describe('freemium repositories (Postgres)', () => {
  let pool: Pool;

  beforeAll(() => {
    pool = connectTestPool();
  });

  afterAll(() => pool.end());

  it('reads the seeded plans', () =>
    inRollbackTransaction(pool, async (db) => {
      const plans = new DrizzlePlanRepository(db);
      expect((await plans.list()).map((p) => p.id)).toEqual([
        'free',
        'pro',
        'business',
      ]);
      expect((await plans.findById('business'))?.limits.venues).toBeNull();
    }));

  it('upserts subscriptions', () =>
    inRollbackTransaction(pool, async (db) => {
      const user = newUser();
      await new DrizzleUserRepository(db).create(user);
      const subs = new DrizzleSubscriptionRepository(db);
      const base = {
        userId: user.id,
        planId: 'pro',
        status: 'active' as const,
        currentPeriodEnd: new Date('2030-01-01T00:00:00Z'),
        updatedAt: new Date('2026-01-01T00:00:00Z'),
      };
      await subs.save(base);
      await subs.save({ ...base, status: 'canceled' });
      expect(await subs.findByUser(user.id)).toEqual({
        ...base,
        status: 'canceled',
      });
    }));

  it('counts API usage atomically under concurrency', () =>
    inRollbackTransaction(pool, async (db) => {
      const user = newUser();
      await new DrizzleUserRepository(db).create(user);
      const usage = new DrizzleApiUsageRepository(db);
      for (let i = 0; i < 5; i++) await usage.increment(user.id, '2026-09-24');
      expect(await usage.get(user.id, '2026-09-24')).toBe(5);
      expect(await usage.get(user.id, '2026-09-25')).toBe(0);
    }));

  it('stores API keys by hash', () =>
    inRollbackTransaction(pool, async (db) => {
      const user = newUser();
      await new DrizzleUserRepository(db).create(user);
      const keys = new DrizzleApiKeyRepository(db);
      const key = {
        id: randomUUID(),
        userId: user.id,
        name: 'POS',
        prefix: 'dk_abc123',
        keyHash: randomUUID(),
        createdAt: new Date('2026-01-01T00:00:00Z'),
        revokedAt: null,
        lastUsedAt: null,
      };
      await keys.create(key);
      expect(await keys.findByHash(key.keyHash)).toEqual(key);
      const at = new Date('2026-02-01T00:00:00Z');
      await keys.revoke(key.id, at);
      expect((await keys.findById(key.id))?.revokedAt).toEqual(at);
    }));

  it('tracks and forgets login failures', () =>
    inRollbackTransaction(pool, async (db) => {
      const failures = new DrizzleLoginFailureRepository(db);
      const key = `account:${randomUUID()}`;
      const t = (s: number) => new Date(Date.UTC(2026, 0, 1, 0, 0, s));
      await failures.record(key, t(0), t(0));
      await failures.record(key, t(10), t(0));
      await failures.record(key, t(20), t(5)); // forgets t(0)
      expect(await failures.since(key, t(0))).toEqual([t(10), t(20)]);
      await failures.clear(key);
      expect(await failures.since(key, t(0))).toEqual([]);
    }));

  it('stores pantries and favorites', () =>
    inRollbackTransaction(pool, async (db) => {
      const user = newUser();
      await new DrizzleUserRepository(db).create(user);
      const drinkId = `test-${randomUUID()}`;
      await new DrizzleDrinkRepository(db).saveMany([
        { ...MOJITO, id: drinkId },
      ]);

      const pantries = new DrizzleUserPantryRepository(db);
      const pantry = {
        userId: user.id,
        ingredients: ['Ron', 'Limón'],
        updatedAt: new Date(),
      };
      await pantries.save(pantry);
      await pantries.save({ ...pantry, ingredients: ['Gin'] });
      expect((await pantries.find(user.id))?.ingredients).toEqual(['Gin']);

      const favorites = new DrizzleFavoriteRepository(db);
      const favorite = { userId: user.id, drinkId, createdAt: new Date() };
      await favorites.add(favorite);
      await favorites.add(favorite);
      expect(await favorites.list(user.id)).toHaveLength(1);
      await favorites.remove(user.id, drinkId);
      expect(await favorites.list(user.id)).toEqual([]);
    }));

  it('stores one reaction per user and drink', () =>
    inRollbackTransaction(pool, async (db) => {
      const user = newUser();
      await new DrizzleUserRepository(db).create(user);
      const drinkId = `test-${randomUUID()}`;
      await new DrizzleDrinkRepository(db).saveMany([
        { ...MOJITO, id: drinkId },
      ]);

      const reactions = new DrizzleReactionRepository(db);
      const base = {
        userId: user.id,
        drinkId,
        createdAt: new Date('2026-01-01T00:00:00Z'),
      };
      await reactions.save({ ...base, kind: 'like' });
      await reactions.save({ ...base, kind: 'dislike' });
      expect(await reactions.listByUser(user.id)).toEqual([
        { ...base, kind: 'dislike' },
      ]);
      await reactions.remove(user.id, drinkId);
      expect(await reactions.listByUser(user.id)).toEqual([]);
    }));

  it('stores one share per user with a unique slug', () =>
    inRollbackTransaction(pool, async (db) => {
      const user = newUser();
      await new DrizzleUserRepository(db).create(user);
      const shares = new DrizzleTasteShareRepository(db);
      const share = {
        userId: user.id,
        slug: randomUUID().slice(0, 12),
        displayName: 'Ana',
        createdAt: new Date('2026-01-01T00:00:00Z'),
      };
      await shares.save(share);
      await shares.save({ ...share, displayName: 'Ana M.' });
      expect(await shares.findBySlug(share.slug)).toEqual({
        ...share,
        displayName: 'Ana M.',
      });
      await shares.removeByUser(user.id);
      expect(await shares.findByUser(user.id)).toBeNull();
    }));
});
