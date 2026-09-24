import { DRINKS } from '../../../test/support/drinks.js';
import { FakeDrinkSource } from '../../../test/support/fake-drink-source.js';
import { InMemoryDrinkRepository } from '../infrastructure/persistence/in-memory/in-memory-drink.repository.js';
import { DrinkCatalog } from './drink-catalog.js';

describe('DrinkCatalog', () => {
  const HOUR = 3_600_000;
  let repository: InMemoryDrinkRepository;
  let source: FakeDrinkSource;
  let now: Date;
  let catalog: DrinkCatalog;

  beforeEach(() => {
    repository = new InMemoryDrinkRepository();
    source = new FakeDrinkSource();
    now = new Date('2026-01-01T00:00:00Z');
    catalog = new DrinkCatalog(repository, source, HOUR, () => now);
  });

  it('syncs once when empty, even with concurrent callers', async () => {
    await Promise.all([catalog.all(), catalog.all()]);
    expect(source.fetchAllCalls).toBe(1);
    expect(await repository.count()).toBe(DRINKS.length);
  });

  it('fails as unavailable when empty and the source is down', async () => {
    source.up = false;
    await expect(catalog.all()).rejects.toMatchObject({ kind: 'unavailable' });
  });

  it('refreshes a stale catalog', async () => {
    await catalog.all();
    now = new Date(now.getTime() + 2 * HOUR);
    await catalog.all();
    await vi.waitFor(() => expect(source.fetchAllCalls).toBe(2));
  });

  it('keeps what upstream search finds and falls back to it when upstream is down', async () => {
    expect(await catalog.search('mojito')).toHaveLength(1);
    source.up = false;
    expect((await catalog.search('moj')).map((d) => d.name)).toEqual([
      'Mojito',
    ]);
  });

  it('looks up unknown ids upstream and stores them', async () => {
    expect((await catalog.findById('4'))?.name).toBe('Margarita');
    source.up = false;
    expect((await catalog.findById('4'))?.name).toBe('Margarita');
  });
});
