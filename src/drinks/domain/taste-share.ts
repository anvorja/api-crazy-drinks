import { ValidationError } from '../../shared/domain/errors.js';
import { Drink } from './drink.js';
import {
  FLAVOR_DIMENSIONS,
  FlavorDimension,
  cosine,
  flavorVector,
  jaccard,
} from './flavor.js';
import { SIDES, TasteProfile, joinSpanish } from './taste.js';

/** A public, revocable link to someone's taste. Shows only the name they chose. */
export interface TasteShare {
  userId: string;
  slug: string;
  displayName: string;
  createdAt: Date;
}

export interface TasteShareRepository {
  findByUser(userId: string): Promise<TasteShare | null>;
  findBySlug(slug: string): Promise<TasteShare | null>;
  save(share: TasteShare): Promise<void>;
  removeByUser(userId: string): Promise<void>;
}

export const MAX_DISPLAY_NAME = 40;

export function cleanDisplayName(name: string): string {
  const cleaned = name.trim().replace(/\s+/g, ' ');
  if (!cleaned || cleaned.length > MAX_DISPLAY_NAME) {
    throw new ValidationError(
      `The display name needs 1 to ${MAX_DISPLAY_NAME} characters`,
    );
  }
  return cleaned;
}

export interface BridgeDrink {
  drink: Drink;
  /** 0-100: how much each one would like it. */
  forYou: number;
  forThem: number;
}

export interface Compatibility {
  /** 0-100 */
  score: number;
  sharedTraits: FlavorDimension[];
  onlyYou: FlavorDimension[];
  onlyThem: FlavorDimension[];
  sharedIngredients: string[];
  /** Drinks neither has seen that both would enjoy. */
  bridges: BridgeDrink[];
}

const FLAVOR_WEIGHT = 0.75;
const INGREDIENT_WEIGHT = 0.25;
/** A dimension counts as a trait of a person from this score. */
const TRAIT_THRESHOLD = 50;

const traitsOf = (taste: TasteProfile) =>
  FLAVOR_DIMENSIONS.filter((d) => taste.profile[d] >= TRAIT_THRESHOLD);

/**
 * How compatible two tastes are (75% flavor similarity + 25% shared favorite ingredients),
 * what they share, what sets them apart, and bridge drinks: the ones where the least
 * enthusiastic of the two is happiest.
 */
export function compareTastes(
  you: TasteProfile,
  them: TasteProfile,
  candidates: Drink[],
  seenIds: Set<string>,
  bridgeCount: number,
): Compatibility {
  const yourIngredients = new Set(
    you.favoriteIngredients.map((i) => i.ingredient),
  );
  const theirIngredients = new Set(
    them.favoriteIngredients.map((i) => i.ingredient),
  );
  const score =
    FLAVOR_WEIGHT * cosine(you.profile, them.profile) +
    INGREDIENT_WEIGHT * jaccard(yourIngredients, theirIngredients);

  const yourTraits = traitsOf(you);
  const theirTraits = traitsOf(them);

  const bridges = candidates
    .filter((d) => !seenIds.has(d.id))
    .map((drink) => {
      const vector = flavorVector(drink);
      const forYou = cosine(you.profile, vector);
      const forThem = cosine(them.profile, vector);
      return { drink, forYou, forThem, both: Math.min(forYou, forThem) };
    })
    .sort((a, b) => b.both - a.both || a.drink.name.localeCompare(b.drink.name))
    .slice(0, bridgeCount)
    .map(({ drink, forYou, forThem }) => ({
      drink,
      forYou: Math.round(forYou * 100),
      forThem: Math.round(forThem * 100),
    }));

  return {
    score: Math.round(score * 100),
    sharedTraits: yourTraits.filter((d) => theirTraits.includes(d)),
    onlyYou: yourTraits.filter((d) => !theirTraits.includes(d)),
    onlyThem: theirTraits.filter((d) => !yourTraits.includes(d)),
    sharedIngredients: [...yourIngredients].filter((i) =>
      theirIngredients.has(i),
    ),
    bridges,
  };
}

/** "72 % compatibles · Muy compatibles: los dos son del lado cítrico e intenso". */
export function compatibilityHeadline(c: Compatibility): string {
  const verdict =
    c.score >= 85
      ? '¡Almas gemelas del sabor!'
      : c.score >= 65
        ? 'Muy compatibles'
        : c.score >= 45
          ? 'Se entienden en la barra'
          : 'Polos opuestos: perfectos para probar cosas nuevas';
  const shared = c.sharedTraits.length
    ? `: los dos son del lado ${joinSpanish(c.sharedTraits.map((t) => SIDES[t]))}`
    : '';
  return `${c.score} % compatibles · ${verdict}${shared}`;
}
