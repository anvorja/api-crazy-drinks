import { UnavailableError } from '../../src/shared/domain/errors.js';
import { DrinkSource } from '../../src/drinks/application/ports/drink-source.port.js';
import { Drink } from '../../src/drinks/domain/drink.js';
import { DRINKS } from './drinks.js';

/** Offline DrinkSource. Flip `up` to simulate TheCocktailDB being down. */
export class FakeDrinkSource implements DrinkSource {
  up = true;
  fetchAllCalls = 0;

  constructor(private readonly drinks: Drink[] = DRINKS) {}

  async fetchAll(): Promise<Drink[]> {
    this.assertUp();
    this.fetchAllCalls++;
    return this.drinks;
  }

  async findById(id: string): Promise<Drink | null> {
    this.assertUp();
    return this.drinks.find((d) => d.id === id) ?? null;
  }

  async searchByName(query: string): Promise<Drink[]> {
    this.assertUp();
    return this.drinks.filter((d) =>
      d.name.toLowerCase().includes(query.toLowerCase()),
    );
  }

  async random(): Promise<Drink | null> {
    this.assertUp();
    return this.drinks[0];
  }

  async ping(): Promise<number> {
    this.assertUp();
    return 1;
  }

  private assertUp(): void {
    if (!this.up) throw new UnavailableError('down');
  }
}
