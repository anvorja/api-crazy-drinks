import { Drink } from './drink.js';

/** Deterministic pick: same drink for everyone on the same (UTC) day. */
export function pickDrinkOfTheDay(
  drinks: Drink[],
  date: Date,
): Drink | undefined {
  const day = date.toISOString().slice(0, 10);
  const pool = [...drinks].sort((a, b) => a.id.localeCompare(b.id));
  let hash = 0;
  for (const ch of day) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return pool[hash % pool.length];
}
