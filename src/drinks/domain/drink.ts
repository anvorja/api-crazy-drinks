import { normalizeText } from '../../shared/domain/text.js';

export interface Ingredient {
  name: string;
  measure: string | null;
  /** Picture of the ingredient, when the source provides one. */
  image?: string | null;
}

export interface Drink {
  id: string;
  name: string;
  category: string | null;
  alcoholic: boolean;
  glass: string | null;
  iba: string | null;
  tags: string[];
  image: string | null;
  video: string | null;
  instructions: { en: string | null; es: string | null };
  ingredients: Ingredient[];
}

export interface DrinkSummary {
  id: string;
  name: string;
  image: string | null;
}

export const toSummary = ({ id, name, image }: Drink): DrinkSummary => ({
  id,
  name,
  image,
});

export const ingredientKey = (name: string): string => normalizeText(name);

export const ingredientKeys = (drink: Drink): Set<string> =>
  new Set(drink.ingredients.map(({ name }) => ingredientKey(name)));

/** Visibility rule shared by every query: minors and anonymous viewers never get alcohol. */
export interface DrinkVisibility {
  includeAlcoholic: boolean;
}

export const isVisible = (
  drink: Drink,
  { includeAlcoholic }: DrinkVisibility,
): boolean => includeAlcoholic || !drink.alcoholic;
