import { eq } from 'drizzle-orm';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import {
  TasteShare,
  TasteShareRepository,
} from '../../../domain/taste-share.js';
import { tasteSharesTable } from './personal.schema.js';

export class DrizzleTasteShareRepository implements TasteShareRepository {
  constructor(private readonly db: PgDatabase<PgQueryResultHKT>) {}

  async findByUser(userId: string): Promise<TasteShare | null> {
    const [row] = await this.db
      .select()
      .from(tasteSharesTable)
      .where(eq(tasteSharesTable.userId, userId));
    return row ?? null;
  }

  async findBySlug(slug: string): Promise<TasteShare | null> {
    const [row] = await this.db
      .select()
      .from(tasteSharesTable)
      .where(eq(tasteSharesTable.slug, slug));
    return row ?? null;
  }

  async save(share: TasteShare): Promise<void> {
    await this.db
      .insert(tasteSharesTable)
      .values(share)
      .onConflictDoUpdate({
        target: tasteSharesTable.userId,
        set: { displayName: share.displayName },
      });
  }

  async removeByUser(userId: string): Promise<void> {
    await this.db
      .delete(tasteSharesTable)
      .where(eq(tasteSharesTable.userId, userId));
  }
}
