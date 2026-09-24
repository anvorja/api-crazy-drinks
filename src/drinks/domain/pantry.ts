import { normalizeText } from '../../shared/domain/text.js';
import { Drink, ingredientKey } from './drink.js';

// Assumed to be in every kitchen. They only match exactly: "water" is not "soda water".
const STAPLES = ['ice', 'water'];

// What people type -> how the catalog names it.
const SYNONYMS: Record<string, string[]> = {
  soda: ['carbonated water', 'soda water', 'club soda'],
  coke: ['coca-cola', 'cola'],
  limon: ['lemon', 'lime'],
  lima: ['lime'],
  azucar: ['sugar'],
  ron: ['rum'],
  menta: ['mint'],
  hierbabuena: ['mint'],
  leche: ['milk'],
  naranja: ['orange'],
  pina: ['pineapple'],
  sal: ['salt'],
  hielo: ['ice'],
  agua: ['water'],
  ginebra: ['gin'],
  vino: ['wine'],
  cerveza: ['beer'],
  cafe: ['coffee'],
  crema: ['cream'],
  huevo: ['egg'],
  miel: ['honey'],
  canela: ['cinnamon'],
  jengibre: ['ginger'],
  toronja: ['grapefruit'],
  pomelo: ['grapefruit'],
  maracuya: ['passion fruit'],
  coco: ['coconut'],
  fresa: ['strawberries'],
  cereza: ['cherry'],
  manzana: ['apple'],
  durazno: ['peach'],
  melocoton: ['peach'],
  mango: ['mango'],
  granadina: ['grenadine'],
  pepino: ['cucumber'],
  albahaca: ['basil'],
  romero: ['rosemary'],
};

export interface PantryMatch {
  drink: Drink;
  missing: string[];
}

export interface ShoppingTip {
  buy: string;
  unlocks: number;
  drinks: string[];
}

export interface PantryResult {
  understood: string[];
  canMake: Drink[];
  almost: PantryMatch[];
  shoppingTips: ShoppingTip[];
}

/** Expands user input with synonyms: "limón" -> ["limon", "lemon", "lime"]. */
export function understandIngredients(input: string[]): string[] {
  return input
    .map(normalizeText)
    .filter(Boolean)
    .flatMap((item) => [item, ...(SYNONYMS[item] ?? [])]);
}

const words = (value: string): string[] =>
  value.split(/[^a-z0-9]+/).filter(Boolean);

/** True when every word of `needle` is a word of `haystack`: "rum" is in "light rum", not "gin" in "ginger". */
const containsWords = (haystack: string, needle: string): boolean => {
  const available = new Set(words(haystack));
  return words(needle).every((w) => available.has(w));
};

/** The owned item that covers a recipe ingredient, if any ("rum" covers "light rum"). */
export const findOwned = (
  ingredient: string,
  owned: string[],
): string | undefined =>
  // An exact match wins: "lime" is the lime, not the "lime juice".
  owned.find((o) => o === ingredient) ??
  owned.find(
    (o) => containsWords(ingredient, o) || containsWords(o, ingredient),
  );

export const isStaple = (ingredient: string): boolean =>
  STAPLES.includes(ingredient);

export function missingIngredients(drink: Drink, owned: string[]): string[] {
  return drink.ingredients
    .map(({ name }) => ingredientKey(name))
    .filter((i) => !isStaple(i) && !findOwned(i, owned));
}

/** What can be made with `have`, what is close, and which single purchase unlocks the most. */
export function evaluatePantry(
  drinks: Drink[],
  have: string[],
  maxMissing: number,
): PantryResult {
  const understood = understandIngredients(have);
  const evaluated = drinks
    .map((drink) => ({ drink, missing: missingIngredients(drink, understood) }))
    .filter(({ missing }) => missing.length <= maxMissing);

  const almost = evaluated
    .filter((e) => e.missing.length > 0)
    .sort((a, b) => a.missing.length - b.missing.length);

  const unlocks = new Map<string, string[]>();
  for (const { drink, missing } of almost) {
    if (missing.length !== 1) continue;
    unlocks.set(missing[0], [...(unlocks.get(missing[0]) ?? []), drink.name]);
  }

  return {
    understood,
    canMake: evaluated
      .filter((e) => e.missing.length === 0)
      .map((e) => e.drink),
    almost,
    shoppingTips: [...unlocks.entries()]
      .sort((a, b) => b[1].length - a[1].length)
      .map(([buy, names]) => ({ buy, unlocks: names.length, drinks: names })),
  };
}
