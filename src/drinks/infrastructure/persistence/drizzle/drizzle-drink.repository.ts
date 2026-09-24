import { count, desc, eq, ilike, sql } from 'drizzle-orm';
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

  constructor(private readonly db: PgDatabase<PgQueryResultHKT>) {}

  async findAll(): Promise<Drink[]> {
    this.cache ??= (await this.db.select().from(drinksTable)).map(
      toDomainDrink,
    );
    return this.cache;
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
    this.cache = null;
  }

  async count(): Promise<number> {
    if (this.cache) return this.cache.length;
    const [row] = await this.db.select({ total: count() }).from(drinksTable);
    return row.total;
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
