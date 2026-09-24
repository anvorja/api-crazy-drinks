import {
  CHOCOLATE_MILK,
  CUBA_LIBRE,
  DAIQUIRI,
  DRINKS,
  LIMEADE,
  MARGARITA,
  MOJITO,
} from '../../../test/support/drinks.js';
import { buildTasteProfile } from './taste.js';
import {
  cleanDisplayName,
  compareTastes,
  compatibilityHeadline,
} from './taste-share.js';

describe('taste compatibility', () => {
  const rumLover = buildTasteProfile([DAIQUIRI, MOJITO])!;

  it('identical tastes are fully compatible', () => {
    const c = compareTastes(rumLover, rumLover, DRINKS, new Set(), 3);
    expect(c.score).toBe(100);
    expect(c.onlyYou).toEqual([]);
    expect(compatibilityHeadline(c)).toMatch(
      /^100 % compatibles · ¡Almas gemelas del sabor!/,
    );
  });

  it('opposite tastes score low and show what sets them apart', () => {
    const sweetTooth = buildTasteProfile([CHOCOLATE_MILK])!;
    const c = compareTastes(rumLover, sweetTooth, DRINKS, new Set(), 3);
    expect(c.score).toBeLessThan(50);
    expect(c.onlyThem).toContain('creamy');
    expect(c.sharedIngredients).toEqual([]);
  });

  it('bridges are new to both and liked by both', () => {
    const citrus = buildTasteProfile([MARGARITA, LIMEADE])!;
    const seen = new Set([DAIQUIRI.id, MOJITO.id, MARGARITA.id, LIMEADE.id]);
    const c = compareTastes(rumLover, citrus, DRINKS, seen, 2);
    expect(c.bridges.map((b) => b.drink.id)).not.toContain(DAIQUIRI.id);
    expect(c.bridges[0].drink).toBe(CUBA_LIBRE);
    expect(c.bridges[0].forYou).toBeGreaterThan(0);
  });

  it('cleans display names', () => {
    expect(cleanDisplayName('  Ana   María ')).toBe('Ana María');
    expect(() => cleanDisplayName('   ')).toThrow('display name');
  });
});
