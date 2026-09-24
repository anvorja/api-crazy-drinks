import { z } from 'zod';
import {
  queryBoolean,
  queryList,
} from '../../../../shared/infrastructure/http/query.js';

const suggestionOptions = {
  maxMissing: z.coerce.number().int().min(0).max(3).default(1).meta({
    description: 'Max missing ingredients for a drink to appear in `almost`',
  }),
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(50)
    .default(10)
    .meta({ description: 'Max items per list' }),
  alcoholic: queryBoolean.optional().meta({
    description: 'true: only alcoholic; false: only alcohol-free; omit: any',
  }),
};

export const pantryQuerySchema = z.object({
  have: queryList
    .refine(
      (l) => l.length > 0,
      'Query parameter "have" is required, e.g. ?have=vodka,lime',
    )
    .meta({
      description: 'Comma separated ingredients, English or Spanish',
      example: 'ron,limón,azúcar,hierbabuena,soda',
    }),
  ...suggestionOptions,
});
export type PantryQueryDto = z.infer<typeof pantryQuerySchema>;

export const pantrySuggestionOptionsSchema = z.object(suggestionOptions);
export type PantrySuggestionOptionsDto = z.infer<
  typeof pantrySuggestionOptionsSchema
>;

export const moodParamSchema = z
  .string()
  .trim()
  .min(1)
  .meta({ description: 'Mood key or Spanish alias', example: 'guayabo' });
