import { normalizeText } from '../../shared/domain/text.js';
import { Drink, ingredientKey } from './drink.js';
import { findOwned, understandIngredients } from './pantry.js';

export interface ExploreFilters {
  /** Part of the name. */
  q?: string;
  category?: string;
  glass?: string;
  alcoholic?: boolean;
  /** Only drinks from the IBA official list. */
  iba?: boolean;
  /** The drink must have all of them (Spanish names and synonyms understood). */
  ingredients: string[];
}

/** Position after which the next page starts (drinks are sorted by name, then id). */
export interface PageCursor {
  name: string;
  id: string;
}

export interface Page<T> {
  items: T[];
  total: number;
  nextCursor: PageCursor | null;
}

const byNameThenId = (a: Drink, b: Drink) =>
  a.name.localeCompare(b.name) || a.id.localeCompare(b.id);

const isAfter = (drink: Drink, cursor: PageCursor) =>
  byNameThenId(drink, { ...drink, name: cursor.name, id: cursor.id }) > 0;

export function matchesFilters(drink: Drink, filters: ExploreFilters): boolean {
  if (
    filters.q &&
    !normalizeText(drink.name).includes(normalizeText(filters.q))
  )
    return false;
  if (
    filters.category &&
    normalizeText(drink.category ?? '') !== normalizeText(filters.category)
  ) {
    return false;
  }
  if (
    filters.glass &&
    normalizeText(drink.glass ?? '') !== normalizeText(filters.glass)
  ) {
    return false;
  }
  if (filters.alcoholic !== undefined && drink.alcoholic !== filters.alcoholic)
    return false;
  if (filters.iba !== undefined && (drink.iba !== null) !== filters.iba)
    return false;

  const keys = drink.ingredients.map(({ name }) => ingredientKey(name));
  // Each requested ingredient (with its synonyms) must be covered by some ingredient of the drink.
  return filters.ingredients.every((wanted) => {
    const variants = understandIngredients([wanted]);
    return keys.some((key) => findOwned(key, variants) !== undefined);
  });
}

/** Filtered, sorted and paginated with a stable cursor (good for infinite scroll). */
export function exploreDrinks(
  drinks: Drink[],
  filters: ExploreFilters,
  page: { limit: number; after: PageCursor | null },
): Page<Drink> {
  const matching = drinks
    .filter((d) => matchesFilters(d, filters))
    .sort(byNameThenId);
  const start = page.after
    ? matching.filter((d) => isAfter(d, page.after!))
    : matching;
  const items = start.slice(0, page.limit);
  const last = items.at(-1);
  return {
    items,
    total: matching.length,
    nextCursor:
      last && start.length > page.limit
        ? { name: last.name, id: last.id }
        : null,
  };
}

export interface FacetValue {
  value: string;
  count: number;
}

export interface Facets {
  categories: FacetValue[];
  glasses: FacetValue[];
  ingredients: FacetValue[];
  alcoholic: { alcoholic: number; nonAlcoholic: number };
  total: number;
}

function countBy(values: string[]): FacetValue[] {
  const counts = new Map<string, FacetValue>();
  for (const value of values) {
    const key = normalizeText(value);
    const facet = counts.get(key) ?? { value, count: 0 };
    facet.count++;
    counts.set(key, facet);
  }
  return [...counts.values()].sort(
    (a, b) => b.count - a.count || a.value.localeCompare(b.value),
  );
}

/** What the filters can offer, with how many drinks each value has. */
export function facetsOf(drinks: Drink[], topIngredients: number): Facets {
  return {
    categories: countBy(
      drinks.flatMap((d) => (d.category ? [d.category] : [])),
    ),
    glasses: countBy(drinks.flatMap((d) => (d.glass ? [d.glass] : []))),
    ingredients: countBy(
      drinks.flatMap((d) => d.ingredients.map((i) => i.name)),
    ).slice(0, topIngredients),
    alcoholic: {
      alcoholic: drinks.filter((d) => d.alcoholic).length,
      nonAlcoholic: drinks.filter((d) => !d.alcoholic).length,
    },
    total: drinks.length,
  };
}
