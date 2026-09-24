import request from 'supertest';
import { TEST_ENV } from './support/test-env.js';
import { bearer, signInAsAdmin, signUp, signUpAs } from './support/auth.js';
import { TestApp, createTestApp } from './support/create-test-app.js';

describe('freemium features (e2e)', () => {
  let t: TestApp;
  const http = () => request(t.app.getHttpServer());
  const server = () => t.app.getHttpServer();

  beforeEach(async () => {
    t = await createTestApp();
  });

  afterEach(async () => {
    await t.app.close();
  });

  describe('login throttling', () => {
    it('locks the account after repeated failures, with Retry-After', async () => {
      const { email } = await signUp(server());

      const max = Number(TEST_ENV.LOGIN_MAX_FAILURES_PER_ACCOUNT);
      for (let i = 0; i < max; i++) {
        await http()
          .post('/auth/login')
          .send({ email, password: 'wrong-pass-1' })
          .expect(401);
      }
      const locked = await http()
        .post('/auth/login')
        .send({ email, password: 'secret-password-123' })
        .expect(429);
      expect(Number(locked.headers['retry-after'])).toBeGreaterThan(0);
    });
  });

  describe('API keys', () => {
    it('are shown once, authenticate as their owner and count against the quota', async () => {
      const { accessToken } = await signUp(server());
      const { body: created } = await http()
        .post('/me/api-keys')
        .set(bearer(accessToken))
        .send({ name: 'POS' })
        .expect(201);
      expect(created.key).toMatch(/^dk_/);

      const list = await http()
        .get('/me/api-keys')
        .set(bearer(accessToken))
        .expect(200);
      expect(JSON.stringify(list.body)).not.toContain(created.key);

      // The owner is an adult: the key unlocks alcoholic drinks.
      const res = await http()
        .get('/drinks/4')
        .set('X-API-Key', created.key)
        .expect(200);
      expect(res.headers['x-ratelimit-limit']).toBe('3');
      expect(res.headers['x-ratelimit-remaining']).toBe('2');

      await http().get('/drinks/4').set('X-API-Key', created.key).expect(200);
      await http().get('/drinks/4').set('X-API-Key', created.key).expect(200);
      const over = await http()
        .get('/drinks/4')
        .set('X-API-Key', created.key)
        .expect(429);
      expect(Number(over.headers['retry-after'])).toBeGreaterThan(0);
    });

    it('respect the plan limit and can be revoked', async () => {
      const { accessToken } = await signUp(server());
      const { body: key } = await http()
        .post('/me/api-keys')
        .set(bearer(accessToken))
        .send({ name: 'one' })
        .expect(201);
      await http()
        .post('/me/api-keys')
        .set(bearer(accessToken))
        .send({ name: 'two' })
        .expect(402);

      await http()
        .delete(`/me/api-keys/${key.id}`)
        .set(bearer(accessToken))
        .expect(204);
      await http().get('/drinks/random').set('X-API-Key', key.key).expect(401);
    });

    it('cannot manage the account', async () => {
      const { accessToken } = await signUp(server());
      const { body: key } = await http()
        .post('/me/api-keys')
        .set(bearer(accessToken))
        .send({ name: 'k' })
        .expect(201);
      await http().get('/me/api-keys').set('X-API-Key', key.key).expect(403);
      await http()
        .get('/auth/me')
        .set('X-API-Key', key.key)
        .set(bearer(accessToken))
        .expect(400);
    });
  });

  describe('saved pantry and favorites', () => {
    it('saves a pantry and suggests from it', async () => {
      const { accessToken } = await signUp(server());
      const empty = await http()
        .get('/me/pantry')
        .set(bearer(accessToken))
        .expect(200);
      expect(empty.body).toEqual({ ingredients: [], updatedAt: null });

      const saved = await http()
        .put('/me/pantry')
        .set(bearer(accessToken))
        .send({ ingredients: ['Ron', 'Limón', 'limon', 'Azúcar'] })
        .expect(200);
      expect(saved.body.ingredients).toEqual(['Ron', 'Limón', 'Azúcar']);

      const suggestions = await http()
        .get('/me/pantry/suggestions?maxMissing=0')
        .set(bearer(accessToken))
        .expect(200);
      expect(
        suggestions.body.canMake.map((d: { name: string }) => d.name),
      ).toEqual(['Daiquiri']);
    });

    it('keeps favorites, newest first, idempotently', async () => {
      const { accessToken } = await signUp(server());
      await http().put('/me/favorites/2').set(bearer(accessToken)).expect(200);
      await http().put('/me/favorites/5').set(bearer(accessToken)).expect(200);
      await http().put('/me/favorites/5').set(bearer(accessToken)).expect(200);

      const list = await http()
        .get('/me/favorites')
        .set(bearer(accessToken))
        .expect(200);
      expect(
        list.body.map((f: { drink: { id: string } }) => f.drink.id),
      ).toEqual(['5', '2']);

      await http()
        .delete('/me/favorites/5')
        .set(bearer(accessToken))
        .expect(204);
      const after = await http()
        .get('/me/favorites')
        .set(bearer(accessToken))
        .expect(200);
      expect(after.body).toHaveLength(1);
      await http()
        .put('/me/favorites/999')
        .set(bearer(accessToken))
        .expect(404);
    });
  });

  describe('plans and subscriptions', () => {
    it('lists plans publicly and starts everyone on free', async () => {
      const plans = await http().get('/plans').expect(200);
      expect(plans.body.map((p: { id: string }) => p.id)).toEqual([
        'free',
        'pro',
      ]);

      const { accessToken } = await signUp(server());
      const mine = await http()
        .get('/me/subscription')
        .set(bearer(accessToken))
        .expect(200);
      expect(mine.body).toMatchObject({
        plan: { id: 'free' },
        subscription: null,
      });
    });

    it('only admins set subscriptions; cancel keeps the plan until period end', async () => {
      const user = await signUpAs(server(), 'user', 'pro');
      const mine = await http()
        .get('/me/subscription')
        .set(bearer(user.accessToken))
        .expect(200);
      expect(mine.body.plan.id).toBe('pro');

      await http()
        .put(`/admin/users/${user.user.id}/subscription`)
        .set(bearer(user.accessToken))
        .send({ planId: 'pro', currentPeriodEnd: '2099-01-01T00:00:00Z' })
        .expect(403);

      const canceled = await http()
        .post('/me/subscription/cancel')
        .set(bearer(user.accessToken))
        .expect(200);
      expect(canceled.body.status).toBe('canceled');
      const still = await http()
        .get('/me/subscription')
        .set(bearer(user.accessToken))
        .expect(200);
      expect(still.body.plan.id).toBe('pro');
    });

    it('rejects unknown plans and past periods', async () => {
      const admin = await signInAsAdmin(server());
      const user = await signUp(server());
      const url = `/admin/users/${user.user.id}/subscription`;
      await http()
        .put(url)
        .set(bearer(admin.accessToken))
        .send({ planId: 'gold', currentPeriodEnd: '2099-01-01T00:00:00Z' })
        .expect(400);
      await http()
        .put(url)
        .set(bearer(admin.accessToken))
        .send({ planId: 'pro', currentPeriodEnd: '2000-01-01T00:00:00Z' })
        .expect(400);
    });
  });
});
