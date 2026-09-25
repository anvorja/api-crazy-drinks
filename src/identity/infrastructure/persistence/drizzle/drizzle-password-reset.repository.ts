import { and, eq, isNull } from 'drizzle-orm';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import {
  PasswordReset,
  PasswordResetRepository,
} from '../../../domain/password-reset.js';
import { passwordResetsTable } from './identity.schema.js';

export class DrizzlePasswordResetRepository implements PasswordResetRepository {
  constructor(private readonly db: PgDatabase<PgQueryResultHKT>) {}

  async create(reset: PasswordReset): Promise<void> {
    await this.db.insert(passwordResetsTable).values(reset);
  }

  async findByHash(tokenHash: string): Promise<PasswordReset | null> {
    const [row] = await this.db
      .select()
      .from(passwordResetsTable)
      .where(eq(passwordResetsTable.tokenHash, tokenHash));
    return row ?? null;
  }

  async markUsed(id: string, at: Date): Promise<boolean> {
    const updated = await this.db
      .update(passwordResetsTable)
      .set({ usedAt: at })
      .where(
        and(eq(passwordResetsTable.id, id), isNull(passwordResetsTable.usedAt)),
      )
      .returning({ id: passwordResetsTable.id });
    return updated.length === 1;
  }

  async invalidateForUser(userId: string, at: Date): Promise<void> {
    await this.db
      .update(passwordResetsTable)
      .set({ usedAt: at })
      .where(
        and(
          eq(passwordResetsTable.userId, userId),
          isNull(passwordResetsTable.usedAt),
        ),
      );
  }
}
