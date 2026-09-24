import { Drink } from '../../domain/drink.js';

/** External provider of drinks (TheCocktailDB today). Throws UnavailableError when down. */
export interface DrinkSource {
  fetchAll(): Promise<Drink[]>;
  findById(id: string): Promise<Drink | null>;
  searchByName(query: string): Promise<Drink[]>;
  random(): Promise<Drink | null>;
  /** Round-trip latency in ms. */
  ping(): Promise<number>;
}
