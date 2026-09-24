import { z } from 'zod';
import { CocktleState } from '../../../application/use-cases/cocktle.js';
import { COCKTLE_MODES, CocktleStats } from '../../../domain/cocktle.js';
import { drinkIdSchema } from './drink-requests.dto.js';
import { drinkCardSchema, toDrinkCard } from './explore.dto.js';

const mode = z.enum(COCKTLE_MODES).meta({
  description:
    'classic: whole catalog (adults only) · zero: alcohol-free, for everyone',
});

export const cocktleModeQuerySchema = z.object({
  mode: mode
    .optional()
    .meta({ description: 'Default: classic for adults, zero otherwise' }),
});
export type CocktleModeQueryDto = z.infer<typeof cocktleModeQuerySchema>;

export const cocktleGuessBodySchema = z
  .object({
    drinkId: drinkIdSchema.meta({
      description: 'Your guess. Use GET /drinks/suggest to pick it',
    }),
    mode: mode.optional(),
  })
  .meta({ id: 'CocktleGuessRequest' });
export type CocktleGuessBodyDto = z.infer<typeof cocktleGuessBodySchema>;

export const cocktleStateSchema = z
  .object({
    day: z.string().meta({ example: '2026-09-24', description: 'UTC day' }),
    mode,
    maxAttempts: z.number().int(),
    attemptsLeft: z.number().int(),
    clues: z
      .array(
        z
          .object({
            kind: z.enum([
              'flavor',
              'profile',
              'glass',
              'ingredients',
              'more-ingredients',
              'name',
            ]),
            text: z.string(),
          })
          .meta({ id: 'CocktleClue' }),
      )
      .meta({ description: 'One at the start and one more after each miss' }),
    guesses: z.array(
      z
        .object({
          drink: drinkCardSchema,
          correct: z.boolean(),
          closeness: z
            .number()
            .int()
            .min(0)
            .max(100)
            .meta({ description: 'Flavor similarity with the answer' }),
          heat: z.enum(['correct', 'hot', 'warm', 'cold']).meta({
            description: 'correct 🟩 · hot (80+) 🟨 · warm (50+) 🟧 · cold 🟥',
          }),
          sharedIngredients: z.array(z.string()),
          sameCategory: z.boolean(),
          sameGlass: z.boolean(),
        })
        .meta({ id: 'CocktleGuess' }),
    ),
    finished: z.boolean(),
    solved: z.boolean(),
    answer: drinkCardSchema
      .nullable()
      .meta({ description: 'Revealed once the game is over' }),
    share: z.string().nullable().meta({
      description: 'Spoiler-free result to share',
      example: 'Cocktle 2026-09-24 · 3/6\n🟥🟨🟩',
    }),
  })
  .meta({ id: 'CocktleGame' });

export const cocktleStatsSchema = z
  .object({
    mode,
    played: z.number().int(),
    won: z.number().int(),
    winRate: z.number().int().meta({ description: '0-100' }),
    currentStreak: z.number().int(),
    maxStreak: z.number().int(),
    distribution: z.array(z.number().int()).meta({
      description: 'Wins by attempts: index 0 = first try',
      example: [1, 3, 5, 2, 0, 1],
    }),
  })
  .meta({ id: 'CocktleStats' });

export const toCocktleStateResponse = (
  state: CocktleState,
): z.infer<typeof cocktleStateSchema> => ({
  day: state.day,
  mode: state.mode,
  maxAttempts: state.maxAttempts,
  attemptsLeft: state.attemptsLeft,
  clues: state.clues,
  guesses: state.guesses.map((g) => ({
    drink: toDrinkCard(g.drink),
    correct: g.correct,
    closeness: g.closeness,
    heat: g.heat,
    sharedIngredients: g.sharedIngredients,
    sameCategory: g.sameCategory,
    sameGlass: g.sameGlass,
  })),
  finished: state.finished,
  solved: state.solved,
  answer: state.answer ? toDrinkCard(state.answer) : null,
  share: state.share,
});

export const toCocktleStatsResponse = (
  modeValue: z.infer<typeof mode>,
  stats: CocktleStats,
): z.infer<typeof cocktleStatsSchema> => ({ mode: modeValue, ...stats });
