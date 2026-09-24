import { UnavailableError } from '../../shared/domain/errors.js';
import { Drink } from '../domain/drink.js';
import { DrinkRepository } from '../domain/drink.repository.js';
import { DrinkSource } from './ports/drink-source.port.js';

export interface CatalogStatus {
  size: number;
  lastSyncedAt: string | null;
  syncing: boolean;
}

/**
 * Keeps the local repository in sync with the external source.
 * The repository is the source of truth for analytics (pantry, moods, twins);
 * the external source enriches it on lookups and searches.
 */
export class DrinkCatalog {
  private syncing: Promise<number> | null = null;

  constructor(
    private readonly repository: DrinkRepository,
    private readonly source: DrinkSource,
    private readonly ttlMs: number,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async all(): Promise<Drink[]> {
    await this.ensureFresh();
    return this.repository.findAll();
  }

  /** Waits for a sync only when empty; a stale catalog refreshes in the background. */
  async ensureFresh(): Promise<void> {
    if ((await this.repository.count()) === 0) {
      await this.sync();
      return;
    }
    const last = await this.repository.lastSyncedAt();
    if (!last || this.now().getTime() - last.getTime() > this.ttlMs) {
      this.sync().catch(() => undefined);
    }
  }

  sync(): Promise<number> {
    this.syncing ??= this.source
      .fetchAll()
      .then(async (drinks) => {
        await this.repository.saveMany(drinks);
        await this.repository.recordSync(this.now());
        return drinks.length;
      })
      .finally(() => (this.syncing = null));
    return this.syncing;
  }

  async findById(id: string): Promise<Drink | null> {
    const stored = await this.repository.findById(id);
    if (stored) return stored;
    const fetched = await this.source.findById(id);
    if (fetched) await this.repository.saveMany([fetched]);
    return fetched;
  }

  /** Searches upstream (and keeps what it finds); falls back to local data if it's down. */
  async search(query: string): Promise<Drink[]> {
    try {
      const found = await this.source.searchByName(query);
      if (found.length) await this.repository.saveMany(found);
      return found;
    } catch (error) {
      if (error instanceof UnavailableError)
        return this.repository.searchByName(query);
      throw error;
    }
  }

  async random(): Promise<Drink | null> {
    try {
      return await this.source.random();
    } catch (error) {
      if (error instanceof UnavailableError) return null;
      throw error;
    }
  }

  async status(): Promise<CatalogStatus> {
    const last = await this.repository.lastSyncedAt();
    return {
      size: await this.repository.count(),
      lastSyncedAt: last?.toISOString() ?? null,
      syncing: this.syncing !== null,
    };
  }
}
