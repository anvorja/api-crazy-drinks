import {
  NotFoundError,
  PlanLimitError,
} from '../../../shared/domain/errors.js';
import { Principal } from '../../../identity/domain/principal.js';
import { Clock, IdGenerator } from '../../../shared/application/ports.js';
import { Menu, buildMenu } from '../../domain/menu.js';
import {
  InventoryItem,
  Venue,
  assertCanManage,
  assertCanOpenVenue,
  assertValidInventory,
  assertValidVenue,
} from '../../domain/venue.js';
import { VenueRepository } from '../../domain/venue.repository.js';
import { VenueDrinkCatalog } from '../ports/drink-catalog.port.js';
import { VenuePlanLimitsPort } from '../ports/plan-limits.port.js';

/** Limits come from the owner's plan; admins acting on any venue are unlimited. */
const planHolder = (venue: Venue, actor: Principal | null) =>
  actor?.role === 'admin'
    ? actor
    : { userId: venue.ownerId, role: 'venue_owner' as const };

export interface CreateVenueInput {
  name: string;
  city: string;
  currency: string;
  targetPourCost: number;
}

export class CreateVenue {
  constructor(
    private readonly venues: VenueRepository,
    private readonly limits: VenuePlanLimitsPort,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
  ) {}

  async execute(
    actor: Principal | null,
    input: CreateVenueInput,
  ): Promise<Venue> {
    const owner = assertCanOpenVenue(actor);
    const { venues: maxVenues } = await this.limits.limitsFor(owner);
    const current = await this.venues.listByOwner(owner.userId);
    if (maxVenues !== null && current.length >= maxVenues) {
      throw new PlanLimitError(`Your plan allows ${maxVenues} venue(s)`);
    }

    const venue: Venue = {
      id: this.ids.next(),
      ownerId: owner.userId,
      name: input.name.trim(),
      city: input.city.trim(),
      currency: input.currency.toUpperCase(),
      targetPourCost: input.targetPourCost,
      createdAt: this.clock.now(),
    };
    assertValidVenue(venue);
    await this.venues.create(venue);
    return venue;
  }
}

export class ListMyVenues {
  constructor(private readonly venues: VenueRepository) {}

  execute(actor: Principal): Promise<Venue[]> {
    return this.venues.listByOwner(actor.userId);
  }
}

/** Loads a venue the actor is allowed to manage. */
export class GetManagedVenue {
  constructor(private readonly venues: VenueRepository) {}

  async execute(actor: Principal | null, venueId: string): Promise<Venue> {
    const venue = await this.venues.findById(venueId);
    if (!venue)
      throw new NotFoundError(`Venue ${venueId} not found`, 'VENUE_NOT_FOUND');
    assertCanManage(venue, actor);
    return venue;
  }
}

export class GetInventory {
  constructor(
    private readonly venues: VenueRepository,
    private readonly getVenue: GetManagedVenue,
  ) {}

  async execute(
    actor: Principal | null,
    venueId: string,
  ): Promise<InventoryItem[]> {
    await this.getVenue.execute(actor, venueId);
    return this.venues.getInventory(venueId);
  }
}

export class ReplaceInventory {
  constructor(
    private readonly venues: VenueRepository,
    private readonly getVenue: GetManagedVenue,
    private readonly limits: VenuePlanLimitsPort,
  ) {}

  async execute(
    actor: Principal | null,
    venueId: string,
    items: InventoryItem[],
  ): Promise<InventoryItem[]> {
    const venue = await this.getVenue.execute(actor, venueId);
    assertValidInventory(items);
    const { inventoryItems } = await this.limits.limitsFor(
      planHolder(venue, actor),
    );
    if (inventoryItems !== null && items.length > inventoryItems) {
      throw new PlanLimitError(
        `Your plan allows ${inventoryItems} inventory items`,
      );
    }
    await this.venues.replaceInventory(venueId, items);
    return items;
  }
}

export class BuildVenueMenu {
  constructor(
    private readonly venues: VenueRepository,
    private readonly getVenue: GetManagedVenue,
    private readonly catalog: VenueDrinkCatalog,
    private readonly limits: VenuePlanLimitsPort,
  ) {}

  /** Costs, prices and margins only when the owner's plan includes menu pricing. */
  async execute(
    actor: Principal | null,
    venueId: string,
    options: { maxMissing: number },
  ): Promise<{ venue: Venue; menu: Menu }> {
    const venue = await this.getVenue.execute(actor, venueId);
    const [inventory, drinks, limits] = await Promise.all([
      this.venues.getInventory(venueId),
      this.catalog.all(),
      this.limits.limitsFor(planHolder(venue, actor)),
    ]);
    return {
      venue,
      menu: buildMenu(venue, inventory, drinks, {
        maxMissing: options.maxMissing,
        pricing: limits.menuPricing,
      }),
    };
  }
}
