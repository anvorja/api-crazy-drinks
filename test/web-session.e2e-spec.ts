import request from 'supertest';
import { MINOR_BIRTH_DATE, bearer, signUp } from './support/auth.js';
import { TestApp, createTestApp } from './support/create-test-app.js';
import { TEST_ENV } from './support/test-env.js';

const FRONTEND = TEST_ENV.CORS_ORIGINS;

describe('web session, CORS, versioning and error codes (e2e)', () => {
  let t: TestApp;
  const http = () => request(t.app.getHttpServer());

  beforeEach(async () => {
    t = await createTestApp();
  });

  afterEach(async () => {
    await t.app.close();
  });

  const cookieFrom = (res: request.Response) =>
    ([] as string[])
      .concat(res.headers['set-cookie'] ?? [])
      .find((c) => c.startsWith('refresh_token='));

  describe('versioning', () => {
    it('serves the API under /v1; health and index stay unversioned', async () => {
      await http().get('/v1/drinks/facets').expect(200);
      await http().get('/health').expect(200);
      await http().get('/').expect(200);
      const res = await http().get('/drinks/facets').expect(404);
      expect(res.body.code).toBe('ROUTE_NOT_FOUND');
    });
  });

  describe('error codes', () => {
    it('every error has statusCode, code, message, error and requestId', async () => {
      const res = await http().get('/v1/drinks/4').expect(403);
      expect(res.body).toEqual({
        statusCode: 403,
        code: 'AGE_RESTRICTED',
        message: expect.any(String),
        error: 'ForbiddenError',
        requestId: expect.any(String),
      });
    });

    it('validation errors list every invalid field', async () => {
      const res = await http()
        .post('/v1/auth/register')
        .send({ email: 'nope', password: '', name: '' })
        .expect(400);
      expect(res.body.code).toBe('VALIDATION_FAILED');
      expect(res.body.details.map((d: { path: string }) => d.path)).toEqual(
        expect.arrayContaining(['email', 'password', 'name', 'birthDate']),
      );
    });

    it('business rules have their own codes', async () => {
      const bad = await http()
        .post('/v1/auth/login')
        .send({ email: 'ghost@test.local', password: 'whatever-123' })
        .expect(401);
      expect(bad.body.code).toBe('INVALID_CREDENTIALS');

      const minor = await signUp(t.app.getHttpServer(), MINOR_BIRTH_DATE);
      const party = await http()
        .get('/v1/lab/moods/party')
        .set(bearer(minor.accessToken))
        .expect(403);
      expect(party.body.code).toBe('AGE_RESTRICTED');
      const noAuth = await http().get('/v1/me/favorites').expect(401);
      expect(noAuth.body.code).toBe('AUTH_REQUIRED');
    });
  });

  describe('CORS', () => {
    it('allows the configured frontend with credentials', async () => {
      const res = await http()
        .options('/v1/auth/login')
        .set('Origin', FRONTEND)
        .set('Access-Control-Request-Method', 'POST')
        .expect(204);
      expect(res.headers['access-control-allow-origin']).toBe(FRONTEND);
      expect(res.headers['access-control-allow-credentials']).toBe('true');
    });

    it('does not allow other origins', async () => {
      const res = await http()
        .options('/v1/auth/login')
        .set('Origin', 'https://evil.example')
        .set('Access-Control-Request-Method', 'POST');
      expect(res.headers['access-control-allow-origin']).toBeUndefined();
    });
  });

  describe('refresh token in an httpOnly cookie', () => {
    async function browserLogin() {
      const { email } = await signUp(t.app.getHttpServer());
      const res = await http()
        .post('/v1/auth/login')
        .set('Origin', FRONTEND)
        .send({ email, password: 'secret-password-123' })
        .expect(200);
      return { res, cookie: cookieFrom(res)! };
    }

    it('logs in without exposing the refresh token to JavaScript', async () => {
      const { res, cookie } = await browserLogin();
      expect(res.body).toMatchObject({
        refreshToken: null,
        refreshTokenIn: 'cookie',
      });
      expect(cookie).toMatch(/HttpOnly/);
      expect(cookie).toMatch(/Path=\/v1\/auth/);
      expect(cookie).toMatch(/SameSite=Lax/);
    });

    it('refreshes with the cookie from the frontend and rotates it', async () => {
      const { cookie } = await browserLogin();
      const pair = cookie.split(';')[0];
      const res = await http()
        .post('/v1/auth/refresh')
        .set('Origin', FRONTEND)
        .set('Cookie', pair)
        .send({})
        .expect(200);
      expect(res.body.accessToken).toEqual(expect.any(String));
      expect(cookieFrom(res)?.split(';')[0]).not.toBe(pair);
    });

    it('rejects the cookie from other origins (CSRF)', async () => {
      const { cookie } = await browserLogin();
      const pair = cookie.split(';')[0];
      const noOrigin = await http()
        .post('/v1/auth/refresh')
        .set('Cookie', pair)
        .send({})
        .expect(401);
      expect(noOrigin.body.code).toBe('ORIGIN_NOT_ALLOWED');
      await http()
        .post('/v1/auth/refresh')
        .set('Origin', 'https://evil.example')
        .set('Cookie', pair)
        .send({})
        .expect(401);
    });

    it('logout revokes the session and clears the cookie', async () => {
      const { cookie } = await browserLogin();
      const pair = cookie.split(';')[0];
      const out = await http()
        .post('/v1/auth/logout')
        .set('Origin', FRONTEND)
        .set('Cookie', pair)
        .send({})
        .expect(204);
      expect(cookieFrom(out)).toMatch(/Expires=Thu, 01 Jan 1970/);
      const again = await http()
        .post('/v1/auth/refresh')
        .set('Origin', FRONTEND)
        .set('Cookie', pair)
        .send({})
        .expect(401);
      expect(again.body.code).toBe('INVALID_REFRESH_TOKEN');
    });

    it('clients without a browser can still get it in the body', async () => {
      const { refreshToken } = await signUp(t.app.getHttpServer());
      const res = await http()
        .post('/v1/auth/refresh')
        .send({ refreshToken })
        .expect(200);
      expect(res.body).toMatchObject({
        refreshTokenIn: 'body',
        refreshToken: expect.any(String),
      });
      expect(cookieFrom(res)).toBeUndefined();
    });
  });
});
