import {
  CHOCOLATE_MILK,
  DAIQUIRI,
  DRINKS,
  LIMEADE,
  MARGARITA,
  MOJITO,
  drink,
} from '../../../test/support/drinks.js';
import { ingredientKeys } from './drink.js';
import { findTwins, flavorDna, flavorVector, jaccard } from './flavor.js';

describe('flavor', () => {
  it('builds a 0-100 profile led by the dominant trait', () => {
    const profile = flavorVector(MARGARITA);
    expect(Math.max(...Object.values(profile))).toBe(100);
    expect(profile.sour).toBeGreaterThan(0);
    expect(profile.creamy).toBe(0);
  });

  it('never marks alcohol-free drinks as strong', () => {
    expect(flavorVector(LIMEADE).strong).toBe(0);
    expect(flavorDna(LIMEADE).strength).toBe('zero');
  });

  it('describes a personality from the dominant traits', () => {
    const dna = flavorDna(CHOCOLATE_MILK);
    expect(dna.dominant).toEqual(['sweet', 'creamy']);
    expect(dna.profile.fizzy).toBe(0); // "chocolate" contains "cola" but isn't fizzy
    expect(dna.personality).toBe('El goloso con alma cremosa');
    expect(dna.complexity).toBe(2);
  });

  it('matches whole words: ginger is spicy, not gin', () => {
    const ginger = drink('9', 'Ginger shot', ['Ginger'], false);
    expect(flavorVector(ginger)).toMatchObject({ spicy: 100, herbal: 0 });
  });

  it('measures ingredient overlap', () => {
    expect(
      jaccard(ingredientKeys(MOJITO), ingredientKeys(DAIQUIRI)),
    ).toBeCloseTo(3 / 5);
    expect(
      jaccard(ingredientKeys(MOJITO), ingredientKeys(CHOCOLATE_MILK)),
    ).toBe(0);
  });

  it('finds the closest twins first and never the drink itself', () => {
    const twins = findTwins(DAIQUIRI, DRINKS, 2);
    expect(twins.map((t) => t.drink.name)).toEqual(['Mojito', 'Cuba Libre']);
    expect(twins[0].sharedIngredients).toEqual(['light rum', 'lime', 'sugar']);
  });
});
