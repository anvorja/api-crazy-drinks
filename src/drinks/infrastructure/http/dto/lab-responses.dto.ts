import { z } from 'zod';
import { toSummary } from '../../../domain/drink.js';
import { Mood } from '../../../domain/mood.js';
import {
  MoodRecommendation,
  PantrySuggestion,
} from '../../../application/use-cases/lab.js';
import {
  drinkResponseSchema,
  drinkSummaryResponseSchema,
  toDrinkResponse,
} from './drink-responses.dto.js';

export const moodResponseSchema = z
  .object({
    key: z.string().meta({ example: 'hungover' }),
    aliases: z.array(z.string()).meta({ example: ['guayabo', 'resaca'] }),
    description: z.string(),
    alcoholic: z.union([z.boolean(), z.literal('any')]).meta({
      description: 'Whether the mood forces alcoholic/alcohol-free drinks',
    }),
  })
  .meta({ id: 'Mood' });

export const moodListResponseSchema = z.array(moodResponseSchema);

export const moodRecommendationResponseSchema = z
  .object({
    mood: z.string(),
    why: z.string(),
    drink: drinkResponseSchema,
    alternatives: z.array(drinkSummaryResponseSchema),
  })
  .meta({ id: 'MoodRecommendation' });

export const pantryResponseSchema = z
  .object({
    have: z
      .array(z.string())
      .meta({ description: 'What was understood, synonyms included' }),
    canMake: z.array(drinkResponseSchema),
    almost: z.array(
      drinkSummaryResponseSchema.extend({ missing: z.array(z.string()) }),
    ),
    shoppingTips: z.array(
      z
        .object({
          buy: z.string().meta({ example: 'gin' }),
          unlocks: z.number().int(),
          drinks: z.array(z.string()),
        })
        .meta({ id: 'ShoppingTip' }),
    ),
    totals: z.object({ canMake: z.number().int(), almost: z.number().int() }),
  })
  .meta({ id: 'PantrySuggestions' });

export const toMoodResponse = (
  mood: Mood,
): z.infer<typeof moodResponseSchema> => ({
  key: mood.key,
  aliases: mood.aliases,
  description: mood.description,
  alcoholic: mood.alcoholic ?? 'any',
});

export const toMoodRecommendationResponse = (
  r: MoodRecommendation,
): z.infer<typeof moodRecommendationResponseSchema> => ({
  mood: r.mood.key,
  why: r.mood.description,
  drink: toDrinkResponse(r.drink),
  alternatives: r.alternatives.map(toSummary),
});

export const toPantryResponse = (
  s: PantrySuggestion,
): z.infer<typeof pantryResponseSchema> => ({
  have: s.understood,
  canMake: s.canMake.map(toDrinkResponse),
  almost: s.almost.map(({ drink, missing }) => ({
    ...toSummary(drink),
    missing,
  })),
  shoppingTips: s.shoppingTips,
  totals: s.totals,
});
