import { count, desc, eq, ilike, max, sql } from 'drizzle-orm';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import { Drink } from '../../../domain/drink.js';
import { DrinkRepository } from '../../../domain/drink.repository.js';
import { toDomainDrink, toDrinkRecord } from './drink-record.mapper.js';
import { catalogSyncsTable, drinksTable } from './drinks.schema.js';

const UPSERT_CHUNK = 200;

/**
 * Postgres DrinkRepository. The whole catalog is small (hundreds of rows) and read on
 * every analytic request, so `findAll` is cached in memory and invalidated on writes.
 */
export class DrizzleDrinkRepository implements DrinkRepository {
  private cache: Drink[] | null = null;
  private cacheSignature: string | null = null;
  private checkedAt = 0;

  /**
   * @param revalidateMs how often to check whether another instance changed the catalog
   *   (a cheap count + max(updated_at) query); 0 checks on every read.
   */
  constructor(
    private readonly db: PgDatabase<PgQueryResultHKT>,
    private readonly revalidateMs = 0,
    private readonly now: () => number = Date.now,
  ) {}

  async findAll(): Promise<Drink[]> {
    if (this.cache && this.now() - this.checkedAt < this.revalidateMs)
      return this.cache;
    const signature = await this.signature();
    this.checkedAt = this.now();
    if (!this.cache || signature !== this.cacheSignature) {
      this.cache = (await this.db.select().from(drinksTable)).map(
        toDomainDrink,
      );
      this.cacheSignature = signature;
    }
    return this.cache;
  }

  /** Changes whenever any instance inserts or updates drinks. */
  private async signature(): Promise<string> {
    const [row] = await this.db
      .select({ total: count(), last: max(drinksTable.updatedAt) })
      .from(drinksTable);
    return `${row.total}:${row.last?.getTime() ?? 0}`;
  }

  async findById(id: string): Promise<Drink | null> {
    const [record] = await this.db
      .select()
      .from(drinksTable)
      .where(eq(drinksTable.id, id));
    return record ? toDomainDrink(record) : null;
  }

  async searchByName(query: string): Promise<Drink[]> {
    const pattern = `%${query.replace(/[%_\\]/g, '\\$&')}%`;
    const records = await this.db
      .select()
      .from(drinksTable)
      .where(ilike(drinksTable.name, pattern))
      .orderBy(drinksTable.name);
    return records.map(toDomainDrink);
  }

  async saveMany(drinks: Drink[]): Promise<void> {
    for (let i = 0; i < drinks.length; i += UPSERT_CHUNK) {
      const records = drinks.slice(i, i + UPSERT_CHUNK).map(toDrinkRecord);
      await this.db
        .insert(drinksTable)
        .values(records)
        .onConflictDoUpdate({
          target: drinksTable.id,
          set: {
            name: sql`excluded.name`,
            category: sql`excluded.category`,
            alcoholic: sql`excluded.alcoholic`,
            glass: sql`excluded.glass`,
            iba: sql`excluded.iba`,
            tags: sql`excluded.tags`,
            image: sql`excluded.image`,
            video: sql`excluded.video`,
            instructionsEn: sql`excluded.instructions_en`,
            instructionsEs: sql`excluded.instructions_es`,
            ingredients: sql`excluded.ingredients`,
            updatedAt: sql`now()`,
          },
        });
    }
    // This instance changed it: reload on the next read (others notice via the signature).
    this.cache = null;
    this.cacheSignature = null;
  }

  async count(): Promise<number> {
    return (await this.findAll()).length;
  }

  async recordSync(at: Date): Promise<void> {
    await this.db.insert(catalogSyncsTable).values({ syncedAt: at });
  }

  async lastSyncedAt(): Promise<Date | null> {
    const [row] = await this.db
      .select({ syncedAt: catalogSyncsTable.syncedAt })
      .from(catalogSyncsTable)
      .orderBy(desc(catalogSyncsTable.syncedAt))
      .limit(1);
    return row?.syncedAt ?? null;
  }
}
