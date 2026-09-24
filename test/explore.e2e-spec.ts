import request from 'supertest';
import { bearer, signUp } from './support/auth.js';
import { TestApp, createTestApp } from './support/create-test-app.js';

describe('explore the catalog (e2e)', () => {
  let t: TestApp;
  const http = () => request(t.app.getHttpServer());

  beforeEach(async () => {
    t = await createTestApp();
  });

  afterEach(async () => {
    await t.app.close();
  });

  it('paginates with an opaque cursor', async () => {
    const { accessToken } = await signUp(t.app.getHttpServer());
    const first = await http()
      .get('/v1/drinks?limit=4')
      .set(bearer(accessToken))
      .expect(200);
    expect(first.body.items).toHaveLength(4);
    expect(first.body.total).toBe(6);

    const second = await http()
      .get(`/v1/drinks?limit=4&cursor=${first.body.nextCursor}`)
      .set(bearer(accessToken))
      .expect(200);
    expect(second.body.items).toHaveLength(2);
    expect(second.body.nextCursor).toBeNull();

    await http().get('/v1/drinks?cursor=garbage').expect(400);
  });

  it('returns cards ready to render, in Spanish too', async () => {
    const { body } = await http()
      .get('/v1/drinks?ingredients=limón,azúcar')
      .expect(200);
    // Anonymous: alcohol-free only.
    expect(body.items.map((d: { name: string }) => d.name)).toEqual([
      'Limeade',
    ]);
    expect(body.items[0]).toMatchObject({
      images: { small: 'https://img/5.jpg/small' },
      categoryEs: 'Cóctel',
      glassEs: 'Vaso highball',
    });
    expect(body.items[0].ingredients[0]).toMatchObject({
      name: 'Lime juice',
      nameEs: 'Jugo de lima',
    });
  });

  it('serves facets and typo-tolerant suggestions', async () => {
    const { accessToken } = await signUp(t.app.getHttpServer());
    const facets = await http()
      .get('/v1/drinks/facets')
      .set(bearer(accessToken))
      .expect(200);
    expect(facets.body.total).toBe(6);
    expect(facets.body.categories[0]).toMatchObject({
      value: 'Cocktail',
      valueEs: 'Cóctel',
    });

    const suggest = await http()
      .get('/v1/drinks/suggest?q=margarta')
      .set(bearer(accessToken))
      .expect(200);
    expect(suggest.body[0]).toMatchObject({
      kind: 'drink',
      value: 'Margarita',
      id: '4',
    });
  });

  it('lets clients cache catalog reads, per credentials', async () => {
    const res = await http().get('/v1/drinks/facets').expect(200);
    expect(res.headers['cache-control']).toBe('private, max-age=60');
    expect(res.headers['vary']).toContain('Authorization');
    expect(res.headers['etag']).toBeDefined();

    const random = await http().get('/v1/drinks/random').expect(200);
    expect(random.headers['cache-control']).toBeUndefined();
  });
});
