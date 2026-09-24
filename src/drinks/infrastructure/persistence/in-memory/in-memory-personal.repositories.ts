import { Reaction, ReactionRepository } from '../../../domain/reactions.js';
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

export class InMemoryReactionRepository implements ReactionRepository {
  private readonly reactions = new Map<string, Reaction>();

  async save(reaction: Reaction): Promise<void> {
    this.reactions.set(`${reaction.userId}:${reaction.drinkId}`, {
      ...reaction,
    });
  }

  async remove(userId: string, drinkId: string): Promise<void> {
    this.reactions.delete(`${userId}:${drinkId}`);
  }

  async listByUser(userId: string): Promise<Reaction[]> {
    return [...this.reactions.values()]
      .filter((r) => r.userId === userId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }
}
