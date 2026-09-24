import { DRINKS } from '../../../test/support/drinks.js';
import { matchScore, suggest } from './suggest.js';

describe('suggest', () => {
  it('ranks prefixes first', () => {
    expect(matchScore('marg', 'Margarita')).toBeGreaterThan(
      matchScore('marg', 'Smargle'),
    );
  });

  it('tolerates typos', () => {
    expect(suggest('margarta', DRINKS, 3)[0]).toMatchObject({
      kind: 'drink',
      value: 'Margarita',
    });
    expect(suggest('mojto', DRINKS, 3)[0]).toMatchObject({
      kind: 'drink',
      value: 'Mojito',
    });
  });

  it('also suggests ingredients', () => {
    expect(
      suggest('chocol', DRINKS, 5).map((s) => `${s.kind}:${s.value}`),
    ).toEqual(
      expect.arrayContaining(['ingredient:Chocolate', 'drink:Chocolate Milk']),
    );
  });

  it('returns nothing for unrelated text', () => {
    expect(suggest('xyzzy', DRINKS, 5)).toEqual([]);
  });
});
