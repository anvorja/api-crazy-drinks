import { Drink, ingredientKey, ingredientKeys } from './drink.js';

export const FLAVOR_DIMENSIONS = [
  'sweet',
  'sour',
  'bitter',
  'strong',
  'fruity',
  'herbal',
  'creamy',
  'fizzy',
  'spicy',
] as const;

export type FlavorDimension = (typeof FLAVOR_DIMENSIONS)[number];
export type FlavorVector = Record<FlavorDimension, number>;
export type Strength = 'zero' | 'light' | 'medium' | 'strong';

export interface FlavorDna {
  profile: FlavorVector;
  dominant: FlavorDimension[];
  personality: string;
  strength: Strength;
  complexity: number;
}

type Rule = [keywords: string[], weights: Partial<FlavorVector>];

// Keywords match whole words; a trailing * matches a word prefix ("whisk*" -> whiskey, whisky).
const SPIRITS = [
  'vodka',
  'gin',
  'rum',
  'tequila',
  'whisk*',
  'bourbon',
  'scotch',
  'brandy',
  'cognac',
  'mezcal',
  'absinthe',
  'everclear',
  'pisco',
  'cachaca',
  'aquavit',
  'grain alcohol',
];

// Heuristic: each ingredient contributes to the dimensions its keywords hint at.
const RULES: Rule[] = [
  [SPIRITS, { strong: 3 }],
  [
    [
      'liqueur',
      'triple sec',
      'cointreau',
      'amaretto',
      'kahlua',
      'schnapps',
      'curacao',
      'grand marnier',
      'galliano',
      'midori',
      'chambord',
      'frangelico',
      'creme de',
      'sambuca',
    ],
    { strong: 1.5, sweet: 2 },
  ],
  [['vermouth', 'port', 'sherry', 'wine', 'lillet'], { strong: 1, herbal: 1 }],
  [
    [
      'bitters',
      'bitter',
      'campari',
      'aperol',
      'angostura',
      'fernet',
      'tonic',
      'coffee',
      'espresso',
    ],
    { bitter: 3 },
  ],
  [
    ['lime', 'lemon', 'sour', 'grapefruit', 'cranberr*', 'passion', 'vinegar'],
    { sour: 3 },
  ],
  [
    [
      'sugar',
      'syrup',
      'grenadine',
      'honey',
      'cola',
      'chocolate',
      'vanilla',
      'caramel',
      'sweet',
      'agave',
      'marshmallow*',
    ],
    { sweet: 3 },
  ],
  [
    [
      'orange',
      'pineapple',
      'apple',
      'cherr*',
      'strawberr*',
      'raspberr*',
      'blueberr*',
      'blackberr*',
      'berr*',
      'banana',
      'mango',
      'peach',
      'grape',
      'grapefruit',
      'melon',
      'watermelon',
      'coconut',
      'passion',
      'kiwi',
      'apricot',
      'pear',
      'lime',
      'lemon',
      'juice',
      'fruit',
    ],
    { fruity: 2 },
  ],
  [
    [
      'mint',
      'peppermint',
      'basil',
      'rosemary',
      'thyme',
      'anis*',
      'absinthe',
      'chartreuse',
      'cucumber',
      'tea',
      'sage',
      'benedictine',
      'jagermeister',
      'lavender',
      'gin',
      'herb*',
    ],
    { herbal: 2.5 },
  ],
  [
    [
      'cream',
      'milk',
      'baileys',
      'egg',
      'eggnog',
      'yoghurt',
      'yogurt',
      'half-and-half',
      'butter',
    ],
    { creamy: 3 },
  ],
  [
    [
      'soda',
      'tonic',
      'champagne',
      'prosecco',
      'ginger ale',
      'ginger beer',
      'sprite',
      '7-up',
      'cola',
      'beer',
      'lemonade',
      'sparkling',
      'cider',
      'carbonated',
    ],
    { fizzy: 3 },
  ],
  [
    [
      'ginger',
      'pepper',
      'tabasco',
      'chili*',
      'cinnamon',
      'nutmeg',
      'clove*',
      'worcestershire',
      'jalapeno',
      'cayenne',
      'horseradish',
      'wasabi',
    ],
    { spicy: 3 },
  ],
];

const escapeRegExp = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const toMatcher = (keyword: string): RegExp =>
  keyword.endsWith('*')
    ? new RegExp(`\\b${escapeRegExp(keyword.slice(0, -1))}`)
    : new RegExp(`\\b${escapeRegExp(keyword)}\\b`);

const SPIRIT_MATCHERS = SPIRITS.map(toMatcher);
const RULE_MATCHERS = RULES.map(
  ([keywords, weights]) => [keywords.map(toMatcher), weights] as const,
);

const matchesAny = (ingredient: string, matchers: RegExp[]) =>
  matchers.some((m) => m.test(ingredient));

/**
 * Gender-neutral: the adjective agrees with a noun (paladar, espíritu…), not with the person,
 * so it reads right for anyone's taste and for a drink.
 */
