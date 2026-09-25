import { normalizeText } from '../../shared/domain/text.js';
import { Drink } from './drink.js';

export type Suggestion =
  | { kind: 'drink'; value: string; drink: Drink; score: number }
  | { kind: 'ingredient'; value: string; image: string | null; score: number };

const MIN_SCORE = 0.3;

function trigrams(value: string): Set<string> {
  const padded = `  ${normalizeText(value)} `;
  const grams = new Set<string>();
  for (let i = 0; i < padded.length - 2; i++) grams.add(padded.slice(i, i + 3));
  return grams;
}

/** Trigram similarity (0-1): tolerant to typos like "margarta" or "mojto". */
export function similarity(a: string, b: string): number {
  const ga = trigrams(a);
  const gb = trigrams(b);
  const shared = [...ga].filter((g) => gb.has(g)).length;
  return shared / (ga.size + gb.size - shared || 1);
}

/** Prefix and word-prefix matches rank first; then fuzzy similarity. */
export function matchScore(query: string, candidate: string): number {
  const q = normalizeText(query);
  const c = normalizeText(candidate);
  if (!q) return 0;
  if (c === q) return 1;
  if (c.startsWith(q)) return 0.95;
  if (c.split(/\s+/).some((word) => word.startsWith(q))) return 0.9;
  if (c.includes(q)) return 0.8;
  return similarity(q, c);
}

/** Autocomplete over drink and ingredient names, best first. */
export function suggest(
  query: string,
  drinks: Drink[],
  limit: number,
): Suggestion[] {
  const drinkHits: Suggestion[] = drinks.map((drink) => ({
    kind: 'drink',
    value: drink.name,
    drink,
    score: matchScore(query, drink.name),
  }));

  // First spelling and first picture seen for each ingredient.
  const ingredients = new Map<string, { name: string; image: string | null }>();
  for (const drink of drinks) {
    for (const { name, image } of drink.ingredients) {
      const key = normalizeText(name);
      const seen = ingredients.get(key);
      if (!seen) ingredients.set(key, { name, image: image ?? null });
      else if (!seen.image && image) seen.image = image;
    }
  }
  const ingredientHits: Suggestion[] = [...ingredients.values()].map(
    ({ name, image }) => ({
      kind: 'ingredient',
      value: name,
      image,
      score: matchScore(query, name),
    }),
  );

  return [...drinkHits, ...ingredientHits]
    .filter((s) => s.score >= MIN_SCORE)
    .sort((a, b) => b.score - a.score || a.value.localeCompare(b.value))
    .slice(0, limit);
}
