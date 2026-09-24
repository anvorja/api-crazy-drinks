import { z } from 'zod';
import { FLAVOR_DIMENSIONS } from '../../../domain/flavor.js';
import { TasteProfile } from '../../../domain/taste.js';
import {
  Compatibility,
  MAX_DISPLAY_NAME,
  TasteShare,
  compatibilityHeadline,
} from '../../../domain/taste-share.js';
import { drinkCardSchema, toDrinkCard } from './explore.dto.js';
import { tasteProfileSchema, toTasteResponse } from './taste.dto.js';

const flavorDimension = z.enum(FLAVOR_DIMENSIONS);

export const tasteSlugSchema = z
  .string()
  .regex(/^[A-Za-z0-9_-]{8,32}$/, 'Invalid taste link')
  .meta({
    description: 'Public slug of a shared taste',
    example: 'q3Z8vK1mXw2a',
  });

export const shareTasteBodySchema = z
  .object({
    displayName: z.string().max(MAX_DISPLAY_NAME).meta({
      description: 'The name shown publicly (not your account data)',
      example: 'Andrés',
    }),
  })
  .meta({ id: 'ShareTasteRequest' });
export type ShareTasteBodyDto = z.infer<typeof shareTasteBodySchema>;

export const tasteShareResponseSchema = z
  .object({
    slug: z.string(),
    displayName: z.string(),
    sharedAt: z.string(),
    links: z.object({
      profile: z.string().meta({ example: '/taste/q3Z8vK1mXw2a' }),
      cardPng: z
        .string()
        .meta({ description: 'Open Graph image (1200×630) for link previews' }),
      cardSvg: z.string(),
    }),
  })
  .meta({
    id: 'TasteShare',
    description: 'Paths are relative to the API origin',
  });

export const myTasteShareResponseSchema = z
  .object({ share: tasteShareResponseSchema.nullable() })
  .meta({ id: 'MyTasteShare' });

export const publicTasteResponseSchema = z
  .object({
    displayName: z.string(),
    taste: tasteProfileSchema.nullable(),
    links: tasteShareResponseSchema.shape.links,
  })
  .meta({ id: 'PublicTaste' });

export const compatibilityResponseSchema = z
  .object({
    headline: z.string().meta({
      example:
        '72 % compatibles · Muy compatibles: los dos son del lado cítrico e intenso',
    }),
    score: z.number().int().min(0).max(100),
    you: tasteProfileSchema,
    them: z.object({ displayName: z.string(), taste: tasteProfileSchema }),
    sharedTraits: z.array(flavorDimension),
    onlyYou: z.array(flavorDimension),
    onlyThem: z.array(flavorDimension),
    sharedIngredients: z.array(z.string()),
    bridges: z
      .array(
        drinkCardSchema.extend({
          forYou: z.number().int().min(0).max(100),
          forThem: z.number().int().min(0).max(100),
        }),
      )
      .meta({ description: 'Drinks neither has tried that both would enjoy' }),
  })
  .meta({ id: 'TasteCompatibility' });

const linksFor = (slug: string) => ({
  profile: `/taste/${slug}`,
  cardPng: `/taste/${slug}/card.png`,
  cardSvg: `/taste/${slug}/card.svg`,
});

export const toTasteShareResponse = (
  share: TasteShare,
): z.infer<typeof tasteShareResponseSchema> => ({
  slug: share.slug,
  displayName: share.displayName,
  sharedAt: share.createdAt.toISOString(),
  links: linksFor(share.slug),
});

export const toPublicTasteResponse = (
  share: TasteShare,
  taste: TasteProfile | null,
): z.infer<typeof publicTasteResponseSchema> => ({
  displayName: share.displayName,
  taste: taste ? toTasteResponse(taste) : null,
  links: linksFor(share.slug),
});

export const toCompatibilityResponse = (result: {
  them: TasteShare;
  you: TasteProfile;
  theirs: TasteProfile;
  compatibility: Compatibility;
}): z.infer<typeof compatibilityResponseSchema> => {
  const c = result.compatibility;
  return {
    headline: compatibilityHeadline(c),
    score: c.score,
    you: toTasteResponse(result.you),
    them: {
      displayName: result.them.displayName,
      taste: toTasteResponse(result.theirs),
    },
    sharedTraits: c.sharedTraits,
    onlyYou: c.onlyYou,
    onlyThem: c.onlyThem,
    sharedIngredients: c.sharedIngredients,
    bridges: c.bridges.map((b) => ({
      ...toDrinkCard(b.drink),
      forYou: b.forYou,
      forThem: b.forThem,
    })),
  };
};
