import {
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from '../../../shared/domain/errors.js';
import { Drink, DrinkVisibility, isVisible } from '../../domain/drink.js';
import { pickDrinkOfTheDay } from '../../domain/drink-of-the-day.js';
import { DrinkCatalog } from '../drink-catalog.js';

export const AGE_RESTRICTED_MESSAGE =
  'This drink contains alcohol: sign in with a verified adult account to see it';

export class SearchDrinks {
  constructor(private readonly catalog: DrinkCatalog) {}

  async execute(query: string, visibility: DrinkVisibility): Promise<Drink[]> {
    const q = query.trim();
    if (!q) throw new ValidationError('Search query cannot be empty');
    return (await this.catalog.search(q)).filter((d) =>
      isVisible(d, visibility),
    );
  }
}

export class GetDrink {
  constructor(private readonly catalog: DrinkCatalog) {}

  async execute(id: string, visibility: DrinkVisibility): Promise<Drink> {
    const drink = await this.catalog.findById(id);
    if (!drink)
      throw new NotFoundError(`Drink ${id} not found`, 'DRINK_NOT_FOUND');
    if (!isVisible(drink, visibility))
      throw new ForbiddenError(AGE_RESTRICTED_MESSAGE, 'AGE_RESTRICTED');
    return drink;
  }
}

export class GetRandomDrink {
  constructor(
    private readonly catalog: DrinkCatalog,
    private readonly random: () => number = Math.random,
  ) {}

  async execute(
    alcoholic: boolean | undefined,
    visibility: DrinkVisibility,
  ): Promise<Drink> {
    if (alcoholic && !visibility.includeAlcoholic)
      throw new ForbiddenError(AGE_RESTRICTED_MESSAGE, 'AGE_RESTRICTED');

    // Unfiltered requests go upstream (when there is one) for the widest variety.
    if (alcoholic === undefined && visibility.includeAlcoholic) {
      const drink = await this.catalog.random();
      if (drink) return drink;
    }
    const pool = (await this.catalog.all()).filter(
      (d) =>
        isVisible(d, visibility) &&
        (alcoholic === undefined || d.alcoholic === alcoholic),
    );
    if (pool.length === 0)
      throw new NotFoundError('No drinks match that filter');
    return pool[Math.floor(this.random() * pool.length)];
  }
}

export class GetDrinkOfTheDay {
  constructor(
    private readonly catalog: DrinkCatalog,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async execute(
    visibility: DrinkVisibility,
  ): Promise<{ date: string; drink: Drink }> {
    const today = this.now();
    const pool = (await this.catalog.all()).filter((d) =>
      isVisible(d, visibility),
    );
    const drink = pickDrinkOfTheDay(pool, today);
    if (!drink) throw new NotFoundError('The catalog is empty');
    return { date: today.toISOString().slice(0, 10), drink };
  }
}
