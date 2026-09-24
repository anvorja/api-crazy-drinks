import { and, desc, eq } from 'drizzle-orm';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import {
  Favorite,
  FavoriteRepository,
  UserPantry,
  UserPantryRepository,
} from '../../../domain/personal.js';
import { favoritesTable, userPantriesTable } from './personal.schema.js';

export class DrizzleUserPantryRepository implements UserPantryRepository {
  constructor(private readonly db: PgDatabase<PgQueryResultHKT>) {}

  async find(userId: string): Promise<UserPantry | null> {
    const [row] = await this.db
      .select()
      .from(userPantriesTable)
      .where(eq(userPantriesTable.userId, userId));
    return row ?? null;
  }

  async save(pantry: UserPantry): Promise<void> {
    await this.db
      .insert(userPantriesTable)
      .values(pantry)
      .onConflictDoUpdate({
        target: userPantriesTable.userId,
        set: { ingredients: pantry.ingredients, updatedAt: pantry.updatedAt },
      });
  }
}

export class DrizzleFavoriteRepository implements FavoriteRepository {
  constructor(private readonly db: PgDatabase<PgQueryResultHKT>) {}

  async list(userId: string): Promise<Favorite[]> {
    return this.db
      .select()
      .from(favoritesTable)
      .where(eq(favoritesTable.userId, userId))
      .orderBy(desc(favoritesTable.createdAt));
  }

  async add(favorite: Favorite): Promise<void> {
    await this.db.insert(favoritesTable).values(favorite).onConflictDoNothing();
  }

  async remove(userId: string, drinkId: string): Promise<void> {
    await this.db
      .delete(favoritesTable)
      .where(
        and(
          eq(favoritesTable.userId, userId),
          eq(favoritesTable.drinkId, drinkId),
        ),
      );
  }
}
