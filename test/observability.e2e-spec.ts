import request from 'supertest';
import { TestApp, createTestApp } from './support/create-test-app.js';
import { TEST_ENV } from './support/test-env.js';

describe('observability (e2e)', () => {
  let t: TestApp;
  const http = () => request(t.app.getHttpServer());

  beforeEach(async () => {
    t = await createTestApp();
  });

  afterEach(async () => {
    await t.app.close();
  });

  it('gives every request an id, or keeps the caller one', async () => {
    const res = await http().get('/v1/lab/moods').expect(200);
    expect(res.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
    const echoed = await http()
      .get('/v1/lab/moods')
      .set('X-Request-Id', 'lb-req-12345678')
      .expect(200);
    expect(echoed.headers['x-request-id']).toBe('lb-req-12345678');
    const bogus = await http()
      .get('/v1/lab/moods')
      .set('X-Request-Id', 'bad id!')
      .expect(200);
    expect(bogus.headers['x-request-id']).not.toBe('bad id!');
  });

  it('error bodies carry the request id', async () => {
    const res = await http().get('/v1/drinks/4').expect(403);
    expect(res.body.requestId).toBe(res.headers['x-request-id']);
  });

  it('reports unexpected errors without leaking them', async () => {
    t.source.crashOnSearch = true;
    const res = await http().get('/v1/drinks/search?q=moj').expect(500);
    expect(res.body).toMatchObject({
      code: 'INTERNAL_ERROR',
      message: 'Something went wrong on our side',
    });
    expect(JSON.stringify(res.body)).not.toContain('boom');
    expect(t.errors.reported).toHaveLength(1);
    expect(t.errors.reported[0].requestId).toBe(res.body.requestId);
  });

  it('exposes Prometheus metrics behind a token, by route pattern', async () => {
    await http().get('/v1/drinks/2').expect(403);
    await http().get('/metrics').expect(401);
    const res = await http()
      .get('/metrics')
      .set('Authorization', `Bearer ${TEST_ENV.METRICS_TOKEN}`)
      .expect(200);
    expect(res.text).toContain(
      'http_requests_total{method="GET",route="/v1/drinks/:id",status="403"} 1',
    );
    expect(res.text).toContain('http_request_duration_seconds_bucket');
    expect(res.text).toContain('process_cpu_user_seconds_total');
  });
});
