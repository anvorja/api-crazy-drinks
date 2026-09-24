import { and, desc, eq, sql } from 'drizzle-orm';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import {
  ApiKey,
  ApiKeyRepository,
  ApiUsageRepository,
} from '../../../domain/api-key.js';
import { apiKeysTable, apiUsageTable } from './identity.schema.js';

export class DrizzleApiKeyRepository implements ApiKeyRepository {
  constructor(private readonly db: PgDatabase<PgQueryResultHKT>) {}

  async create(key: ApiKey): Promise<void> {
    await this.db.insert(apiKeysTable).values(key);
  }

  async findById(id: string): Promise<ApiKey | null> {
    const [row] = await this.db
      .select()
      .from(apiKeysTable)
      .where(eq(apiKeysTable.id, id));
    return row ?? null;
  }

  async findByHash(keyHash: string): Promise<ApiKey | null> {
    const [row] = await this.db
      .select()
      .from(apiKeysTable)
      .where(eq(apiKeysTable.keyHash, keyHash));
    return row ?? null;
  }

  async listByUser(userId: string): Promise<ApiKey[]> {
    return this.db
      .select()
      .from(apiKeysTable)
      .where(eq(apiKeysTable.userId, userId))
      .orderBy(desc(apiKeysTable.createdAt));
  }

  async revoke(id: string, at: Date): Promise<void> {
    await this.db
      .update(apiKeysTable)
      .set({ revokedAt: at })
      .where(eq(apiKeysTable.id, id));
  }

  async touch(id: string, at: Date): Promise<void> {
    await this.db
      .update(apiKeysTable)
      .set({ lastUsedAt: at })
      .where(eq(apiKeysTable.id, id));
  }
}

export class DrizzleApiUsageRepository implements ApiUsageRepository {
  constructor(private readonly db: PgDatabase<PgQueryResultHKT>) {}

  /** Atomic upsert: concurrent requests never lose a count. */
  async increment(userId: string, day: string): Promise<number> {
    const [row] = await this.db
      .insert(apiUsageTable)
      .values({ userId, day, requests: 1 })
      .onConflictDoUpdate({
        target: [apiUsageTable.userId, apiUsageTable.day],
        set: { requests: sql`${apiUsageTable.requests} + 1` },
      })
      .returning({ requests: apiUsageTable.requests });
    return row.requests;
  }

  async get(userId: string, day: string): Promise<number> {
    const [row] = await this.db
      .select({ requests: apiUsageTable.requests })
      .from(apiUsageTable)
      .where(and(eq(apiUsageTable.userId, userId), eq(apiUsageTable.day, day)));
    return row?.requests ?? 0;
  }
}
