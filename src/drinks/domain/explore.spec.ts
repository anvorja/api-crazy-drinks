import { DRINKS } from '../../../test/support/drinks.js';
import { PageCursor, exploreDrinks, facetsOf } from './explore.js';

const all = { ingredients: [] };

describe('explore', () => {
  it('walks the whole catalog page by page, sorted by name, without repeats', () => {
    const seen: string[] = [];
    let after: PageCursor | null = null;
    let pages = 0;
    do {
      const page = exploreDrinks(DRINKS, all, { limit: 4, after });
      seen.push(...page.items.map((d) => d.name));
      after = page.nextCursor;
      pages++;
    } while (after);

    expect(pages).toBe(2);
    expect(seen).toEqual(DRINKS.map((d) => d.name).sort());
  });

  it('combines filters, with Spanish ingredient names', () => {
    const page = exploreDrinks(
      DRINKS,
      { ingredients: ['ron', 'limón'], alcoholic: true },
      {
        limit: 10,
        after: null,
      },
    );
    expect(page.items.map((d) => d.name)).toEqual([
      'Cuba Libre',
      'Daiquiri',
      'Mojito',
    ]);
    expect(page.total).toBe(3);
    expect(page.nextCursor).toBeNull();
  });

  it('filters by name and alcohol', () => {
    expect(
      exploreDrinks(
        DRINKS,
        { q: 'lime', ingredients: [] },
        { limit: 10, after: null },
      ).items,
    ).toHaveLength(1);
    expect(
      exploreDrinks(
        DRINKS,
        { alcoholic: false, ingredients: [] },
        { limit: 10, after: null },
      ).total,
    ).toBe(2);
  });

  it('counts facets', () => {
    const facets = facetsOf(DRINKS, 3);
    expect(facets.total).toBe(6);
    expect(facets.alcoholic).toEqual({ alcoholic: 4, nonAlcoholic: 2 });
    expect(facets.ingredients[0]).toEqual({ value: 'Light rum', count: 3 });
    expect(facets.ingredients).toHaveLength(3);
  });
});
