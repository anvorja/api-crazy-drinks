import request from 'supertest';
import { TestApp, createTestApp } from './support/create-test-app.js';

describe('HTTP hardening (e2e)', () => {
  let t: TestApp;
  const http = () => request(t.app.getHttpServer());

  afterEach(async () => {
    await t.app.close();
  });

  describe('rate limit per IP', () => {
    beforeEach(async () => {
      t = await createTestApp({
        env: { RATE_LIMIT_MAX: '3', RATE_LIMIT_HEAVY_MAX: '2' },
      });
    });

    it('answers 429 with Retry-After once the window is used up', async () => {
      for (let i = 0; i < 3; i++) {
        const ok = await http().get('/v1/lab/moods').expect(200);
        expect(ok.headers['ratelimit-remaining']).toBe(String(2 - i));
      }
      const res = await http().get('/v1/lab/moods').expect(429);
      expect(res.body.code).toBe('RATE_LIMITED');
      expect(Number(res.headers['retry-after'])).toBeGreaterThan(0);
    });

    it('expensive endpoints have their own, stricter bucket', async () => {
      await http().get('/v1/drinks/suggest?q=lime').expect(200);
      await http().get('/v1/drinks/suggest?q=lime').expect(200);
      await http().get('/v1/drinks/suggest?q=lime').expect(429);
      await http().get('/v1/lab/moods').expect(200);
    });

    it('never limits health checks', async () => {
      for (let i = 0; i < 6; i++) await http().get('/health').expect(200);
    });
  });

  describe('headers and body size', () => {
    beforeEach(async () => {
      t = await createTestApp({ env: { BODY_LIMIT_KB: '1' } });
    });

    it('sends security headers and lets other origins load images', async () => {
      const res = await http().get('/v1/lab/moods').expect(200);
      expect(res.headers['x-content-type-options']).toBe('nosniff');
      expect(res.headers['strict-transport-security']).toBeDefined();
      expect(res.headers['cross-origin-resource-policy']).toBe('cross-origin');
      expect(res.headers['x-powered-by']).toBeUndefined();
    });

    it('rejects bodies over the limit with 413', async () => {
      const res = await http()
        .post('/v1/auth/login')
        .send({ email: 'a@b.co', password: 'x'.repeat(2000) })
        .expect(413);
      expect(res.body.code).toBe('PAYLOAD_TOO_LARGE');
    });
  });

  it('malformed JSON is a validation error', async () => {
    t = await createTestApp();
    const res = await http()
      .post('/v1/auth/login')
      .set('Content-Type', 'application/json')
      .send('{"email": ')
      .expect(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });
});
