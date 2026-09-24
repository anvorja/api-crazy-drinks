import {
  ForbiddenError,
  UnauthorizedError,
  ValidationError,
} from '../../shared/domain/errors.js';
import { ingredientKey } from '../../drinks/domain/drink.js';
import { Principal } from '../../identity/domain/principal.js';

export interface Venue {
  id: string;
  ownerId: string;
  name: string;
  city: string;
  /** ISO 4217, e.g. COP. */
  currency: string;
  /** Share of the price that goes to ingredients (industry target ~18-24%). */
  targetPourCost: number;
  createdAt: Date;
}

export interface InventoryItem {
  /** As the venue calls it: "Ron blanco", "Light rum"… */
  ingredient: string;
  bottleSizeMl: number | null;
  bottleCost: number | null;
  /** For garnishes and non-volume measures (salt rim, mint leaves, a lime wedge). */
  costPerServing: number | null;
  inStock: boolean;
}

export function assertValidVenue(
  venue: Pick<Venue, 'name' | 'currency' | 'targetPourCost'>,
) {
  if (!venue.name.trim()) throw new ValidationError('Venue name is required');
  if (!/^[A-Z]{3}$/.test(venue.currency))
    throw new ValidationError('Currency must be ISO 4217');
  if (venue.targetPourCost < 0.05 || venue.targetPourCost > 0.6) {
    throw new ValidationError('targetPourCost must be between 0.05 and 0.6');
  }
}

export function assertValidInventory(items: InventoryItem[]) {
  const seen = new Set<string>();
  for (const item of items) {
    const key = ingredientKey(item.ingredient);
    if (seen.has(key)) {
      throw new ValidationError(`${item.ingredient} appears more than once`);
    }
    seen.add(key);
    if (!item.ingredient.trim())
      throw new ValidationError('Ingredient name is required');
    if ((item.bottleSizeMl === null) !== (item.bottleCost === null)) {
      throw new ValidationError(
        `${item.ingredient}: set both bottleSizeMl and bottleCost, or neither`,
      );
    }
    if (
      (item.bottleSizeMl ?? 1) <= 0 ||
      (item.bottleCost ?? 0) < 0 ||
      (item.costPerServing ?? 0) < 0
    ) {
      throw new ValidationError(
        `${item.ingredient}: sizes must be positive and costs non-negative`,
      );
    }
  }
}

/** Opening a venue requires the venue_owner (or admin) role and legal age: it serves alcohol. */
export function assertCanOpenVenue(principal: Principal | null): Principal {
  if (!principal) throw new UnauthorizedError('Authentication required');
  if (principal.role !== 'venue_owner' && principal.role !== 'admin') {
    throw new ForbiddenError('Only venue owners can register venues');
  }
  if (!principal.adult)
    throw new ForbiddenError('Venue owners must be of legal drinking age');
  return principal;
}

/** Only the owner (or an admin) can see or change a venue. */
export function assertCanManage(
  venue: Venue,
  principal: Principal | null,
): void {
  if (!principal) throw new UnauthorizedError('Authentication required');
  if (principal.role !== 'admin' && venue.ownerId !== principal.userId) {
    throw new ForbiddenError('You do not manage this venue');
  }
}
