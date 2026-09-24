import { ValidationError } from '../../shared/domain/errors.js';
import { normalizeText } from '../../shared/domain/text.js';

export const MAX_PANTRY_INGREDIENTS = 100;

/** What a user keeps at home, as they typed it. */
export interface UserPantry {
  userId: string;
  ingredients: string[];
  updatedAt: Date;
}

export interface Favorite {
  userId: string;
  drinkId: string;
  createdAt: Date;
}

/** Trims, drops empties and duplicates (ignoring case and accents), keeps the user's spelling. */
export function cleanPantryIngredients(input: string[]): string[] {
  const seen = new Set<string>();
  const cleaned: string[] = [];
  for (const raw of input) {
    const ingredient = raw.trim();
    const key = normalizeText(ingredient);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    cleaned.push(ingredient);
  }
  if (cleaned.length > MAX_PANTRY_INGREDIENTS) {
    throw new ValidationError(
      `A pantry holds at most ${MAX_PANTRY_INGREDIENTS} ingredients`,
    );
  }
  return cleaned;
}

export interface UserPantryRepository {
  find(userId: string): Promise<UserPantry | null>;
  save(pantry: UserPantry): Promise<void>;
}

export interface FavoriteRepository {
  /** Newest first. */
  list(userId: string): Promise<Favorite[]>;
  /** Idempotent. */
  add(favorite: Favorite): Promise<void>;
  remove(userId: string, drinkId: string): Promise<void>;
}
