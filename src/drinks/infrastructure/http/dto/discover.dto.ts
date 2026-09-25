import { z } from 'zod';
import { DiscoverStats } from '../../../application/use-cases/discover.js';
import { REACTIONS, Reaction } from '../../../domain/reactions.js';
import { TasteProfile } from '../../../domain/taste.js';
import { tasteProfileSchema, toTasteResponse } from './taste.dto.js';

export const deckQuerySchema = z.object({
  count: z.coerce
    .number()
    .int()
    .min(1)
    .max(30)
    .default(10)
    .meta({ description: 'How many cards to load' }),
});
export type DeckQueryDto = z.infer<typeof deckQuerySchema>;

export const reactBodySchema = z
  .object({
    reaction: z.enum(REACTIONS).meta({
      description:
        'like · dislike · superlike (a superlike also adds it to favorites)',
      example: 'like',
    }),
  })
  .meta({ id: 'ReactRequest' });
export type ReactBodyDto = z.infer<typeof reactBodySchema>;

export const reactionResponseSchema = z
  .object({
    drinkId: z.string(),
    reaction: z.enum(REACTIONS),
    reactedAt: z.string(),
    taste: tasteProfileSchema.nullable().meta({
      description: 'Your taste after this swipe, to show it changing live',
    }),
  })
  .meta({ id: 'ReactionResult' });

export const discoverStatsSchema = z
  .object({
    likes: z.number().int(),
    dislikes: z.number().int(),
    superlikes: z.number().int(),
    swiped: z.number().int(),
  })
  .meta({ id: 'DiscoverStats' });

export const toReactionResponse = (result: {
  reaction: Reaction;
  taste: TasteProfile | null;
}): z.infer<typeof reactionResponseSchema> => ({
  drinkId: result.reaction.drinkId,
  reaction: result.reaction.kind,
  reactedAt: result.reaction.createdAt.toISOString(),
  taste: result.taste ? toTasteResponse(result.taste) : null,
});

export const toDiscoverStatsResponse = (stats: DiscoverStats) => ({ ...stats });
