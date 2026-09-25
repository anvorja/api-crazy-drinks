import { ConflictError, UnavailableError } from '../../shared/domain/errors.js';
import { Drink } from '../domain/drink.js';
import { DrinkRepository } from '../domain/drink.repository.js';
import { DrinkSource } from './ports/drink-source.port.js';

export interface CatalogStatus {
  /** snapshot: only the local data (seeded by the migrations). synced: kept in sync with a source. */
  mode: 'snapshot' | 'synced';
  size: number;
  lastSyncedAt: string | null;
  syncing: boolean;
}

/**
 * The drink catalog. The repository is the source of truth for analytics (pantry, moods,
 * twins). With an external source it's kept in sync and enriched on lookups and searches;
 * without one (null) it serves only the local snapshot and never calls out.
 */
export class DrinkCatalog {
  private syncing: Promise<number> | null = null;

  constructor(
    private readonly repository: DrinkRepository,
    private readonly source: DrinkSource | null,
    private readonly ttlMs: number,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async all(): Promise<Drink[]> {
    await this.ensureFresh();
    return this.repository.findAll();
  }

  /** Waits for a sync only when empty; a stale catalog refreshes in the background. */
  async ensureFresh(): Promise<void> {
    if (!this.source) return;
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
    const source = this.source;
    if (!source) {
      return Promise.reject(
        new ConflictError(
          'The catalog is a local snapshot: there is no external source to sync with',
          'CATALOG_SOURCE_DISABLED',
        ),
      );
    }
    this.syncing ??= source
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
    if (stored || !this.source) return stored;
    const fetched = await this.source.findById(id);
    if (fetched) await this.repository.saveMany([fetched]);
    return fetched;
  }

  /** Searches upstream (and keeps what it finds); local data without a source or if it's down. */
  async search(query: string): Promise<Drink[]> {
    if (!this.source) return this.repository.searchByName(query);
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

  /** Null when there is no external source (or it's down): pick from `all()` instead. */
  async random(): Promise<Drink | null> {
    if (!this.source) return null;
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
      mode: this.source ? 'synced' : 'snapshot',
      size: await this.repository.count(),
      lastSyncedAt: last?.toISOString() ?? null,
      syncing: this.syncing !== null,
    };
  }
}
