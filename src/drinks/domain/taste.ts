import { Drink, ingredientKeys } from './drink.js';
import {
  FLAVOR_DIMENSIONS,
  FlavorDimension,
  FlavorVector,
  Strength,
  cosine,
  describePersonality,
  dominantTraits,
  flavorVector,
  normalizeProfile,
  strengthOf,
} from './flavor.js';

export type Confidence = 'low' | 'medium' | 'high';

/** A user's taste, learned from their favorite drinks. */
export interface TasteProfile {
  basedOn: number;
  confidence: Confidence;
  profile: FlavorVector;
  dominant: FlavorDimension[];
  personality: string;
  /** The strength that appears most among the favorites. */
  preferredStrength: Strength;
  favoriteIngredients: { ingredient: string; count: number }[];
}

export interface Recommendation {
  drink: Drink;
  /** 0-100 */
  match: number;
  reasons: string[];
}

/** Masculine adjectives, to agree with "tu lado …". */
const SIDES: Record<FlavorDimension, string> = {
  sweet: 'dulce',
  sour: 'cítrico',
  bitter: 'amargo',
  strong: 'intenso',
  fruity: 'frutal',
  herbal: 'herbal',
  creamy: 'cremoso',
  fizzy: 'burbujeante',
  spicy: 'picante',
};

/** "a, b y c"; "y" becomes "e" before an /i/ sound ("cítrico e intenso"). */
export function joinSpanish(items: string[]): string {
  if (items.length <= 1) return items.join('');
  const last = items[items.length - 1];
  const and = /^h?i(?![aeou])/i.test(last) ? 'e' : 'y';
  return `${items.slice(0, -1).join(', ')} ${and} ${last}`;
}

const PROFILE_WEIGHT = 0.7;
const INGREDIENT_WEIGHT = 0.3;
const TOP_INGREDIENTS = 5;

const confidenceFor = (count: number): Confidence =>
  count >= 8 ? 'high' : count >= 3 ? 'medium' : 'low';

function mostCommon<T>(values: T[]): T {
  const counts = new Map<T, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
}

/** Averages the flavor DNA of the favorites. Null when there are none. */
export function buildTasteProfile(favorites: Drink[]): TasteProfile | null {
  if (favorites.length === 0) return null;

  const sum = Object.fromEntries(
    FLAVOR_DIMENSIONS.map((d) => [d, 0]),
  ) as FlavorVector;
  for (const drink of favorites) {
    const vector = flavorVector(drink);
    for (const dim of FLAVOR_DIMENSIONS) sum[dim] += vector[dim];
  }
  const profile = normalizeProfile(sum);
  const dominant = dominantTraits(profile);

  const ingredientCounts = new Map<string, number>();
  for (const drink of favorites) {
    for (const key of ingredientKeys(drink)) {
      ingredientCounts.set(key, (ingredientCounts.get(key) ?? 0) + 1);
    }
  }

  return {
    basedOn: favorites.length,
    confidence: confidenceFor(favorites.length),
    profile,
    dominant,
    personality: describePersonality(dominant),
    preferredStrength: mostCommon(favorites.map(strengthOf)),
    favoriteIngredients: [...ingredientCounts.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, TOP_INGREDIENTS)
      .map(([ingredient, count]) => ({ ingredient, count })),
  };
}

/**
 * Drinks the user doesn't have yet, closest to their taste first:
 * 70% flavor similarity to the profile + 30% of the drink's ingredients they already favor.
 */
export function recommendForTaste(
  taste: TasteProfile,
  favorites: Drink[],
  candidates: Drink[],
  limit: number,
): Recommendation[] {
  const favoriteIds = new Set(favorites.map((d) => d.id));
  const favored = new Set(favorites.flatMap((d) => [...ingredientKeys(d)]));

  return candidates
    .filter((drink) => !favoriteIds.has(drink.id))
    .map((drink) => {
      const keys = [...ingredientKeys(drink)];
      const shared = keys.filter((k) => favored.has(k));
      const vector = flavorVector(drink);
      const affinity = keys.length ? shared.length / keys.length : 0;
      const score =
        PROFILE_WEIGHT * cosine(taste.profile, vector) +
        INGREDIENT_WEIGHT * affinity;
      return {
        drink,
        match: Math.round(score * 100),
        reasons: explain(
          taste,
          dominantTraits(vector),
          shared,
          strengthOf(drink),
        ),
      };
    })
    .sort(
      (a, b) => b.match - a.match || a.drink.name.localeCompare(b.drink.name),
    )
    .slice(0, limit);
}

function explain(
  taste: TasteProfile,
  drinkDominant: FlavorDimension[],
  shared: string[],
  strength: Strength,
): string[] {
  const reasons: string[] = [];
  const traits = drinkDominant.filter((d) => taste.dominant.includes(d));
  if (traits.length) {
    reasons.push(
      `Coincide con tu lado ${joinSpanish(traits.map((t) => SIDES[t]))}`,
    );
  }
  if (shared.length) {
    reasons.push(
      `Comparte ingredientes con tus favoritos: ${shared.slice(0, 3).join(', ')}`,
    );
  }
  if (strength === taste.preferredStrength) {
    reasons.push('Tiene la intensidad que sueles elegir');
  }
  return reasons.length ? reasons : ['Te saca de tu zona de confort'];
}
