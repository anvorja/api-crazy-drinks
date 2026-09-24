import { DrinkVisibility, isVisible } from '../../domain/drink.js';
import { FlavorDna, Twin, flavorDna, findTwins } from '../../domain/flavor.js';
import { Drink } from '../../domain/drink.js';
import { DrinkCatalog } from '../drink-catalog.js';
import { GetDrink } from './drink-queries.js';

export class GetFlavorDna {
  constructor(private readonly getDrink: GetDrink) {}

  async execute(
    id: string,
    visibility: DrinkVisibility,
  ): Promise<{ drink: Drink; dna: FlavorDna }> {
    const drink = await this.getDrink.execute(id, visibility);
    return { drink, dna: flavorDna(drink) };
  }
}

export class FindDrinkTwins {
  constructor(
    private readonly getDrink: GetDrink,
    private readonly catalog: DrinkCatalog,
  ) {}

  async execute(
    id: string,
    limit: number,
    visibility: DrinkVisibility,
  ): Promise<{ drink: Drink; twins: Twin[] }> {
    const drink = await this.getDrink.execute(id, visibility);
    const candidates = (await this.catalog.all()).filter((d) =>
      isVisible(d, visibility),
    );
    return { drink, twins: findTwins(drink, candidates, limit) };
  }
}
