import request from 'supertest';
import { bearer, signUp, signUpAs } from './support/auth.js';
import { TestApp, createTestApp } from './support/create-test-app.js';

describe('venues (e2e)', () => {
  let t: TestApp;
  const http = () => request(t.app.getHttpServer());
  const server = () => t.app.getHttpServer();

  /** A venue owner on the plan given (pro includes menu pricing). */
  const venueOwner = async (planId?: string) =>
    (await signUpAs(server(), 'venue_owner', planId)).accessToken;

  const venueBody = {
    name: 'La Barra',
    city: 'Cali',
    currency: 'cop',
    targetPourCost: 0.25,
  };

  beforeEach(async () => {
    t = await createTestApp();
  });

  afterEach(async () => {
    await t.app.close();
  });

  it('regular users cannot open venues', async () => {
    const { accessToken } = await signUp(server());
    await http()
      .post('/v1/venues')
      .set(bearer(accessToken))
      .send(venueBody)
      .expect(403);
  });

  it('builds a priced menu from the inventory', async () => {
    const token = await venueOwner('pro');
    const { body: venue } = await http()
      .post('/v1/venues')
      .set(bearer(token))
      .send(venueBody)
      .expect(201);
    expect(venue.currency).toBe('COP');

    await http()
      .put(`/v1/venues/${venue.id}/inventory`)
      .set(bearer(token))
      .send({
        items: [
          { ingredient: 'Light rum', bottleSizeMl: 750, bottleCost: 60000 },
          { ingredient: 'Lime', bottleSizeMl: 1000, bottleCost: 10000 },
          { ingredient: 'Sugar', bottleSizeMl: 1000, bottleCost: 5000 },
        ],
      })
      .expect(200);

    const { body: menu } = await http()
      .get(`/v1/venues/${venue.id}/menu`)
      .set(bearer(token))
      .expect(200);

    expect(menu.items.map((i: { name: string }) => i.name)).toEqual([
      'Daiquiri',
    ]);
    expect(menu.items[0]).toMatchObject({
      costComplete: true,
      suggestedPrice: expect.any(Number),
    });
    expect(menu.shoppingTips.map((tip: { buy: string }) => tip.buy)).toEqual(
      expect.arrayContaining(['coca-cola']),
    );
  });

  it('other owners cannot see a venue', async () => {
    const owner = await venueOwner();
    const intruder = await venueOwner();
    const { body: venue } = await http()
      .post('/v1/venues')
      .set(bearer(owner))
      .send(venueBody)
      .expect(201);

    await http()
      .get(`/v1/venues/${venue.id}/menu`)
      .set(bearer(intruder))
      .expect(403);
    const mine = await http()
      .get('/v1/venues/mine')
      .set(bearer(intruder))
      .expect(200);
    expect(mine.body).toEqual([]);
  });

  it('validates inventory', async () => {
    const token = await venueOwner();
    const { body: venue } = await http()
      .post('/v1/venues')
      .set(bearer(token))
      .send(venueBody)
      .expect(201);

    await http()
      .put(`/v1/venues/${venue.id}/inventory`)
      .set(bearer(token))
      .send({ items: [{ ingredient: 'Limón' }, { ingredient: 'limon' }] })
      .expect(400);
  });

  it('free plans get the menu without prices and limited venues/inventory', async () => {
    const token = await venueOwner();
    const { body: venue } = await http()
      .post('/v1/venues')
      .set(bearer(token))
      .send(venueBody)
      .expect(201);
    await http()
      .post('/v1/venues')
      .set(bearer(token))
      .send(venueBody)
      .expect(402);

    const items = [
      'Light rum',
      'Lime',
      'Sugar',
      'Mint',
      'Soda water',
      'Tequila',
    ].map((ingredient) => ({ ingredient }));
    await http()
      .put(`/v1/venues/${venue.id}/inventory`)
      .set(bearer(token))
      .send({ items })
      .expect(402);
    await http()
      .put(`/v1/venues/${venue.id}/inventory`)
      .set(bearer(token))
      .send({ items: items.slice(0, 3) })
      .expect(200);

    const { body: menu } = await http()
      .get(`/v1/venues/${venue.id}/menu`)
      .set(bearer(token))
      .expect(200);
    expect(menu.pricing.included).toBe(false);
    expect(menu.items[0]).toMatchObject({
      name: 'Daiquiri',
      suggestedPrice: null,
    });
  });

  it('prices garnishes with costPerServing and serves the menu to API keys', async () => {
    const token = await venueOwner('pro');
    const { body: venue } = await http()
      .post('/v1/venues')
      .set(bearer(token))
      .send(venueBody)
      .expect(201);
    await http()
      .put(`/v1/venues/${venue.id}/inventory`)
      .set(bearer(token))
      .send({
        items: [
          { ingredient: 'Tequila', bottleSizeMl: 750, bottleCost: 120000 },
          { ingredient: 'Triple sec', bottleSizeMl: 700, bottleCost: 70000 },
          { ingredient: 'Lime juice', bottleSizeMl: 1000, bottleCost: 12000 },
          { ingredient: 'Salt', costPerServing: 200 },
        ],
      })
      .expect(200);

    const { body: key } = await http()
      .post('/v1/me/api-keys')
      .set(bearer(token))
      .send({ name: 'POS' })
      .expect(201);
    const { body: menu } = await http()
      .get(`/v1/venues/${venue.id}/menu`)
      .set('X-API-Key', key.key)
      .expect(200);
    expect(menu.items[0]).toMatchObject({
      name: 'Margarita',
      costComplete: true,
    });

    await http()
      .put(`/v1/venues/${venue.id}/inventory`)
      .set('X-API-Key', key.key)
      .send({ items: [] })
      .expect(403);
  });
});
