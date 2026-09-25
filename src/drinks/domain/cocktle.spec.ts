import {
  CHOCOLATE_MILK,
  CUBA_LIBRE,
  DAIQUIRI,
  DRINKS,
  LIMEADE,
  MARGARITA,
  MOJITO,
} from '../../../test/support/drinks.js';
import {
  CocktleGame,
  applyGuess,
  cluesFor,
  feedbackFor,
  pickCocktleAnswer,
  shareText,
  statsFor,
} from './cocktle.js';

const game = (over: Partial<CocktleGame> = {}): CocktleGame => ({
  userId: 'u1',
  day: '2026-09-24',
  mode: 'classic',
  guesses: [],
  solved: false,
  ...over,
});

describe('cocktle', () => {
  it('picks the same answer all day, alcohol-free in zero mode', () => {
    const a = pickCocktleAnswer(DRINKS, '2026-09-24', 'classic');
    expect(
      pickCocktleAnswer([...DRINKS].reverse(), '2026-09-24', 'classic'),
    ).toBe(a);
    expect(pickCocktleAnswer(DRINKS, '2026-09-24', 'zero')).toBe(LIMEADE);
    // Chocolate Milk has only 2 ingredients: never an answer.
    for (const day of ['2026-01-01', '2026-02-02', '2026-03-03']) {
      expect(pickCocktleAnswer(DRINKS, day, 'classic')).not.toBe(
        CHOCOLATE_MILK,
      );
    }
  });

  it('goes from abstract to concrete clues', () => {
    const clues = cluesFor(MARGARITA);
    expect(clues.map((c) => c.kind)).toEqual([
      'flavor',
      'profile',
      'glass',
      'ingredients',
      'more-ingredients',
      'name',
    ]);
    expect(clues[0].text).toContain('ADN de sabor');
    expect(clues[5].text).toBe('Su nombre: M _ _ _ _ _ _ _ _');
    expect(clues[3].text).toContain('Tequila');
  });

  it('tells how close a guess is', () => {
    expect(feedbackFor(DAIQUIRI, DAIQUIRI)).toMatchObject({
      correct: true,
      heat: 'correct',
    });
    const near = feedbackFor(MOJITO, DAIQUIRI);
    expect(near.sharedIngredients).toEqual(['light rum', 'lime', 'sugar']);
    expect(near.heat).not.toBe('cold');
    expect(feedbackFor(CHOCOLATE_MILK, MARGARITA).heat).toBe('cold');
  });

  it('enforces the rules of a game', () => {
    const one = applyGuess(game(), MOJITO, DAIQUIRI);
    expect(() => applyGuess(one, MOJITO, DAIQUIRI)).toThrow('already tried');
    const won = applyGuess(one, DAIQUIRI, DAIQUIRI);
    expect(won.solved).toBe(true);
    expect(() => applyGuess(won, CUBA_LIBRE, DAIQUIRI)).toThrow('over');
  });

  it('shares a spoiler-free result', () => {
    const g = game({ guesses: ['1', '2'], solved: true });
    const text = shareText(g, [
      feedbackFor(MOJITO, DAIQUIRI),
      feedbackFor(DAIQUIRI, DAIQUIRI),
    ]);
    expect(text).toMatch(/^Cocktle 2026-09-24 · 2\/6\n.🟩$/u);
    expect(text).not.toContain('Daiquiri');
  });

  it('counts streaks of consecutive won days', () => {
    const won = (day: string, attempts: number) =>
      game({
        day,
        solved: true,
        guesses: Array.from({ length: attempts }, (_, i) => `${i}`),
      });
    const lost = (day: string) =>
      game({ day, guesses: ['1', '2', '3', '4', '5', '6'] });
    const stats = statsFor(
      [
        won('2026-09-20', 2),
        won('2026-09-21', 3),
        lost('2026-09-22'),
        won('2026-09-23', 1),
        won('2026-09-24', 2),
      ],
      '2026-09-24',
    );
    expect(stats).toMatchObject({
      played: 5,
      won: 4,
      winRate: 80,
      currentStreak: 2,
      maxStreak: 2,
    });
    expect(stats.distribution).toEqual([1, 2, 1, 0, 0, 0]);
    // Today not played yet: yesterday's streak still counts.
    expect(statsFor([won('2026-09-23', 1)], '2026-09-24').currentStreak).toBe(
      1,
    );
  });
});
