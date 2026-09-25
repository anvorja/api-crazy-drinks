import { Drink, DrinkVisibility, isVisible } from '../../domain/drink.js';
import {
  ExploreFilters,
  Facets,
  Page,
  PageCursor,
  exploreDrinks,
  facetsOf,
} from '../../domain/explore.js';
import { Suggestion, suggest } from '../../domain/suggest.js';
import { DrinkCatalog } from '../drink-catalog.js';

const TOP_INGREDIENT_FACETS = 40;

export class ExploreDrinks {
  constructor(private readonly catalog: DrinkCatalog) {}

  async execute(
    filters: ExploreFilters,
    page: { limit: number; after: PageCursor | null },
    visibility: DrinkVisibility,
  ): Promise<Page<Drink>> {
    const drinks = (await this.catalog.all()).filter((d) =>
      isVisible(d, visibility),
    );
    return exploreDrinks(drinks, filters, page);
  }
}

export class GetDrinkFacets {
  constructor(private readonly catalog: DrinkCatalog) {}

  async execute(visibility: DrinkVisibility): Promise<Facets> {
    const drinks = (await this.catalog.all()).filter((d) =>
      isVisible(d, visibility),
    );
    return facetsOf(drinks, TOP_INGREDIENT_FACETS);
  }
}

export class SuggestDrinks {
  constructor(private readonly catalog: DrinkCatalog) {}

  async execute(
    query: string,
    limit: number,
    visibility: DrinkVisibility,
  ): Promise<Suggestion[]> {
    const drinks = (await this.catalog.all()).filter((d) =>
      isVisible(d, visibility),
    );
    return suggest(query, drinks, limit);
  }
}
