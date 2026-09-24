import { z } from 'zod';
import { toSummary } from '../../../domain/drink.js';
import { FLAVOR_DIMENSIONS } from '../../../domain/flavor.js';
import { Recommendation, TasteProfile } from '../../../domain/taste.js';
import { drinkSummaryResponseSchema } from './drink-responses.dto.js';

const flavorDimension = z.enum(FLAVOR_DIMENSIONS);

export const tasteProfileSchema = z
  .object({
    basedOn: z
      .number()
      .int()
      .meta({ description: 'Number of favorites the profile comes from' }),
    confidence: z
      .enum(['low', 'medium', 'high'])
      .meta({ description: 'low: 1-2 favorites; medium: 3-7; high: 8+' }),
    profile: z.record(flavorDimension, z.number().int().min(0).max(100)).meta({
      description:
        'Average flavor DNA of the favorites, strongest dimension = 100',
    }),
    dominant: z.array(flavorDimension),
    personality: z
      .string()
      .meta({ example: 'El ácido rebelde con alma frutal' }),
    preferredStrength: z.enum(['zero', 'light', 'medium', 'strong']),
    favoriteIngredients: z.array(
      z.object({ ingredient: z.string(), count: z.number().int() }),
    ),
  })
  .meta({ id: 'TasteProfile' });

export const myTasteResponseSchema = z
  .object({
    taste: tasteProfileSchema.nullable(),
    hint: z
      .string()
      .nullable()
      .meta({ description: 'What to do when there is no profile yet' }),
  })
  .meta({ id: 'MyTaste' });

export const tasteRecommendationsQuerySchema = z.object({
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(20)
    .default(10)
    .meta({ description: 'How many recommendations' }),
});
export type TasteRecommendationsQueryDto = z.infer<
  typeof tasteRecommendationsQuerySchema
>;

export const tasteRecommendationsResponseSchema = z
  .object({
    taste: tasteProfileSchema,
    recommendations: z.array(
      drinkSummaryResponseSchema
        .extend({
          match: z.number().int().min(0).max(100),
          reasons: z.array(z.string()).meta({
            example: [
              'Coincide con tu lado cítrico',
              'Comparte ingredientes con tus favoritos: lime juice',
            ],
          }),
        })
        .meta({ id: 'TasteRecommendation' }),
    ),
  })
  .meta({ id: 'TasteRecommendations' });

export const toTasteResponse = (
  t: TasteProfile,
): z.infer<typeof tasteProfileSchema> => ({
  basedOn: t.basedOn,
  confidence: t.confidence,
  profile: { ...t.profile },
  dominant: t.dominant,
  personality: t.personality,
  preferredStrength: t.preferredStrength,
  favoriteIngredients: t.favoriteIngredients,
});

export const toMyTasteResponse = (
  taste: TasteProfile | null,
): z.infer<typeof myTasteResponseSchema> => ({
  taste: taste ? toTasteResponse(taste) : null,
  hint: taste
    ? null
    : 'Swipe drinks at /discover/deck or add favorites with PUT /me/favorites/{drinkId} to build your taste profile.',
});

export const toTasteRecommendationsResponse = (result: {
  taste: TasteProfile;
  recommendations: Recommendation[];
}): z.infer<typeof tasteRecommendationsResponseSchema> => ({
  taste: toTasteResponse(result.taste),
  recommendations: result.recommendations.map((r) => ({
    ...toSummary(r.drink),
    match: r.match,
    reasons: r.reasons,
  })),
});
