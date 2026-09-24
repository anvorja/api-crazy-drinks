import { z } from 'zod';

export const venueIdSchema = z.uuid().meta({ description: 'Venue id' });

export const createVenueBodySchema = z
  .object({
    name: z.string().trim().min(1).max(120).meta({ example: 'La Barra' }),
    city: z.string().trim().min(1).max(80).meta({ example: 'Cali' }),
    currency: z
      .string()
      .length(3)
      .transform((c) => c.toUpperCase())
      .meta({ description: 'ISO 4217', example: 'COP' }),
    targetPourCost: z.number().min(0.05).max(0.6).meta({
      description:
        'Share of the price that goes to ingredients (industry target ~0.18-0.24)',
      example: 0.22,
    }),
  })
  .meta({ id: 'CreateVenueRequest' });
export type CreateVenueBodyDto = z.infer<typeof createVenueBodySchema>;

const inventoryItemSchema = z
  .object({
    ingredient: z.string().trim().min(1).max(80).meta({ example: 'Light rum' }),
    bottleSizeMl: z
      .number()
      .positive()
      .nullable()
      .default(null)
      .meta({ example: 750 }),
    bottleCost: z
      .number()
      .min(0)
      .nullable()
      .default(null)
      .meta({ example: 65000 }),
    costPerServing: z.number().min(0).nullable().default(null).meta({
      description:
        'For garnishes and non-volume measures (salt rim, mint leaves, a wedge)',
      example: null,
    }),
    inStock: z.boolean().default(true),
  })
  .meta({ id: 'InventoryItemInput' });

export const replaceInventoryBodySchema = z
  .object({ items: z.array(inventoryItemSchema).max(1000) })
  .meta({ id: 'ReplaceInventoryRequest' });
export type ReplaceInventoryBodyDto = z.infer<
  typeof replaceInventoryBodySchema
>;

export const menuQuerySchema = z.object({
  maxMissing: z.coerce.number().int().min(0).max(2).default(1).meta({
    description: 'Max missing ingredients for a drink to appear in `almost`',
  }),
});
export type MenuQueryDto = z.infer<typeof menuQuerySchema>;
