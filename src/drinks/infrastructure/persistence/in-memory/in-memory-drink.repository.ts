import { normalizeText } from '../../../../shared/domain/text.js';
import { Drink } from '../../../domain/drink.js';
import { DrinkRepository } from '../../../domain/drink.repository.js';

/** DrinkRepository kept in process memory. Useful for tests and running without a database. */
export class InMemoryDrinkRepository implements DrinkRepository {
  private readonly drinks = new Map<string, Drink>();
  private syncedAt: Date | null = null;

  async findAll(): Promise<Drink[]> {
    return [...this.drinks.values()];
  }

  async findById(id: string): Promise<Drink | null> {
    return this.drinks.get(id) ?? null;
  }

  async searchByName(query: string): Promise<Drink[]> {
    const q = normalizeText(query);
    return [...this.drinks.values()].filter((d) =>
      normalizeText(d.name).includes(q),
    );
  }

  async saveMany(drinks: Drink[]): Promise<void> {
    for (const drink of drinks) this.drinks.set(drink.id, drink);
  }

  async recordSync(at: Date): Promise<void> {
    this.syncedAt = at;
  }

  async count(): Promise<number> {
    return this.drinks.size;
  }

  async lastSyncedAt(): Promise<Date | null> {
    return this.syncedAt;
  }
}
