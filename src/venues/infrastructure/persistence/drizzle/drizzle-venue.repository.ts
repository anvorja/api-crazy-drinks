import { asc, eq } from 'drizzle-orm';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import { ingredientKey } from '../../../../drinks/domain/drink.js';
import { InventoryItem, Venue } from '../../../domain/venue.js';
import { VenueRepository } from '../../../domain/venue.repository.js';
import { venueInventoryTable, venuesTable } from './venues.schema.js';

export class DrizzleVenueRepository implements VenueRepository {
  constructor(private readonly db: PgDatabase<PgQueryResultHKT>) {}

  async create(venue: Venue): Promise<void> {
    await this.db.insert(venuesTable).values(venue);
  }

  async findById(id: string): Promise<Venue | null> {
    const [record] = await this.db
      .select()
      .from(venuesTable)
      .where(eq(venuesTable.id, id));
    return record ?? null;
  }

  async listByOwner(ownerId: string): Promise<Venue[]> {
    return this.db
      .select()
      .from(venuesTable)
      .where(eq(venuesTable.ownerId, ownerId))
      .orderBy(asc(venuesTable.createdAt));
  }

  async getInventory(venueId: string): Promise<InventoryItem[]> {
    const records = await this.db
      .select()
      .from(venueInventoryTable)
      .where(eq(venueInventoryTable.venueId, venueId))
      .orderBy(asc(venueInventoryTable.ingredient));
    return records.map(
      ({ ingredient, bottleSizeMl, bottleCost, costPerServing, inStock }) => ({
        ingredient,
        bottleSizeMl,
        bottleCost,
        costPerServing,
        inStock,
      }),
    );
  }

  async replaceInventory(
    venueId: string,
    items: InventoryItem[],
  ): Promise<void> {
    await this.db.transaction(async (tx) => {
      await tx
        .delete(venueInventoryTable)
        .where(eq(venueInventoryTable.venueId, venueId));
      if (items.length === 0) return;
      await tx.insert(venueInventoryTable).values(
        items.map((item) => ({
          ...item,
          venueId,
          ingredientKey: ingredientKey(item.ingredient),
        })),
      );
    });
  }
}
