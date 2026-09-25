import request from 'supertest';
import { bearer, signInAsAdmin, signUp } from './support/auth.js';
import { TestApp, createTestApp } from './support/create-test-app.js';

describe('identity (e2e)', () => {
  let t: TestApp;
  const http = () => request(t.app.getHttpServer());
  const server = () => t.app.getHttpServer();

  beforeEach(async () => {
    t = await createTestApp();
  });

  afterEach(async () => {
    await t.app.close();
  });

  describe('registration and login', () => {
    const body = {
      email: 'Ana@Example.com',
      password: 'secret-password-123',
      name: 'Ana',
      birthDate: '2000-02-29',
    };

    it('registers without leaking the password hash', async () => {
      const res = await http().post('/v1/auth/register').send(body).expect(201);
      expect(res.body).toMatchObject({
        email: 'ana@example.com',
        role: 'user',
        adult: true,
      });
      expect(JSON.stringify(res.body)).not.toMatch(/password|scrypt/i);
    });

    it('rejects duplicated emails, weak passwords and bad dates', async () => {
      await http().post('/v1/auth/register').send(body).expect(201);
      await http().post('/v1/auth/register').send(body).expect(409);
      await http()
        .post('/v1/auth/register')
        .send({ ...body, email: 'b@example.com', password: 'short' })
        .expect(400);
      await http()
        .post('/v1/auth/register')
        .send({ ...body, email: 'c@example.com', birthDate: '2999-01-01' })
        .expect(400);
    });

    it('uses the same error for unknown emails and wrong passwords', async () => {
      await http().post('/v1/auth/register').send(body).expect(201);
      const wrong = await http()
        .post('/v1/auth/login')
        .send({ email: body.email, password: 'nope-nope-123' })
        .expect(401);
      const unknown = await http()
        .post('/v1/auth/login')
        .send({ email: 'ghost@example.com', password: 'nope-nope-123' })
        .expect(401);
      expect(wrong.body.message).toBe(unknown.body.message);
    });

    it('GET /auth/me needs a valid token', async () => {
      await http().get('/v1/auth/me').expect(401);
      await http().get('/v1/auth/me').set(bearer('garbage')).expect(401);
      const { accessToken } = await signUp(server());
      const res = await http()
        .get('/v1/auth/me')
        .set(bearer(accessToken))
        .expect(200);
      expect(res.body.role).toBe('user');
    });
  });

  describe('refresh tokens', () => {
    it('rotate on every use', async () => {
      const { refreshToken } = await signUp(server());
      const res = await http()
        .post('/v1/auth/refresh')
        .send({ refreshToken })
        .expect(200);
      expect(res.body.refreshToken).not.toBe(refreshToken);
    });

    it('reusing a rotated token revokes the whole family', async () => {
      const { refreshToken: first } = await signUp(server());
      const { body: second } = await http()
        .post('/v1/auth/refresh')
        .send({ refreshToken: first })
        .expect(200);

      await http()
        .post('/v1/auth/refresh')
        .send({ refreshToken: first })
        .expect(401);
      await http()
        .post('/v1/auth/refresh')
        .send({ refreshToken: second.refreshToken })
        .expect(401);
    });

    it('logout revokes the session', async () => {
      const { refreshToken } = await signUp(server());
      await http().post('/v1/auth/logout').send({ refreshToken }).expect(204);
      await http().post('/v1/auth/refresh').send({ refreshToken }).expect(401);
    });
  });

  describe('roles', () => {
    it('admin endpoints reject anonymous and regular users', async () => {
      await http().get('/v1/admin/users').expect(401);
      const { accessToken } = await signUp(server());
      await http().get('/v1/admin/users').set(bearer(accessToken)).expect(403);
    });

    it('the configured admin can change roles; it applies on the next refresh', async () => {
      const admin = await signInAsAdmin(server());
      const user = await signUp(server());

      await http()
        .patch(`/v1/admin/users/${user.user.id}/role`)
        .set(bearer(admin.accessToken))
        .send({ role: 'venue_owner' })
        .expect(200);

      const refreshed = await http()
        .post('/v1/auth/refresh')
        .send({ refreshToken: user.refreshToken })
        .expect(200);
      expect(refreshed.body.user.role).toBe('venue_owner');
    });

    it('an admin cannot remove their own admin role', async () => {
      const admin = await signInAsAdmin(server());
      await http()
        .patch(`/v1/admin/users/${admin.user.id}/role`)
        .set(bearer(admin.accessToken))
        .send({ role: 'user' })
        .expect(403);
    });

    it('only admins can force a catalog sync', async () => {
      const admin = await signInAsAdmin(server());
      const res = await http()
        .post('/v1/admin/catalog/sync')
        .set(bearer(admin.accessToken))
        .expect(200);
      expect(res.body.synced).toBe(6);
    });
  });
});
