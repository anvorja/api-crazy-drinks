import request from 'supertest';
import { bearer, signInAsAdmin } from './support/auth.js';
import { TestApp, createTestApp } from './support/create-test-app.js';

describe('local snapshot catalog, without TheCocktailDB (e2e)', () => {
  let t: TestApp;
  const http = () => request(t.app.getHttpServer());
  const server = () => t.app.getHttpServer();

  beforeEach(async () => {
    t = await createTestApp({ snapshot: true });
    // Nothing may reach the external source in this mode.
    t.source.up = false;
  });

  afterEach(async () => {
    await t.app.close();
  });

  it('serves search, detail, random and the drink of the day from the snapshot', async () => {
    const adult = bearer((await signInAsAdmin(server())).accessToken);
    const search = await http()
      .get('/v1/drinks/search?q=moj')
      .set(adult)
      .expect(200);
    expect(search.body.map((d: { name: string }) => d.name)).toEqual([
      'Mojito',
    ]);
    await http().get('/v1/drinks/4').set(adult).expect(200);
    await http().get('/v1/drinks/random').set(adult).expect(200);
    await http().get('/v1/drinks/of-the-day').expect(200);
  });

  it('is ready without checking TheCocktailDB', async () => {
    const res = await http().get('/health/ready').expect(200);
    expect(res.body.checks.theCocktailDb).toBeUndefined();
    expect(res.body.checks.catalog).toMatchObject({
      status: 'up',
      mode: 'snapshot',
    });
  });

  it('a forced sync answers 409 CATALOG_SOURCE_DISABLED', async () => {
    const admin = await signInAsAdmin(server());
    const res = await http()
      .post('/v1/admin/catalog/sync')
      .set(bearer(admin.accessToken))
      .expect(409);
    expect(res.body.code).toBe('CATALOG_SOURCE_DISABLED');
  });
});
