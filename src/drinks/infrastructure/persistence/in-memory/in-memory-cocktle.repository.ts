import {
  CocktleGame,
  CocktleGameRepository,
  CocktleMode,
} from '../../../domain/cocktle.js';

export class InMemoryCocktleGameRepository implements CocktleGameRepository {
  private readonly games = new Map<string, CocktleGame>();

  private key = (userId: string, day: string, mode: CocktleMode) =>
    `${userId}:${day}:${mode}`;

  async find(
    userId: string,
    day: string,
    mode: CocktleMode,
  ): Promise<CocktleGame | null> {
    return this.games.get(this.key(userId, day, mode)) ?? null;
  }

  async save(game: CocktleGame): Promise<void> {
    this.games.set(this.key(game.userId, game.day, game.mode), {
      ...game,
      guesses: [...game.guesses],
    });
  }

  async listByUser(userId: string, mode: CocktleMode): Promise<CocktleGame[]> {
    return [...this.games.values()]
      .filter((g) => g.userId === userId && g.mode === mode)
      .sort((a, b) => a.day.localeCompare(b.day));
  }
}
