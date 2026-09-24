import { and, eq, isNull } from 'drizzle-orm';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import {
  RefreshToken,
  RefreshTokenRepository,
} from '../../../domain/refresh-token.js';
import { refreshTokensTable } from './identity.schema.js';

export class DrizzleRefreshTokenRepository implements RefreshTokenRepository {
  constructor(private readonly db: PgDatabase<PgQueryResultHKT>) {}

  async create(token: RefreshToken): Promise<void> {
    await this.db.insert(refreshTokensTable).values(token);
  }

  async findByHash(tokenHash: string): Promise<RefreshToken | null> {
    const [record] = await this.db
      .select()
      .from(refreshTokensTable)
      .where(eq(refreshTokensTable.tokenHash, tokenHash));
    return record ?? null;
  }

  async revoke(id: string, at: Date): Promise<boolean> {
    const updated = await this.db
      .update(refreshTokensTable)
      .set({ revokedAt: at })
      .where(
        and(
          eq(refreshTokensTable.id, id),
          isNull(refreshTokensTable.revokedAt),
        ),
      )
      .returning({ id: refreshTokensTable.id });
    return updated.length === 1;
  }

  async revokeFamily(familyId: string, at: Date): Promise<void> {
    await this.db
      .update(refreshTokensTable)
      .set({ revokedAt: at })
      .where(
        and(
          eq(refreshTokensTable.familyId, familyId),
          isNull(refreshTokensTable.revokedAt),
        ),
      );
  }

  async revokeAllForUser(userId: string, at: Date): Promise<void> {
    await this.db
      .update(refreshTokensTable)
      .set({ revokedAt: at })
      .where(
        and(
          eq(refreshTokensTable.userId, userId),
          isNull(refreshTokensTable.revokedAt),
        ),
      );
  }
}
