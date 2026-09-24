import { InventoryItem, Venue } from './venue.js';

export interface VenueRepository {
  create(venue: Venue): Promise<void>;
  findById(id: string): Promise<Venue | null>;
  listByOwner(ownerId: string): Promise<Venue[]>;
  getInventory(venueId: string): Promise<InventoryItem[]>;
  replaceInventory(venueId: string, items: InventoryItem[]): Promise<void>;
}
