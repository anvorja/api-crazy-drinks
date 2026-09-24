import { DRINKS, drink } from '../../../test/support/drinks.js';
import { evaluatePantry, understandIngredients } from './pantry.js';

describe('pantry', () => {
  it('understands spanish names and accents', () => {
    expect(understandIngredients(['Limón', ' ron '])).toEqual([
      'limon',
      'lemon',
      'lime',
      'ron',
      'rum',
    ]);
  });

  it('finds ready drinks, near misses and the best purchase', () => {
    const result = evaluatePantry(DRINKS, ['rum', 'lime', 'sugar'], 2);
    expect(result.canMake.map((d) => d.name)).toEqual(['Daiquiri']);
    expect(result.almost.map((m) => m.drink.name)).toEqual(
      expect.arrayContaining(['Cuba Libre', 'Limeade', 'Mojito']),
    );
    expect(result.shoppingTips[0].unlocks).toBe(1);
  });

  it('understands common Spanish kitchen names', () => {
    const result = evaluatePantry(
      DRINKS,
      ['Tequila', 'Triple sec', 'Limón', 'Sal'],
      0,
    );
    expect(result.canMake.map((d) => d.name)).toContain('Margarita');
  });

  it('assumes water and ice, but not soda water', () => {
    const result = evaluatePantry(DRINKS, ['lime', 'sugar'], 0);
    expect(result.canMake.map((d) => d.name)).not.toContain('Limeade');
  });

  it('does not confuse gin with ginger ale', () => {
    const buck = drink('9', 'Gin Buck', ['Gin', 'Ginger ale'], true);
    expect(evaluatePantry([buck], ['gin'], 1).almost[0].missing).toEqual([
      'ginger ale',
    ]);
  });

  it('maps soda to carbonated water', () => {
    const result = evaluatePantry(DRINKS, ['lime', 'sugar', 'soda'], 0);
    expect(result.canMake.map((d) => d.name)).toContain('Limeade');
  });
});
