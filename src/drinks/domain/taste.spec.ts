import {
  CHOCOLATE_MILK,
  CUBA_LIBRE,
  DAIQUIRI,
  DRINKS,
  LIMEADE,
  MARGARITA,
  MOJITO,
} from '../../../test/support/drinks.js';
import { buildTasteProfile, joinSpanish, recommendForTaste } from './taste.js';

describe('taste', () => {
  it('has no profile without favorites', () => {
    expect(buildTasteProfile([])).toBeNull();
  });

  it('averages the favorites into a 0-100 profile', () => {
    const taste = buildTasteProfile([DAIQUIRI, MOJITO, CUBA_LIBRE])!;
    expect(Math.max(...Object.values(taste.profile))).toBe(100);
    expect(taste.profile.creamy).toBe(0);
    expect(taste.basedOn).toBe(3);
    expect(taste.confidence).toBe('medium');
    expect(taste.personality).toEqual(expect.any(String));
  });

  it('counts the ingredients the user repeats most', () => {
    const taste = buildTasteProfile([DAIQUIRI, MOJITO, CUBA_LIBRE])!;
    expect(taste.favoriteIngredients.slice(0, 2)).toEqual([
      { ingredient: 'light rum', count: 3 },
      { ingredient: 'lime', count: 3 },
    ]);
  });

  it('grows more confident with more favorites', () => {
    expect(buildTasteProfile([DAIQUIRI])!.confidence).toBe('low');
    expect(buildTasteProfile([...DRINKS, ...DRINKS])!.confidence).toBe('high');
  });

  it('recommends unseen drinks closest to the taste, with reasons', () => {
    const favorites = [DAIQUIRI, MOJITO];
    const taste = buildTasteProfile(favorites)!;
    const recs = recommendForTaste(taste, favorites, DRINKS, 10);

    expect(recs.map((r) => r.drink.id)).not.toContain(DAIQUIRI.id);
    expect(recs.map((r) => r.drink.id)).not.toContain(MOJITO.id);
    expect(recs[0].drink.name).toBe('Cuba Libre');
    expect(recs[0].reasons.join(' ')).toContain('light rum');
    expect(recs.at(-1)!.drink).toBe(CHOCOLATE_MILK);
    expect(recs[0].match).toBeGreaterThan(recs.at(-1)!.match);
  });

  it('explains taste coincidences', () => {
    const taste = buildTasteProfile([MARGARITA])!;
    const [rec] = recommendForTaste(taste, [MARGARITA], [LIMEADE], 1);
    expect(rec.reasons.length).toBeGreaterThan(0);
  });

  it('writes the reasons in proper Spanish', () => {
    expect(joinSpanish(['dulce'])).toBe('dulce');
    expect(joinSpanish(['dulce', 'cítrico', 'intenso'])).toBe(
      'dulce, cítrico e intenso',
    );
    expect(joinSpanish(['intenso', 'herbal'])).toBe('intenso y herbal');
    expect(joinSpanish(['cítrico', 'hierbas'])).toBe('cítrico y hierbas');
  });
});
