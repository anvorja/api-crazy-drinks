import { Drink } from './drink.js';

export interface DrinkRepository {
  findAll(): Promise<Drink[]>;
  findById(id: string): Promise<Drink | null>;
  searchByName(query: string): Promise<Drink[]>;
  saveMany(drinks: Drink[]): Promise<void>;
  count(): Promise<number>;
  /** Marks a full sync with the external source. */
  recordSync(at: Date): Promise<void>;
  lastSyncedAt(): Promise<Date | null>;
}
