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
        'GET /v1/drinks/{id}/dna',
        'GET /v1/lab/pantry',
        'POST /v1/auth/login',
        'POST /v1/me/api-keys',
        'PUT /v1/me/pantry',
        'GET /v1/plans',
        'GET /v1/venues/{id}/menu',
        'PUT /v1/admin/users/{id}/subscription',
        'GET /v1/drinks',
        'GET /v1/drinks/facets',
        'GET /v1/drinks/suggest',
        'GET /v1/discover/deck',
        'PUT /v1/discover/{drinkId}',
        'PUT /v1/me/taste/share',
        'GET /v1/me/taste/compatibility/{slug}',
        'GET /v1/taste/{slug}/card.png',
        'GET /v1/cocktle/today',
        'POST /v1/cocktle/today/guesses',
        'GET /v1/cocktle/stats',
        'POST /v1/auth/password/forgot',
        'POST /v1/auth/password/reset',
        'PUT /v1/me/password',
        'DELETE /v1/me',
        'POST /v1/me/subscription/checkout',
        'POST /v1/me/payments/verify',
        'POST /v1/webhooks/wompi',
        'GET /v1/me/taste',
        'GET /v1/me/taste/recommendations',
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
