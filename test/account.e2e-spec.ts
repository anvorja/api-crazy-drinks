import request from 'supertest';
import { bearer, signInAsAdmin, signUp } from './support/auth.js';
import { TestApp, createTestApp } from './support/create-test-app.js';

const PASSWORD = 'secret-password-123';
const NEW_PASSWORD = 'brand-new-password-456';

describe('account management (e2e)', () => {
  let t: TestApp;
  const http = () => request(t.app.getHttpServer());
  const server = () => t.app.getHttpServer();

  beforeEach(async () => {
    t = await createTestApp();
  });

  afterEach(async () => {
    await t.app.close();
  });

  const login = (email: string, password: string) =>
    http()
      .post('/v1/auth/login')
      .send({ email, password, refreshTokenIn: 'body' });

  describe('forgot and reset password', () => {
    it('answers the same for unknown emails and sends nothing', async () => {
      await http()
        .post('/v1/auth/password/forgot')
        .send({ email: 'ghost@test.local' })
        .expect(202);
      expect(t.mailer.sent).toHaveLength(0);
    });

    it('emails a single-use link that sets a new password and closes every session', async () => {
      const { email, refreshToken } = await signUp(server());
      await http().post('/v1/auth/password/forgot').send({ email }).expect(202);

      const mail = t.mailer.lastTo(email)!;
      expect(mail.subject).toBe('Restablece tu contraseña');
      expect(mail.text).toContain('http://app.test/restablecer?token=');
      const token = t.mailer.resetTokenFor(email)!;

      await http()
        .post('/v1/auth/password/reset')
        .send({ token, newPassword: NEW_PASSWORD })
        .expect(204);
      expect(t.mailer.lastTo(email)!.subject).toBe('Tu contraseña cambió');

      await login(email, PASSWORD).expect(401);
      await login(email, NEW_PASSWORD).expect(200);
      const old = await http()
        .post('/v1/auth/refresh')
        .send({ refreshToken })
        .expect(401);
      expect(old.body.code).toBe('INVALID_REFRESH_TOKEN');

      const reused = await http()
        .post('/v1/auth/password/reset')
        .send({ token, newPassword: 'another-password-789' })
        .expect(401);
      expect(reused.body.code).toBe('INVALID_RESET_TOKEN');
    });

    it('a new request invalidates the previous link', async () => {
      const { email } = await signUp(server());
      await http().post('/v1/auth/password/forgot').send({ email }).expect(202);
      const first = t.mailer.resetTokenFor(email)!;
      await http().post('/v1/auth/password/forgot').send({ email }).expect(202);
      await http()
        .post('/v1/auth/password/reset')
        .send({ token: first, newPassword: NEW_PASSWORD })
        .expect(401);
    });

    it('enforces the password policy and limits requests', async () => {
      const { email } = await signUp(server());
      await http().post('/v1/auth/password/forgot').send({ email }).expect(202);
      const weak = await http()
        .post('/v1/auth/password/reset')
        .send({ token: t.mailer.resetTokenFor(email), newPassword: 'short' })
        .expect(400);
      expect(weak.body.code).toBe('WEAK_PASSWORD');

      await http().post('/v1/auth/password/forgot').send({ email }).expect(202);
      await http().post('/v1/auth/password/forgot').send({ email }).expect(202);
      const limited = await http()
        .post('/v1/auth/password/forgot')
        .send({ email })
        .expect(429);
      expect(limited.body.code).toBe('RATE_LIMITED');
    });
  });

  describe('profile, password and deletion', () => {
    it('updates the name', async () => {
      const { accessToken } = await signUp(server());
      const res = await http()
        .patch('/v1/me/profile')
        .set(bearer(accessToken))
        .send({ name: '  Ana   María ' })
        .expect(200);
      expect(res.body.name).toBe('Ana María');
      const bad = await http()
        .patch('/v1/me/profile')
        .set(bearer(accessToken))
        .send({ name: ' ' })
        .expect(400);
      expect(bad.body.code).toBe('INVALID_NAME');
    });

    it('changes the password only with the current one', async () => {
      const { accessToken, email } = await signUp(server());
      const wrong = await http()
        .put('/v1/me/password')
        .set(bearer(accessToken))
        .send({ currentPassword: 'not-it-123', newPassword: NEW_PASSWORD })
        .expect(401);
      expect(wrong.body.code).toBe('WRONG_PASSWORD');

      await http()
        .put('/v1/me/password')
        .set(bearer(accessToken))
        .send({ currentPassword: PASSWORD, newPassword: NEW_PASSWORD })
        .expect(204);
      await login(email, NEW_PASSWORD).expect(200);
    });

    it('deletes the account with the password', async () => {
      const { accessToken, email } = await signUp(server());
      const wrong = await http()
        .delete('/v1/me')
        .set(bearer(accessToken))
        .send({ password: 'not-it-123' })
        .expect(401);
      expect(wrong.body.code).toBe('WRONG_PASSWORD');

      await http()
        .delete('/v1/me')
        .set(bearer(accessToken))
        .send({ password: PASSWORD })
        .expect(204);
      await login(email, PASSWORD).expect(401);
    });

    it('admins cannot delete themselves', async () => {
      const admin = await signInAsAdmin(server());
      const res = await http()
        .delete('/v1/me')
        .set(bearer(admin.accessToken))
        .send({ password: 'admin-password-123' })
        .expect(403);
      expect(res.body.code).toBe('ADMIN_SELF_DELETION');
    });
  });
});
