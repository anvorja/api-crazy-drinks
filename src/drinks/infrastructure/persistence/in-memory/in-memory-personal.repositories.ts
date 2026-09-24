import {
  Favorite,
  FavoriteRepository,
  UserPantry,
  UserPantryRepository,
} from '../../../domain/personal.js';

export class InMemoryUserPantryRepository implements UserPantryRepository {
  private readonly pantries = new Map<string, UserPantry>();

  async find(userId: string): Promise<UserPantry | null> {
    return this.pantries.get(userId) ?? null;
  }

  async save(pantry: UserPantry): Promise<void> {
    this.pantries.set(pantry.userId, {
      ...pantry,
      ingredients: [...pantry.ingredients],
    });
  }
}

export class InMemoryFavoriteRepository implements FavoriteRepository {
  private favorites: Favorite[] = [];

  async list(userId: string): Promise<Favorite[]> {
    return this.favorites
      .filter((f) => f.userId === userId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async add(favorite: Favorite): Promise<void> {
    const exists = this.favorites.some(
      (f) => f.userId === favorite.userId && f.drinkId === favorite.drinkId,
    );
    if (!exists) this.favorites.push({ ...favorite });
  }

  async remove(userId: string, drinkId: string): Promise<void> {
    this.favorites = this.favorites.filter(
      (f) => f.userId !== userId || f.drinkId !== drinkId,
    );
  }
}
