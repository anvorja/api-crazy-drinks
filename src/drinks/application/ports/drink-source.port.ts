import { Drink } from '../../domain/drink.js';

/**
 * External provider of drinks (TheCocktailDB). Optional: without it the catalog is the
 * local snapshot. Throws UnavailableError when down.
 */
export interface DrinkSource {
  fetchAll(): Promise<Drink[]>;
  findById(id: string): Promise<Drink | null>;
  searchByName(query: string): Promise<Drink[]>;
  random(): Promise<Drink | null>;
  /** Round-trip latency in ms. */
  ping(): Promise<number>;
}
