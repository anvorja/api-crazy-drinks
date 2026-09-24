import { drink } from '../../../test/support/drinks.js';
import { buildMenu, costOf, roundPrice } from './menu.js';
import { InventoryItem, Venue } from './venue.js';

const venue: Venue = {
  id: 'v1',
  ownerId: 'u1',
  name: 'La Barra',
  city: 'Cali',
  currency: 'COP',
  targetPourCost: 0.25,
  createdAt: new Date(),
};

const withMeasures = (
  id: string,
  name: string,
  ingredients: [string, string | null][],
) => ({
  ...drink(id, name, []),
  ingredients: ingredients.map(([n, measure]) => ({ name: n, measure })),
});

const DAIQUIRI = withMeasures('2', 'Daiquiri', [
  ['Light rum', '2 oz'],
  ['Lime juice', '1 oz'],
  ['Sugar syrup', '1/2 oz'],
]);
const MOJITO = withMeasures('1', 'Mojito', [
  ['Light rum', '2 oz'],
  ['Lime', 'Juice of 1'],
  ['Mint', '6 leaves'],
  ['Soda water', '2 oz'],
]);

const item = (
  ingredient: string,
  extra: Partial<InventoryItem> = {},
): InventoryItem => ({
  ingredient,
  bottleSizeMl: null,
  bottleCost: null,
  costPerServing: null,
  inStock: true,
  ...extra,
});

const INVENTORY: InventoryItem[] = [
  item('Ron blanco / light rum', { bottleSizeMl: 750, bottleCost: 60_000 }),
  item('Lime juice', { bottleSizeMl: 1000, bottleCost: 10_000 }),
  item('Sugar syrup', { bottleSizeMl: 1000, bottleCost: 8_000 }),
  item('Lime'),
  item('Mint'),
];

const PRICED = { maxMissing: 1, pricing: true };

describe('menu', () => {
  it('rounds prices per currency', () => {
    expect(roundPrice(23_437, 'COP')).toBe(23_500);
    expect(roundPrice(11.13, 'USD')).toBe(11.25);
  });

  it('costs a drink from bottle prices and measures', () => {
    // rum 59.14ml * 80/ml + lime 29.57 * 10/ml + syrup 14.79 * 8/ml
    const cost = costOf(DAIQUIRI, INVENTORY);
    expect(cost.complete).toBe(true);
    expect(cost.amount).toBeCloseTo(4731.2 + 295.7 + 118.32, 0);
  });

  it('flags unpriced ingredients instead of guessing', () => {
    const cost = costOf(MOJITO, INVENTORY);
    expect(cost.complete).toBe(false);
    expect(cost.unpriced).toEqual(['Lime', 'Mint', 'Soda water']);
  });

  it('uses the cost per serving for garnishes and non-volume measures', () => {
    const inventory = [
      ...INVENTORY.filter(
        (i) => i.ingredient !== 'Lime' && i.ingredient !== 'Mint',
      ),
      item('Lime', { costPerServing: 500 }),
      item('Mint', { costPerServing: 300 }),
      item('Soda water', { bottleSizeMl: 1500, bottleCost: 4_500 }),
    ];
    const cost = costOf(MOJITO, inventory);
    expect(cost.complete).toBe(true);
    expect(cost.amount).toBeCloseTo(4731.2 + 500 + 300 + 59.14 * 3, 0);
  });

  it('prefers the bottle price when the measure is a volume', () => {
    const rum = item('Light rum', {
      bottleSizeMl: 750,
      bottleCost: 60_000,
      costPerServing: 1,
    });
    const cost = costOf(withMeasures('9', 'Shot', [['Light rum', '1 oz']]), [
      rum,
    ]);
    expect(cost.amount).toBeCloseTo(29.57 * 80, 0);
  });

  it('prices what can be served and suggests what to buy', () => {
    const menu = buildMenu(venue, INVENTORY, [DAIQUIRI, MOJITO], PRICED);

    expect(menu.items.map((i) => i.drink.name)).toEqual(['Daiquiri']);
    const [daiquiri] = menu.items;
    expect(daiquiri.suggestedPrice).toBe(
      roundPrice(daiquiri.cost!.amount / 0.25, 'COP'),
    );
    expect(daiquiri.margin).toBeCloseTo(
      daiquiri.suggestedPrice! - daiquiri.cost!.amount,
      2,
    );
    expect(menu.shoppingTips[0]).toMatchObject({
      buy: 'soda water',
      unlocks: 1,
    });
  });

  it('leaves prices out when the plan does not include them', () => {
    const menu = buildMenu(venue, INVENTORY, [DAIQUIRI], {
      maxMissing: 0,
      pricing: false,
    });
    expect(menu.pricingIncluded).toBe(false);
    expect(menu.items[0]).toMatchObject({
      cost: null,
      suggestedPrice: null,
      margin: null,
    });
  });

  it('ignores items that are out of stock', () => {
    const inventory = INVENTORY.map((i) =>
      i.ingredient.includes('rum') ? { ...i, inStock: false } : i,
    );
    expect(buildMenu(venue, inventory, [DAIQUIRI], PRICED).items).toEqual([]);
  });
});
