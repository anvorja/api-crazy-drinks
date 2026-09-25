import { DRINKS } from '../../../test/support/drinks.js';
import { findMood, rankByMood } from './mood.js';

describe('mood', () => {
  it('finds moods by key or spanish alias', () => {
    expect(findMood('Guayabo')?.key).toBe('hungover');
    expect(findMood('romántico')?.key).toBe('romantic');
    expect(findMood('aventurera')?.key).toBe('adventurous');
    expect(findMood('relajada')?.key).toBe(findMood('relajado')?.key);
    expect(findMood('bored')).toBeUndefined();
  });

  it('respects the alcohol rule of each mood', () => {
    expect(
      rankByMood(DRINKS, findMood('hungover')!).every((d) => !d.alcoholic),
    ).toBe(true);
    expect(
      rankByMood(DRINKS, findMood('party')!).every((d) => d.alcoholic),
    ).toBe(true);
  });

  it('puts creamy drinks first when sad', () => {
    expect(rankByMood(DRINKS, findMood('sad')!)[0].name).toBe('Chocolate Milk');
  });
});
