import { and, eq, gte, lt } from 'drizzle-orm';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import { LoginFailureRepository } from '../../../domain/login-throttle.js';
import { loginFailuresTable } from './identity.schema.js';

export class DrizzleLoginFailureRepository implements LoginFailureRepository {
  constructor(private readonly db: PgDatabase<PgQueryResultHKT>) {}

  async since(key: string, since: Date): Promise<Date[]> {
    const rows = await this.db
      .select({ at: loginFailuresTable.attemptedAt })
      .from(loginFailuresTable)
      .where(
        and(
          eq(loginFailuresTable.key, key),
          gte(loginFailuresTable.attemptedAt, since),
        ),
      );
    return rows.map((r) => r.at);
  }

  async record(key: string, at: Date, forgetBefore: Date): Promise<void> {
    await this.db
      .delete(loginFailuresTable)
      .where(
        and(
          eq(loginFailuresTable.key, key),
          lt(loginFailuresTable.attemptedAt, forgetBefore),
        ),
      );
    await this.db.insert(loginFailuresTable).values({ key, attemptedAt: at });
  }

  async clear(key: string): Promise<void> {
    await this.db
      .delete(loginFailuresTable)
      .where(eq(loginFailuresTable.key, key));
  }
}
