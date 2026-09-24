import { z } from 'zod';
import { queryBoolean } from '../../../../shared/infrastructure/http/query.js';

export const drinkIdSchema = z
  .string()
  .regex(/^\d+$/, 'Drink id must be numeric')
  .meta({ description: 'TheCocktailDB drink id', example: '11007' });

export const searchDrinksQuerySchema = z.object({
  q: z
    .string()
    .trim()
    .min(1, 'Query parameter "q" is required')
    .meta({ description: 'Part of the drink name', example: 'margarita' }),
});
export type SearchDrinksQueryDto = z.infer<typeof searchDrinksQuerySchema>;

export const randomDrinkQuerySchema = z.object({
  alcoholic: queryBoolean.optional().meta({
    description: 'true: only alcoholic; false: only alcohol-free; omit: any',
  }),
});
export type RandomDrinkQueryDto = z.infer<typeof randomDrinkQuerySchema>;

export const twinsQuerySchema = z.object({
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(20)
    .default(5)
    .meta({ description: 'How many twins to return' }),
});
export type TwinsQueryDto = z.infer<typeof twinsQuerySchema>;
