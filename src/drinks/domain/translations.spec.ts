import { categoryEs, glassEs, ingredientEs } from './translations.js';

describe('translations', () => {
  it('translates regardless of case', () => {
    expect(ingredientEs('Lime juice')).toBe('Jugo de lima');
    expect(categoryEs('Ordinary Drink')).toBe('Trago clásico');
    expect(glassEs('highball glass')).toBe('Vaso highball');
  });

  it('returns null when unknown', () => {
    expect(ingredientEs('Unobtainium')).toBeNull();
    expect(categoryEs(null)).toBeNull();
  });
});
