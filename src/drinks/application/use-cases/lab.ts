import {
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from '../../../shared/domain/errors.js';
import { Drink, DrinkVisibility, isVisible } from '../../domain/drink.js';
import { MOODS, Mood, findMood, rankByMood } from '../../domain/mood.js';
import { PantryResult, evaluatePantry } from '../../domain/pantry.js';
import { DrinkCatalog } from '../drink-catalog.js';
import { AGE_RESTRICTED_MESSAGE } from './drink-queries.js';

export interface PantryQuery {
  have: string[];
  maxMissing: number;
  alcoholic?: boolean;
  limit: number;
}

export interface PantrySuggestion extends PantryResult {
  totals: { canMake: number; almost: number };
}

export class SuggestFromPantry {
  constructor(private readonly catalog: DrinkCatalog) {}

  async execute(
    query: PantryQuery,
    visibility: DrinkVisibility,
  ): Promise<PantrySuggestion> {
    if (query.have.length === 0) {
      throw new ValidationError('Tell us at least one ingredient you have');
    }
    const drinks = (await this.catalog.all()).filter(
      (d) =>
        isVisible(d, visibility) &&
        (query.alcoholic === undefined || d.alcoholic === query.alcoholic),
    );
    const result = evaluatePantry(drinks, query.have, query.maxMissing);
    return {
      understood: result.understood,
      canMake: result.canMake.slice(0, query.limit),
      almost: result.almost.slice(0, query.limit),
      shoppingTips: result.shoppingTips.slice(0, 5),
      totals: { canMake: result.canMake.length, almost: result.almost.length },
    };
  }
}

export interface MoodRecommendation {
  mood: Mood;
  drink: Drink;
  alternatives: Drink[];
}

export class RecommendByMood {
  constructor(
    private readonly catalog: DrinkCatalog,
    private readonly random: () => number = Math.random,
  ) {}

  async execute(
    input: string,
    visibility: DrinkVisibility,
  ): Promise<MoodRecommendation> {
    const mood = findMood(input);
    if (!mood) {
      throw new NotFoundError(
        `Unknown mood "${input}". Try: ${MOODS.map((m) => m.key).join(', ')}`,
        'MOOD_NOT_FOUND',
      );
    }
    if (mood.alcoholic && !visibility.includeAlcoholic) {
      throw new ForbiddenError(AGE_RESTRICTED_MESSAGE, 'AGE_RESTRICTED');
    }
    const drinks = (await this.catalog.all()).filter((d) =>
      isVisible(d, visibility),
    );
    // A bit of chance among the best 10 keeps it fun.
    const top = rankByMood(drinks, mood).slice(0, 10);
    if (top.length === 0)
      throw new NotFoundError('No drinks available for that mood');
    const drink = top[Math.floor(this.random() * top.length)];
    return {
      mood,
      drink,
      alternatives: top.filter((d) => d !== drink).slice(0, 3),
    };
  }
}

export class ListMoods {
  execute(): Mood[] {
    return MOODS;
  }
}
