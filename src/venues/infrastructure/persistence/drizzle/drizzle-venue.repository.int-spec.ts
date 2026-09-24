import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import {
  connectTestPool,
  inRollbackTransaction,
} from '../../../../../test/support/db-transaction.js';
import { DrizzleUserRepository } from '../../../../identity/infrastructure/persistence/drizzle/drizzle-user.repository.js';
import { DrizzleVenueRepository } from './drizzle-venue.repository.js';

describe('DrizzleVenueRepository (Postgres)', () => {
  let pool: Pool;

  beforeAll(() => {
    pool = connectTestPool();
  });

  afterAll(() => pool.end());

  it('stores venues and replaces inventories, keeping money exact', () =>
    inRollbackTransaction(pool, async (db) => {
      const ownerId = randomUUID();
      await new DrizzleUserRepository(db).create({
        id: ownerId,
        email: `owner-${ownerId}@test.local`,
        name: 'Owner',
        passwordHash: 'x',
        role: 'venue_owner',
        birthDate: new Date('1990-01-01T00:00:00Z'),
        createdAt: new Date(),
      });
      const venues = new DrizzleVenueRepository(db);
      const venue = {
        id: randomUUID(),
        ownerId,
        name: 'La Barra',
        city: 'Cali',
        currency: 'COP',
        targetPourCost: 0.22,
        createdAt: new Date('2026-01-01T00:00:00Z'),
      };
      await venues.create(venue);
      expect(await venues.listByOwner(ownerId)).toEqual([venue]);

      await venues.replaceInventory(venue.id, [
        {
          ingredient: 'Ron',
          bottleSizeMl: 750,
          bottleCost: 59_999.99,
          costPerServing: null,
          inStock: true,
        },
      ]);
      await venues.replaceInventory(venue.id, [
        {
          ingredient: 'Gin',
          bottleSizeMl: 700,
          bottleCost: 89_900.5,
          costPerServing: 1_250.5,
          inStock: false,
        },
      ]);
      expect(await venues.getInventory(venue.id)).toEqual([
        {
          ingredient: 'Gin',
          bottleSizeMl: 700,
          bottleCost: 89_900.5,
          costPerServing: 1_250.5,
          inStock: false,
        },
      ]);
    }));
});
