import {
  CHOCOLATE_MILK,
  CUBA_LIBRE,
  DAIQUIRI,
  DRINKS,
  LIMEADE,
  MOJITO,
} from '../../../test/support/drinks.js';
import { pickDiscoverDeck } from './reactions.js';
import { buildTasteProfile } from './taste.js';

const seq = () => {
  let i = 0;
  return () => (i++ * 0.37) % 1;
};

describe('discover deck', () => {
  it('never shows seen drinks', () => {
    const seen = new Set([DAIQUIRI.id, MOJITO.id]);
    const deck = pickDiscoverDeck(DRINKS, seen, null, 10, seq());
    expect(deck).toHaveLength(4);
    expect(deck.map((d) => d.id)).not.toContain(DAIQUIRI.id);
  });

  it('respects the requested size without repeats', () => {
    const deck = pickDiscoverDeck(DRINKS, new Set(), null, 3, seq());
    expect(new Set(deck.map((d) => d.id)).size).toBe(3);
  });

  it('mostly deals drinks close to the taste', () => {
    const taste = buildTasteProfile([DAIQUIRI, MOJITO])!;
    // With 1 card, it comes from the taste picks: the closest unseen drinks.
    const deck = pickDiscoverDeck(
      DRINKS,
      new Set([DAIQUIRI.id, MOJITO.id]),
      taste,
      1,
      () => 0,
    );
    expect([CUBA_LIBRE.id, LIMEADE.id]).toContain(deck[0].id);
  });
});

describe('taste with dislikes', () => {
  it('dislikes pull the profile away', () => {
    const liked = [CHOCOLATE_MILK, DAIQUIRI];
    const neutral = buildTasteProfile(liked)!;
    const withDislike = buildTasteProfile(liked, [MOJITO, CUBA_LIBRE])!;
    expect(withDislike.profile.sour).toBeLessThan(neutral.profile.sour);
    expect(withDislike.basedOn).toBe(4);
  });

  it('needs at least one liked drink', () => {
    expect(buildTasteProfile([], [MOJITO])).toBeNull();
  });
});
