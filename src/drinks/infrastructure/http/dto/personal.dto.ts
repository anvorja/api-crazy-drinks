import { z } from 'zod';
import { Drink } from '../../../domain/drink.js';
import { MAX_PANTRY_INGREDIENTS } from '../../../domain/personal.js';
import { drinkResponseSchema, toDrinkResponse } from './drink-responses.dto.js';

export const savePantryBodySchema = z
  .object({
    ingredients: z
      .array(z.string().max(80))
      .max(MAX_PANTRY_INGREDIENTS)
      .meta({
        example: ['Ron blanco', 'Limón', 'Azúcar', 'Hierbabuena', 'Soda'],
      }),
  })
  .meta({ id: 'SavePantryRequest' });
export type SavePantryBodyDto = z.infer<typeof savePantryBodySchema>;

export const pantryResponseSchema = z
  .object({
    ingredients: z.array(z.string()),
    updatedAt: z
      .string()
      .nullable()
      .meta({ description: 'null if never saved' }),
  })
  .meta({ id: 'UserPantry' });

export const favoriteResponseSchema = z
  .object({ drink: drinkResponseSchema, addedAt: z.string() })
  .meta({ id: 'Favorite' });

export const favoriteListResponseSchema = z.array(favoriteResponseSchema);

export const toUserPantryResponse = (pantry: {
  ingredients: string[];
  updatedAt: Date | null;
}): z.infer<typeof pantryResponseSchema> => ({
  ingredients: pantry.ingredients,
  updatedAt: pantry.updatedAt?.toISOString() ?? null,
});

export const toFavoriteResponse = (f: {
  drink: Drink;
  addedAt: Date;
}): z.infer<typeof favoriteResponseSchema> => ({
  drink: toDrinkResponse(f.drink),
  addedAt: f.addedAt.toISOString(),
});
