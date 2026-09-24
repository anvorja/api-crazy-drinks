import { and, asc, eq } from 'drizzle-orm';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import {
  CocktleGame,
  CocktleGameRepository,
  CocktleMode,
} from '../../../domain/cocktle.js';
import { cocktleGamesTable } from './cocktle.schema.js';

export class DrizzleCocktleGameRepository implements CocktleGameRepository {
  constructor(private readonly db: PgDatabase<PgQueryResultHKT>) {}

  async find(
    userId: string,
    day: string,
    mode: CocktleMode,
  ): Promise<CocktleGame | null> {
    const [row] = await this.db
      .select()
      .from(cocktleGamesTable)
      .where(
        and(
          eq(cocktleGamesTable.userId, userId),
          eq(cocktleGamesTable.day, day),
          eq(cocktleGamesTable.mode, mode),
        ),
      );
    return row ?? null;
  }

  async save(game: CocktleGame): Promise<void> {
    await this.db
      .insert(cocktleGamesTable)
      .values(game)
      .onConflictDoUpdate({
        target: [
          cocktleGamesTable.userId,
          cocktleGamesTable.day,
          cocktleGamesTable.mode,
        ],
        set: { guesses: game.guesses, solved: game.solved },
      });
  }

  async listByUser(userId: string, mode: CocktleMode): Promise<CocktleGame[]> {
    return this.db
      .select()
      .from(cocktleGamesTable)
      .where(
        and(
          eq(cocktleGamesTable.userId, userId),
          eq(cocktleGamesTable.mode, mode),
        ),
      )
      .orderBy(asc(cocktleGamesTable.day));
  }
}
