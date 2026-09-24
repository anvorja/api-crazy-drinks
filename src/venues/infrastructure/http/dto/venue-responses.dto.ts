import { z } from 'zod';
import { toSummary } from '../../../../drinks/domain/drink.js';
import { drinkSummaryResponseSchema } from '../../../../drinks/infrastructure/http/dto/drink-responses.dto.js';
import { Menu } from '../../../domain/menu.js';
import { InventoryItem, Venue } from '../../../domain/venue.js';

export const venueResponseSchema = z
  .object({
    id: z.uuid(),
    name: z.string(),
    city: z.string(),
    currency: z.string().meta({ example: 'COP' }),
    targetPourCost: z.number().meta({ example: 0.22 }),
    createdAt: z.string(),
  })
  .meta({ id: 'Venue' });

export const venueListResponseSchema = z.array(venueResponseSchema);

export const inventoryResponseSchema = z
  .object({
    items: z.array(
      z
        .object({
          ingredient: z.string(),
          bottleSizeMl: z.number().nullable(),
          bottleCost: z.number().nullable(),
          costPerServing: z.number().nullable(),
          inStock: z.boolean(),
        })
        .meta({ id: 'InventoryItem' }),
    ),
  })
  .meta({ id: 'Inventory' });

export const menuResponseSchema = z
  .object({
    venue: venueResponseSchema,
    currency: z.string(),
    pricing: z.object({
      included: z.boolean(),
      note: z
        .string()
        .nullable()
        .meta({ description: 'Why prices are missing, if they are' }),
    }),
    items: z.array(
      drinkSummaryResponseSchema
        .extend({
          cost: z.number().nullable(),
          costComplete: z.boolean().nullable(),
          unpriced: z.array(z.string()).meta({
            description: 'Ingredients without a price or a volume measure',
          }),
          suggestedPrice: z.number().nullable(),
          margin: z.number().nullable(),
        })
        .meta({ id: 'MenuItem' }),
    ),
    almost: z.array(
      drinkSummaryResponseSchema.extend({ missing: z.array(z.string()) }),
    ),
    shoppingTips: z.array(
      z.object({
        buy: z.string(),
        unlocks: z.number().int(),
        drinks: z.array(z.string()),
      }),
    ),
    totals: z.object({ onMenu: z.number().int(), almost: z.number().int() }),
  })
  .meta({ id: 'VenueMenu' });

export const toVenueResponse = (
  venue: Venue,
): z.infer<typeof venueResponseSchema> => ({
  id: venue.id,
  name: venue.name,
  city: venue.city,
  currency: venue.currency,
  targetPourCost: venue.targetPourCost,
  createdAt: venue.createdAt.toISOString(),
});

export const toInventoryResponse = (
  items: InventoryItem[],
): z.infer<typeof inventoryResponseSchema> => ({
  items: items.map(
    ({ ingredient, bottleSizeMl, bottleCost, costPerServing, inStock }) => ({
      ingredient,
      bottleSizeMl,
      bottleCost,
      costPerServing,
      inStock,
    }),
  ),
});

export const toMenuResponse = (
  venue: Venue,
  menu: Menu,
): z.infer<typeof menuResponseSchema> => ({
  venue: toVenueResponse(venue),
  currency: venue.currency,
  pricing: {
    included: menu.pricingIncluded,
    note: menu.pricingIncluded
      ? null
      : 'Your plan does not include menu pricing. See GET /plans.',
  },
  items: menu.items.map((item) => ({
    ...toSummary(item.drink),
    cost: item.cost?.amount ?? null,
    costComplete: item.cost?.complete ?? null,
    unpriced: item.cost?.unpriced ?? [],
    suggestedPrice: item.suggestedPrice,
    margin: item.margin,
  })),
  almost: menu.almost
    .slice(0, 20)
    .map(({ drink, missing }) => ({ ...toSummary(drink), missing })),
  shoppingTips: menu.shoppingTips.slice(0, 5),
  totals: { onMenu: menu.items.length, almost: menu.almost.length },
});
