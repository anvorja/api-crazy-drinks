import { z } from 'zod';
import { Drink, Ingredient, toSummary } from '../../../domain/drink.js';
import {
  categoryEs,
  glassEs,
  ingredientEs,
} from '../../../domain/translations.js';
import { drinkImageSizes } from './image-sizes.js';
import { FLAVOR_DIMENSIONS, FlavorDna, Twin } from '../../../domain/flavor.js';

export const ingredientResponseSchema = z
  .object({
    name: z.string().meta({ example: 'Tequila' }),
    nameEs: z
      .string()
      .nullable()
      .meta({ example: 'Tequila', description: 'Spanish name, if known' }),
    measure: z.string().nullable().meta({ example: '1 1/2 oz' }),
    image: z
      .string()
      .nullable()
      .meta({ description: 'Small picture of the ingredient' }),
  })
  .meta({ id: 'Ingredient' });

export const imageSizesSchema = z
  .object({ small: z.string(), medium: z.string(), large: z.string() })
  .nullable()
  .meta({ id: 'ImageSizes', description: 'The drink picture in three sizes' });

export const drinkResponseSchema = z
  .object({
    id: z.string().meta({ example: '11007' }),
    name: z.string().meta({ example: 'Margarita' }),
    category: z.string().nullable().meta({ example: 'Ordinary Drink' }),
    categoryEs: z.string().nullable().meta({ example: 'Trago clásico' }),
    alcoholic: z.boolean(),
    glass: z.string().nullable().meta({ example: 'Cocktail glass' }),
    glassEs: z.string().nullable().meta({ example: 'Copa de cóctel' }),
    iba: z
      .string()
      .nullable()
      .meta({ description: 'IBA official list, if any' }),
    tags: z.array(z.string()),
    image: z.string().nullable(),
    images: imageSizesSchema,
    video: z.string().nullable(),
    instructions: z.object({
      en: z.string().nullable(),
      es: z.string().nullable(),
    }),
    ingredients: z.array(ingredientResponseSchema),
  })
  .meta({ id: 'Drink' });
export type DrinkResponseDto = z.infer<typeof drinkResponseSchema>;

export const drinkSummaryResponseSchema = z
  .object({
    id: z.string().meta({ example: '11007' }),
    name: z.string().meta({ example: 'Margarita' }),
    image: z.string().nullable(),
  })
  .meta({ id: 'DrinkSummary' });
export type DrinkSummaryDto = z.infer<typeof drinkSummaryResponseSchema>;

export const drinkListResponseSchema = z.array(drinkResponseSchema);

export const drinkOfTheDayResponseSchema = z
  .object({
    date: z.string().meta({ example: '2026-09-24', description: 'UTC day' }),
    drink: drinkResponseSchema,
  })
  .meta({ id: 'DrinkOfTheDay' });

const flavorDimension = z.enum(FLAVOR_DIMENSIONS);

export const flavorDnaResponseSchema = z
  .object({
    drink: drinkSummaryResponseSchema,
    profile: z.record(flavorDimension, z.number().int().min(0).max(100)).meta({
      description: '0-100 per dimension, relative to the dominant one (=100)',
    }),
    dominant: z
      .array(flavorDimension)
      .meta({ description: 'Dimensions scoring 60 or more' }),
    personality: z
      .string()
      .meta({ example: 'El que no perdona con alma cítrica' }),
    strength: z.enum(['zero', 'light', 'medium', 'strong']),
    complexity: z.number().int().meta({ description: 'Number of ingredients' }),
  })
  .meta({ id: 'FlavorDna' });

export const twinsResponseSchema = z
  .object({
    drink: drinkSummaryResponseSchema,
    twins: z.array(
      drinkSummaryResponseSchema.extend({
        similarity: z.number().int().min(0).max(100),
        sharedIngredients: z.array(z.string()),
      }),
    ),
  })
  .meta({ id: 'DrinkTwins' });

export const toIngredientResponse = (
  ingredient: Ingredient,
): z.infer<typeof ingredientResponseSchema> => ({
  name: ingredient.name,
  nameEs: ingredientEs(ingredient.name),
  measure: ingredient.measure,
  image: ingredient.image ?? null,
});

export const toDrinkResponse = (drink: Drink): DrinkResponseDto => ({
  id: drink.id,
  name: drink.name,
  category: drink.category,
  categoryEs: categoryEs(drink.category),
  alcoholic: drink.alcoholic,
  glass: drink.glass,
  glassEs: glassEs(drink.glass),
  iba: drink.iba,
  tags: drink.tags,
  image: drink.image,
  images: drinkImageSizes(drink.image),
  video: drink.video,
  instructions: { ...drink.instructions },
  ingredients: drink.ingredients.map(toIngredientResponse),
});

export const toSummaryResponse = (drink: Drink): DrinkSummaryDto =>
  toSummary(drink);

export const toFlavorDnaResponse = (
  drink: Drink,
  dna: FlavorDna,
): z.infer<typeof flavorDnaResponseSchema> => ({
  drink: toSummary(drink),
  ...dna,
});

export const toTwinsResponse = (
  drink: Drink,
  twins: Twin[],
): z.infer<typeof twinsResponseSchema> => ({
  drink: toSummary(drink),
  twins: twins.map((t) => ({
    ...toSummary(t.drink),
    similarity: t.similarity,
    sharedIngredients: t.sharedIngredients,
  })),
});
