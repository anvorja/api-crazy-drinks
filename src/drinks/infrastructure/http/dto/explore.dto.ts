import { z } from 'zod';
import {
  queryBoolean,
  queryList,
} from '../../../../shared/infrastructure/http/query.js';
import { Drink } from '../../../domain/drink.js';
import { Facets, Page, PageCursor } from '../../../domain/explore.js';
import { Suggestion } from '../../../domain/suggest.js';
import {
  categoryEs,
  glassEs,
  ingredientEs,
} from '../../../domain/translations.js';
import { drinkImageSizes } from '../../cocktaildb/images.js';
import {
  imageSizesSchema,
  ingredientResponseSchema,
  toIngredientResponse,
} from './drink-responses.dto.js';

/** Opaque cursor: base64url of [name, id]. */
const encodeCursor = (cursor: PageCursor) =>
  Buffer.from(JSON.stringify([cursor.name, cursor.id])).toString('base64url');

const cursorSchema = z
  .string()
  .transform((value, ctx) => {
    try {
      const [name, id] = JSON.parse(
        Buffer.from(value, 'base64url').toString('utf8'),
      ) as unknown[];
      if (typeof name === 'string' && typeof id === 'string')
        return { name, id };
    } catch {
      // handled below
    }
    ctx.addIssue({ code: 'custom', message: 'Invalid cursor' });
    return z.NEVER;
  })
  .meta({ description: 'Opaque. Use `nextCursor` from the previous page' });

export const exploreQuerySchema = z.object({
  q: z
    .string()
    .trim()
    .max(60)
    .optional()
    .meta({ description: 'Part of the name', example: 'daiquiri' }),
  category: z
    .string()
    .trim()
    .optional()
    .meta({ description: 'As in /drinks/facets', example: 'Cocktail' }),
  glass: z.string().trim().optional().meta({ example: 'Highball glass' }),
  alcoholic: queryBoolean
    .optional()
    .meta({ description: 'true / false / omit for any' }),
  iba: queryBoolean
    .optional()
    .meta({ description: 'Only (true) or never (false) IBA official drinks' }),
  ingredients: queryList.meta({
    description:
      'Comma separated; the drink must have all of them. Spanish names work.',
    example: 'ron,limón',
  }),
  limit: z.coerce.number().int().min(1).max(60).default(24),
  cursor: cursorSchema.optional(),
});
export type ExploreQueryDto = z.infer<typeof exploreQuerySchema>;

export const suggestQuerySchema = z.object({
  q: z.string().trim().min(1).max(60).meta({
    description: 'What the user is typing. Typos are fine',
    example: 'margarta',
  }),
  limit: z.coerce.number().int().min(1).max(15).default(8),
});
export type SuggestQueryDto = z.infer<typeof suggestQuerySchema>;

export const drinkCardSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    image: z.string().nullable(),
    images: imageSizesSchema,
    category: z.string().nullable(),
    categoryEs: z.string().nullable(),
    glass: z.string().nullable(),
    glassEs: z.string().nullable(),
    alcoholic: z.boolean(),
    ingredients: z.array(ingredientResponseSchema),
  })
  .meta({
    id: 'DrinkCard',
    description: 'What a list or grid needs to render a drink',
  });

export const explorePageSchema = z
  .object({
    items: z.array(drinkCardSchema),
    total: z
      .number()
      .int()
      .meta({ description: 'Drinks matching the filters' }),
    nextCursor: z
      .string()
      .nullable()
      .meta({ description: 'null on the last page' }),
  })
  .meta({ id: 'DrinkPage' });

const facetValueSchema = z
  .object({
    value: z.string(),
    valueEs: z.string().nullable(),
    count: z.number().int(),
  })
  .meta({ id: 'FacetValue' });

export const facetsResponseSchema = z
  .object({
    categories: z.array(facetValueSchema),
    glasses: z.array(facetValueSchema),
    ingredients: z
      .array(facetValueSchema)
      .meta({ description: 'The most used ones' }),
    alcoholic: z.object({
      alcoholic: z.number().int(),
      nonAlcoholic: z.number().int(),
    }),
    total: z.number().int(),
  })
  .meta({ id: 'DrinkFacets' });

export const suggestResponseSchema = z
  .array(
    z
      .object({
        kind: z.enum(['drink', 'ingredient']),
        value: z.string().meta({ example: 'Margarita' }),
        id: z
          .string()
          .nullable()
          .meta({ description: 'Drink id (null for ingredients)' }),
        image: z.string().nullable(),
        score: z.number().meta({ description: '0-1, best first' }),
      })
      .meta({ id: 'Suggestion' }),
  )
  .meta({ description: 'Drinks and ingredients, best match first' });

export const toDrinkCard = (drink: Drink): z.infer<typeof drinkCardSchema> => ({
  id: drink.id,
  name: drink.name,
  image: drink.image,
  images: drinkImageSizes(drink.image),
  category: drink.category,
  categoryEs: categoryEs(drink.category),
  glass: drink.glass,
  glassEs: glassEs(drink.glass),
  alcoholic: drink.alcoholic,
  ingredients: drink.ingredients.map(toIngredientResponse),
});

export const toExplorePage = (
  page: Page<Drink>,
): z.infer<typeof explorePageSchema> => ({
  items: page.items.map(toDrinkCard),
  total: page.total,
  nextCursor: page.nextCursor ? encodeCursor(page.nextCursor) : null,
});

export const toFacetsResponse = (
  facets: Facets,
): z.infer<typeof facetsResponseSchema> => ({
  categories: facets.categories.map((f) => ({
    ...f,
    valueEs: categoryEs(f.value),
  })),
  glasses: facets.glasses.map((f) => ({ ...f, valueEs: glassEs(f.value) })),
  ingredients: facets.ingredients.map((f) => ({
    ...f,
    valueEs: ingredientEs(f.value),
  })),
  alcoholic: facets.alcoholic,
  total: facets.total,
});

export const toSuggestResponse = (
  suggestions: Suggestion[],
  ingredientImage: (name: string) => string | null,
): z.infer<typeof suggestResponseSchema> =>
  suggestions.map((s) => ({
    kind: s.kind,
    value: s.value,
    id: s.kind === 'drink' ? s.drink.id : null,
    image:
      s.kind === 'drink'
        ? (drinkImageSizes(s.drink.image)?.small ?? null)
        : ingredientImage(s.value),
    score: Math.round(s.score * 100) / 100,
  }));
