import {
  TasteShare,
  TasteShareRepository,
} from '../../../domain/taste-share.js';

export class InMemoryTasteShareRepository implements TasteShareRepository {
  private readonly shares = new Map<string, TasteShare>();

  async findByUser(userId: string): Promise<TasteShare | null> {
    return this.shares.get(userId) ?? null;
  }

  async findBySlug(slug: string): Promise<TasteShare | null> {
    return [...this.shares.values()].find((s) => s.slug === slug) ?? null;
  }

  async save(share: TasteShare): Promise<void> {
    this.shares.set(share.userId, { ...share });
  }

  async removeByUser(userId: string): Promise<void> {
    this.shares.delete(userId);
  }
}
