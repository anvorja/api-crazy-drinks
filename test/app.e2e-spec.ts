import request from 'supertest';
import { MINOR_BIRTH_DATE, bearer, signUp } from './support/auth.js';
import { TestApp, createTestApp } from './support/create-test-app.js';

describe('api-drinks (e2e)', () => {
  let t: TestApp;
  const http = () => request(t.app.getHttpServer());

  beforeEach(async () => {
    t = await createTestApp();
  });

  afterEach(async () => {
    await t.app.close();
  });

  it('GET / lists the endpoints', async () => {
    const res = await http().get('/').expect(200);
    expect(res.body.name).toBe('api-drinks');
  });

  describe('health', () => {
    it('GET /health is always ok', async () => {
      const res = await http().get('/health').expect(200);
      expect(res.body).toMatchObject({ status: 'ok', service: 'api-drinks' });
    });

    it('GET /health/ready reports every dependency', async () => {
      await http().get('/v1/drinks/of-the-day').expect(200); // make sure the catalog is warm
      const res = await http().get('/health/ready').expect(200);
      expect(res.body.checks.catalog).toMatchObject({ status: 'up', size: 6 });
      expect(res.body.checks.theCocktailDb.status).toBe('up');
      expect(res.body.checks.database.status).toBe('up');
    });

    it('GET /health/ready answers 503 when the database is down', async () => {
      t.pool.up = false;
      const res = await http().get('/health/ready').expect(503);
      expect(res.body.checks.database.status).toBe('down');
    });

    it('GET /health/ready answers 503 when TheCocktailDB is down', async () => {
      t.source.up = false;
      const res = await http().get('/health/ready').expect(503);
      expect(res.body.status).toBe('degraded');
    });
  });

  describe('drinks', () => {
    it('GET /drinks/:id/dna returns a flavor profile to adults', async () => {
      const { accessToken } = await signUp(t.app.getHttpServer());
      const res = await http()
        .get('/v1/drinks/4/dna')
        .set(bearer(accessToken))
        .expect(200);
      expect(res.body.drink.name).toBe('Margarita');
      expect(res.body.personality).toEqual(expect.any(String));
    });

    it('GET /drinks/:id validates ids', async () => {
      await http().get('/v1/drinks/abc').expect(400);
    });

    it('GET /drinks/:id answers 404 for unknown drinks', async () => {
      await http().get('/v1/drinks/999').expect(404);
    });

    it('GET /drinks/search requires q', async () => {
      await http().get('/v1/drinks/search').expect(400);
    });
  });

  describe('age verification', () => {
    it('anonymous viewers only get alcohol-free drinks', async () => {
      await http().get('/v1/drinks/4').expect(403);
      const res = await http()
        .get('/v1/lab/pantry?have=rum,lime,sugar,soda')
        .expect(200);
      expect(res.body.canMake.map((d: { name: string }) => d.name)).toEqual([
        'Limeade',
      ]);
    });

    it('minors are treated like anonymous viewers', async () => {
      const { accessToken } = await signUp(
        t.app.getHttpServer(),
        MINOR_BIRTH_DATE,
      );
      await http().get('/v1/drinks/4').set(bearer(accessToken)).expect(403);
      await http()
        .get('/v1/lab/moods/fiesta')
        .set(bearer(accessToken))
        .expect(403);
    });

    it('adults see everything', async () => {
      const { accessToken } = await signUp(t.app.getHttpServer());
      await http().get('/v1/drinks/4').set(bearer(accessToken)).expect(200);
    });
  });

  describe('lab', () => {
    it('GET /lab/pantry suggests drinks', async () => {
      const { accessToken } = await signUp(t.app.getHttpServer());
      const res = await http()
        .get('/v1/lab/pantry?have=ron,limón,azúcar')
        .set(bearer(accessToken))
        .expect(200);
      expect(res.body.canMake[0].name).toBe('Daiquiri');
    });

    it('GET /lab/pantry validates its query', async () => {
      await http().get('/v1/lab/pantry').expect(400);
      await http().get('/v1/lab/pantry?have=rum&maxMissing=9').expect(400);
    });

    it('GET /lab/moods/:mood recommends a drink', async () => {
      const res = await http().get('/v1/lab/moods/guayabo').expect(200);
      expect(res.body.drink.alcoholic).toBe(false);
    });
  });
});
