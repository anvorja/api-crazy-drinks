import { Drink } from './drink.js';
import { cosine, flavorVector } from './flavor.js';
import { TasteProfile } from './taste.js';

export const REACTIONS = ['like', 'dislike', 'superlike'] as const;
export type ReactionKind = (typeof REACTIONS)[number];

/** A swipe on a drink. One per user and drink: reacting again replaces it. */
export interface Reaction {
  userId: string;
  drinkId: string;
  kind: ReactionKind;
  createdAt: Date;
}

export const isPositive = (kind: ReactionKind) => kind !== 'dislike';

export interface ReactionRepository {
  save(reaction: Reaction): Promise<void>;
  remove(userId: string, drinkId: string): Promise<void>;
  listByUser(userId: string): Promise<Reaction[]>;
}

/** Share of the deck picked for the user's taste; the rest explores. */
const EXPLOIT_SHARE = 0.7;
/** Taste picks come at random from this many best matches, so decks don't repeat. */
const EXPLOIT_POOL = 30;

function takeRandom<T>(items: T[], count: number, random: () => number): T[] {
  const pool = [...items];
  const picked: T[] = [];
  while (picked.length < count && pool.length) {
    picked.push(pool.splice(Math.floor(random() * pool.length), 1)[0]);
  }
  return picked;
}

/**
 * Next cards to swipe: unseen drinks, mostly close to the taste (when there is one)
 * plus some exploration so the profile keeps learning.
 */
export function pickDiscoverDeck(
  candidates: Drink[],
  seenIds: Set<string>,
  taste: TasteProfile | null,
  count: number,
  random: () => number,
): Drink[] {
  const unseen = candidates.filter((d) => !seenIds.has(d.id));
  if (!taste) return takeRandom(unseen, count, random);

  const ranked = unseen
    .map((drink) => ({
      drink,
      score: cosine(taste.profile, flavorVector(drink)),
    }))
    .sort((a, b) => b.score - a.score)
    .map(({ drink }) => drink);

  const forTaste = takeRandom(
    ranked.slice(0, EXPLOIT_POOL),
    Math.round(count * EXPLOIT_SHARE),
    random,
  );
  const picked = new Set(forTaste);
  const explore = takeRandom(
    ranked.filter((d) => !picked.has(d)),
    count - forTaste.length,
    random,
  );
  // Interleave so the taste picks aren't all at the start.
  return takeRandom([...forTaste, ...explore], count, random);
}
