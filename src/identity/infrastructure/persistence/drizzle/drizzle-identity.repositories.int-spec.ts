import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import {
  connectTestPool,
  inRollbackTransaction,
} from '../../../../../test/support/db-transaction.js';
import { User } from '../../../domain/user.js';
import { DrizzleRefreshTokenRepository } from './drizzle-refresh-token.repository.js';
import { DrizzleUserRepository } from './drizzle-user.repository.js';

const newUser = (): User => ({
  id: randomUUID(),
  email: `int-${randomUUID()}@test.local`,
  name: 'Integration',
  passwordHash: 'scrypt$1$1$1$a$b',
  role: 'user',
  birthDate: new Date('2000-02-29T00:00:00Z'),
  createdAt: new Date('2026-01-01T12:00:00Z'),
});

describe('Drizzle identity repositories (Postgres)', () => {
  let pool: Pool;

  beforeAll(() => {
    pool = connectTestPool();
  });

  afterAll(() => pool.end());

  it('round-trips users, including the birth date', () =>
    inRollbackTransaction(pool, async (db) => {
      const users = new DrizzleUserRepository(db);
      const user = newUser();
      await users.create(user);
      expect(await users.findByEmail(user.email)).toEqual(user);

      await users.updateRole(user.id, 'bartender');
      expect((await users.findById(user.id))?.role).toBe('bartender');
    }));

  it('revokes refresh tokens only once', () =>
    inRollbackTransaction(pool, async (db) => {
      const user = newUser();
      await new DrizzleUserRepository(db).create(user);
      const tokens = new DrizzleRefreshTokenRepository(db);
      const token = {
        id: randomUUID(),
        userId: user.id,
        familyId: randomUUID(),
        tokenHash: randomUUID(),
        expiresAt: new Date('2030-01-01T00:00:00Z'),
        revokedAt: null,
      };
      await tokens.create(token);

      const at = new Date();
      expect(await tokens.revoke(token.id, at)).toBe(true);
      expect(await tokens.revoke(token.id, at)).toBe(false);
      expect((await tokens.findByHash(token.tokenHash))?.revokedAt).toEqual(at);
    }));
});
