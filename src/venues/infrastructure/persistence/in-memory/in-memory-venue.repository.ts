import { InventoryItem, Venue } from '../../../domain/venue.js';
import { VenueRepository } from '../../../domain/venue.repository.js';

export class InMemoryVenueRepository implements VenueRepository {
  private readonly venues = new Map<string, Venue>();
  private readonly inventories = new Map<string, InventoryItem[]>();

  async create(venue: Venue): Promise<void> {
    this.venues.set(venue.id, { ...venue });
  }

  async findById(id: string): Promise<Venue | null> {
    return this.venues.get(id) ?? null;
  }

  async listByOwner(ownerId: string): Promise<Venue[]> {
    return [...this.venues.values()].filter((v) => v.ownerId === ownerId);
  }

  async getInventory(venueId: string): Promise<InventoryItem[]> {
    return this.inventories.get(venueId) ?? [];
  }

  async replaceInventory(
    venueId: string,
    items: InventoryItem[],
  ): Promise<void> {
    this.inventories.set(
      venueId,
      items.map((i) => ({ ...i })),
    );
  }
}
