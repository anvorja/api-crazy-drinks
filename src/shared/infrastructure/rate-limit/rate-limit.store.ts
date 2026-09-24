import { lt, sql } from 'drizzle-orm';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import { rateLimitHitsTable } from '../persistence/drizzle/rate-limit.schema.js';

/** Counts hits per key and fixed window. */
export interface RateLimitStore {
  /** Adds one hit and returns the total for that window. */
  hit(key: string, windowStart: Date): Promise<number>;
  /** Forgets windows that ended before `before`. */
  prune(before: Date): Promise<void>;
}

/** Single instance (development, tests). */
export class InMemoryRateLimitStore implements RateLimitStore {
  private readonly hits = new Map<string, number>();

  async hit(key: string, windowStart: Date): Promise<number> {
    const k = `${key}|${windowStart.getTime()}`;
    const next = (this.hits.get(k) ?? 0) + 1;
    this.hits.set(k, next);
    return next;
  }

  async prune(before: Date): Promise<void> {
    for (const k of this.hits.keys()) {
      if (Number(k.split('|').pop()) < before.getTime()) this.hits.delete(k);
    }
  }
}

/** Shared by every instance: an atomic upsert per request. */
export class PostgresRateLimitStore implements RateLimitStore {
  constructor(private readonly db: PgDatabase<PgQueryResultHKT>) {}

  async hit(key: string, windowStart: Date): Promise<number> {
    const [row] = await this.db
      .insert(rateLimitHitsTable)
      .values({ key, windowStart, hits: 1 })
      .onConflictDoUpdate({
        target: [rateLimitHitsTable.key, rateLimitHitsTable.windowStart],
        set: { hits: sql`${rateLimitHitsTable.hits} + 1` },
      })
      .returning({ hits: rateLimitHitsTable.hits });
    return row.hits;
  }

  async prune(before: Date): Promise<void> {
    await this.db
      .delete(rateLimitHitsTable)
      .where(lt(rateLimitHitsTable.windowStart, before));
  }
}