const PERSONALITIES: Record<FlavorDimension, string> = {
  sweet: 'Paladar goloso',
  sour: 'Espíritu ácido y rebelde',
  bitter: 'Mente intelectual y amarga',
  strong: 'Carácter que no perdona',
  fruity: 'Espíritu tropical',
  herbal: 'Paladar botánico',
  creamy: 'Corazón de postre',
  fizzy: 'Espíritu burbujeante',
  spicy: 'Paladar picante',
};

export const SOULS: Record<FlavorDimension, string> = {
  sweet: 'dulce',
  sour: 'cítrica',
  bitter: 'amarga',
  strong: 'intensa',
  fruity: 'frutal',
  herbal: 'herbal',
  creamy: 'cremosa',
  fizzy: 'burbujeante',
  spicy: 'picante',
};

const DOMINANT_THRESHOLD = 60;

const zero = (): FlavorVector =>
  Object.fromEntries(FLAVOR_DIMENSIONS.map((d) => [d, 0])) as FlavorVector;

/** Returns a 0-100 profile relative to the drink's dominant trait. */
export function flavorVector(drink: Drink): FlavorVector {
  const raw = zero();
  for (const { name } of drink.ingredients) {
    const ingredient = ingredientKey(name);
    for (const [matchers, weights] of RULE_MATCHERS) {
      if (!matchesAny(ingredient, matchers)) continue;
      for (const [dim, w] of Object.entries(weights) as [
        FlavorDimension,
        number,
      ][]) {
        raw[dim] += w;
      }
    }
  }
  if (!drink.alcoholic) raw.strong = 0;

  const max = Math.max(...Object.values(raw));
  if (max === 0) return raw;
  for (const dim of FLAVOR_DIMENSIONS)
    raw[dim] = Math.round((raw[dim] / max) * 100);
  return raw;
}

export function strengthOf(drink: Drink): Strength {
  if (!drink.alcoholic) return 'zero';
  const spirits = drink.ingredients.filter(({ name }) =>
    matchesAny(ingredientKey(name), SPIRIT_MATCHERS),
  ).length;
  const ratio = spirits / Math.max(drink.ingredients.length, 1);
  if (spirits >= 3 || ratio >= 0.6) return 'strong';
  if (spirits >= 1) return 'medium';
  return 'light';
}

/** Dimensions scoring 60+ in a 0-100 profile, strongest first. */
export const dominantTraits = (profile: FlavorVector): FlavorDimension[] =>
  FLAVOR_DIMENSIONS.filter((d) => profile[d] >= DOMINANT_THRESHOLD).sort(
    (a, b) => profile[b] - profile[a],
  );

/** Rescales so the strongest dimension is 100 (all zeros stay zeros). */
export function normalizeProfile(raw: FlavorVector): FlavorVector {
  const max = Math.max(...Object.values(raw));
  const out = { ...raw };
  for (const dim of FLAVOR_DIMENSIONS)
    out[dim] = max ? Math.round((raw[dim] / max) * 100) : 0;
  return out;
}

export function flavorDna(drink: Drink): FlavorDna {
  const profile = flavorVector(drink);
  const dominant = dominantTraits(profile);
  return {
    profile,
    dominant,
    personality: describePersonality(dominant),
    strength: strengthOf(drink),
    complexity: drink.ingredients.length,
  };
}

/** "Paladar goloso con alma cremosa": from the two strongest traits. */
export function describePersonality([
  first,
  second,
]: FlavorDimension[]): string {
  if (!first) return 'Paladar misterioso';
  return second
    ? `${PERSONALITIES[first]} con alma ${SOULS[second]}`
    : PERSONALITIES[first];
}

export function cosine(a: FlavorVector, b: FlavorVector): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (const d of FLAVOR_DIMENSIONS) {
    dot += a[d] * b[d];
    na += a[d] ** 2;
    nb += b[d] ** 2;
  }
  return na && nb ? dot / Math.sqrt(na * nb) : 0;
}

export function jaccard(a: Set<string>, b: Set<string>): number {
  const shared = [...a].filter((x) => b.has(x)).length;
  const union = a.size + b.size - shared;
  return union ? shared / union : 0;
}

export interface Twin {
  drink: Drink;
  similarity: number;
  sharedIngredients: string[];
}

/** 60% shared ingredients (Jaccard) + 40% flavor similarity (cosine), as 0-100. */
export function findTwins(
  target: Drink,
  candidates: Drink[],
  limit: number,
): Twin[] {
  const targetKeys = ingredientKeys(target);
  const targetFlavor = flavorVector(target);
  return candidates
    .filter((d) => d.id !== target.id)
    .map((drink) => {
      const keys = ingredientKeys(drink);
      const score =
        0.6 * jaccard(targetKeys, keys) +
        0.4 * cosine(targetFlavor, flavorVector(drink));
      return {
        drink,
        similarity: Math.round(score * 100),
        sharedIngredients: [...keys].filter((k) => targetKeys.has(k)),
      };
    })
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, limit);
}
