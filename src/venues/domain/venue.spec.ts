import {
  assertCanManage,
  assertCanOpenVenue,
  assertValidInventory,
  Venue,
} from './venue.js';

const venue = { id: 'v1', ownerId: 'owner' } as Venue;
const p = (
  userId: string,
  role: 'user' | 'venue_owner' | 'admin',
  adult = true,
) => ({
  userId,
  role,
  adult,
  via: 'token' as const,
});

describe('venue policies', () => {
  it('only adult venue owners or admins open venues', () => {
    expect(() => assertCanOpenVenue(null)).toThrow('Authentication');
    expect(() => assertCanOpenVenue(p('u', 'user'))).toThrow(
      'Only venue owners',
    );
    expect(() => assertCanOpenVenue(p('u', 'venue_owner', false))).toThrow(
      'legal drinking age',
    );
    expect(() => assertCanOpenVenue(p('u', 'venue_owner'))).not.toThrow();
  });

  it('only the owner or an admin manages a venue', () => {
    expect(() =>
      assertCanManage(venue, p('owner', 'venue_owner')),
    ).not.toThrow();
    expect(() => assertCanManage(venue, p('admin', 'admin'))).not.toThrow();
    expect(() => assertCanManage(venue, p('other', 'venue_owner'))).toThrow(
      'do not manage',
    );
  });

  it('rejects duplicated ingredients even with different accents or case', () => {
    const item = {
      bottleSizeMl: null,
      bottleCost: null,
      costPerServing: null,
      inStock: true,
    };
    expect(() =>
      assertValidInventory([
        { ...item, ingredient: 'Limón' },
        { ...item, ingredient: 'limon' },
      ]),
    ).toThrow('more than once');
  });

  it('needs both bottle size and cost, or neither', () => {
    expect(() =>
      assertValidInventory([
        {
          ingredient: 'Rum',
          bottleSizeMl: 750,
          bottleCost: null,
          costPerServing: null,
          inStock: true,
        },
      ]),
    ).toThrow('set both');
  });
});
