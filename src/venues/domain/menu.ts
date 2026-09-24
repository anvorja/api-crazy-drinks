import { Drink, ingredientKey } from '../../drinks/domain/drink.js';
import {
  ShoppingTip,
  evaluatePantry,
  findOwned,
  isStaple,
} from '../../drinks/domain/pantry.js';
import { measureToMl } from './measure.js';
import { InventoryItem, Venue } from './venue.js';

export interface DrinkCost {
  /** Sum of the ingredients we could price. */
  amount: number;
  /** False when some ingredient has no price or a non-volume measure. */
  complete: boolean;
  unpriced: string[];
}

export interface MenuItem {
  drink: Drink;
  /** Null when the plan doesn't include pricing. */
  cost: DrinkCost | null;
  /** cost / targetPourCost, rounded for the currency. Null when cost is incomplete. */
  suggestedPrice: number | null;
  margin: number | null;
}

export interface Menu {
  pricingIncluded: boolean;
  items: MenuItem[];
  almost: { drink: Drink; missing: string[] }[];
  shoppingTips: ShoppingTip[];
}

const ZERO_DECIMAL_CURRENCIES = new Set([
  'COP',
  'CLP',
  'JPY',
  'KRW',
  'PYG',
  'VND',
]);

/** Prices look like prices: COP 23.437 -> 23.500; USD 11.13 -> 11.25. */
export function roundPrice(amount: number, currency: string): number {
  const step = ZERO_DECIMAL_CURRENCIES.has(currency) ? 500 : 0.25;
  return Math.ceil(amount / step) * step;
}

const roundMoney = (amount: number) => Math.round(amount * 100) / 100;

/**
 * Bottle price x ml when the measure is a volume; otherwise the item's cost per serving
 * (garnishes). Ingredients with neither are reported as unpriced instead of guessed.
 */
export function costOf(drink: Drink, inventory: InventoryItem[]): DrinkCost {
  const byKey = new Map(
    inventory.map((item) => [ingredientKey(item.ingredient), item]),
  );
  const keys = [...byKey.keys()];
  let amount = 0;
  const unpriced: string[] = [];

  for (const { name, measure } of drink.ingredients) {
    const key = ingredientKey(name);
    if (isStaple(key)) continue;
    const owned = findOwned(key, keys);
    const item = owned ? byKey.get(owned) : undefined;
    const ml = measureToMl(measure);

    if (item && item.bottleCost !== null && item.bottleSizeMl && ml !== null) {
      amount += (item.bottleCost / item.bottleSizeMl) * ml;
    } else if (item && item.costPerServing !== null) {
      amount += item.costPerServing;
    } else {
      unpriced.push(name);
    }
  }
  return {
    amount: roundMoney(amount),
    complete: unpriced.length === 0,
    unpriced,
  };
}

/** The drinks a venue can serve today with what's in stock, priced, most profitable first. */
export function buildMenu(
  venue: Venue,
  inventory: InventoryItem[],
  drinks: Drink[],
  options: { maxMissing: number; pricing: boolean },
): Menu {
  const inStock = inventory.filter((i) => i.inStock);
  const pantry = evaluatePantry(
    drinks,
    inStock.map((i) => i.ingredient),
    options.maxMissing,
  );

  const items = pantry.canMake
    .map((drink): MenuItem => {
      if (!options.pricing)
        return { drink, cost: null, suggestedPrice: null, margin: null };
      const cost = costOf(drink, inStock);
      const suggestedPrice = cost.complete
        ? roundPrice(cost.amount / venue.targetPourCost, venue.currency)
        : null;
      return {
        drink,
        cost,
        suggestedPrice,
        margin:
          suggestedPrice === null
            ? null
            : roundMoney(suggestedPrice - cost.amount),
      };
    })
    .sort(
      (a, b) =>
        (b.margin ?? -Infinity) - (a.margin ?? -Infinity) ||
        a.drink.name.localeCompare(b.drink.name),
    );

  return {
    pricingIncluded: options.pricing,
    items,
    almost: pantry.almost,
    shoppingTips: pantry.shoppingTips,
  };
}
