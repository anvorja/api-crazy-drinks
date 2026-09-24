import { FakeDrinkSource } from '../../../../test/support/fake-drink-source.js';
import { InMemoryDrinkRepository } from '../../infrastructure/persistence/in-memory/in-memory-drink.repository.js';
import { DrinkCatalog } from '../drink-catalog.js';
import { RecommendByMood, SuggestFromPantry } from './lab.js';

const ADULT = { includeAlcoholic: true };
const MINOR = { includeAlcoholic: false };

describe('lab use cases', () => {
  let catalog: DrinkCatalog;

  beforeEach(() => {
    catalog = new DrinkCatalog(
      new InMemoryDrinkRepository(),
      new FakeDrinkSource(),
      60_000,
    );
  });

  it('pantry hides alcohol from viewers who cannot see it', async () => {
    const suggest = new SuggestFromPantry(catalog);
    const query = {
      have: ['rum', 'lime', 'sugar', 'soda'],
      maxMissing: 0,
      limit: 10,
    };

    const adult = await suggest.execute(query, ADULT);
    const minor = await suggest.execute(query, MINOR);

    expect(adult.canMake.map((d) => d.name)).toEqual(
      expect.arrayContaining(['Daiquiri', 'Limeade']),
    );
    expect(minor.canMake.map((d) => d.name)).toEqual(['Limeade']);
  });

  it('pantry requires at least one ingredient', async () => {
    await expect(
      new SuggestFromPantry(catalog).execute(
        { have: [], maxMissing: 1, limit: 10 },
        ADULT,
      ),
    ).rejects.toThrow('at least one ingredient');
  });

  it('mood picks among the best candidates', async () => {
    const result = await new RecommendByMood(catalog, () => 0).execute(
      'triste',
      ADULT,
    );
    expect(result.mood.key).toBe('sad');
    expect(result.drink.name).toBe('Chocolate Milk');
  });

  it('party mood is forbidden without alcohol access', async () => {
    await expect(
      new RecommendByMood(catalog).execute('fiesta', MINOR),
    ).rejects.toMatchObject({
      kind: 'forbidden',
    });
  });

  it('rejects unknown moods', async () => {
    await expect(
      new RecommendByMood(catalog).execute('bored', ADULT),
    ).rejects.toMatchObject({
      kind: 'not_found',
    });
  });
});
