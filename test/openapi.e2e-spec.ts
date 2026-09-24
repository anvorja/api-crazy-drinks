import request from 'supertest';
import { TestApp, createTestApp } from './support/create-test-app.js';

type Operation = {
  summary?: string;
  responses?: Record<string, unknown>;
  tags?: string[];
};

describe('OpenAPI (e2e)', () => {
  let t: TestApp;
  let spec: {
    openapi: string;
    paths: Record<string, Record<string, Operation>>;
    components: {
      schemas: Record<string, unknown>;
      securitySchemes: Record<string, unknown>;
    };
  };

  beforeAll(async () => {
    t = await createTestApp();
    spec = (
      await request(t.app.getHttpServer()).get('/docs/openapi.json').expect(200)
    ).body;
  });

  afterAll(async () => {
    await t.app.close();
  });

  const operations = () =>
    Object.entries(spec.paths).flatMap(([path, methods]) =>
      Object.entries(methods).map(([method, op]) => ({
        route: `${method.toUpperCase()} ${path}`,
        op,
      })),
    );

  it('serves the Swagger UI', async () => {
    await request(t.app.getHttpServer()).get('/docs').expect(200);
  });

  it('documents every endpoint with a summary, a tag and responses', () => {
    const undocumented = operations()
      .filter(
        ({ op }) =>
          !op.summary ||
          !op.tags?.length ||
          !Object.keys(op.responses ?? {}).length,
      )
      .map(({ route }) => route);
    expect(undocumented).toEqual([]);
  });

  it('covers every route of the app', () => {
    const routes = operations().map(({ route }) => route);
    expect(routes).toEqual(
      expect.arrayContaining([
        'GET /health',
        'GET /drinks/{id}/dna',
        'GET /lab/pantry',
        'POST /auth/login',
        'POST /me/api-keys',
        'PUT /me/pantry',
        'GET /plans',
        'GET /venues/{id}/menu',
        'PUT /admin/users/{id}/subscription',
        'GET /drinks',
        'GET /drinks/facets',
        'GET /drinks/suggest',
        'GET /discover/deck',
        'PUT /discover/{drinkId}',
        'PUT /me/taste/share',
        'GET /me/taste/compatibility/{slug}',
        'GET /taste/{slug}/card.png',
        'GET /cocktle/today',
        'POST /cocktle/today/guesses',
        'GET /cocktle/stats',
        'GET /me/taste',
        'GET /me/taste/recommendations',
      ]),
    );
    expect(routes.length).toBeGreaterThanOrEqual(35);
  });

  it('declares both auth schemes and the shared schemas', () => {
    expect(Object.keys(spec.components.securitySchemes)).toEqual([
      'bearer',
      'apiKey',
    ]);
    expect(Object.keys(spec.components.schemas)).toEqual(
      expect.arrayContaining([
        'Drink',
        'ErrorResponse',
        'Session',
        'Plan',
        'VenueMenu',
      ]),
    );
  });

  it('has no dangling $refs', () => {
    const refs = [
      ...JSON.stringify(spec).matchAll(/"#\/components\/schemas\/([^"]+)"/g),
    ].map((m) => m[1]);
    const missing = [...new Set(refs)].filter(
      (name) => !(name in spec.components.schemas),
    );
    expect(missing).toEqual([]);
  });
});
