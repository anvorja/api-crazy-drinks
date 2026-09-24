import request from 'supertest';
import type { App } from 'supertest/types.js';
import { TEST_ENV } from './test-env.js';

export const ADULT_BIRTH_DATE = '1995-05-20';
export const MINOR_BIRTH_DATE = `${new Date().getUTCFullYear() - 15}-01-01`;

let counter = 0;

/** Registers a fresh user and returns its session. */
export async function signUp(server: App, birthDate = ADULT_BIRTH_DATE) {
  const email = `user${++counter}@test.local`;
  const password = 'secret-password-123';
  await request(server)
    .post('/auth/register')
    .send({ email, password, name: 'Test', birthDate })
    .expect(201);
  const res = await request(server)
    .post('/auth/login')
    .send({ email, password })
    .expect(200);
  const session = res.body as {
    accessToken: string;
    refreshToken: string;
    user: { id: string };
  };
  return { ...session, email };
}

export async function signInAsAdmin(server: App) {
  const res = await request(server)
    .post('/auth/login')
    .send({ email: TEST_ENV.ADMIN_EMAIL, password: TEST_ENV.ADMIN_PASSWORD })
    .expect(200);
  return res.body as {
    accessToken: string;
    refreshToken: string;
    user: { id: string };
  };
}

export const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

/** Signs up a user, has the admin give them a role (and optionally a plan), returns a fresh session. */
export async function signUpAs(
  server: App,
  role: 'venue_owner' | 'premium' | 'user',
  planId?: string,
) {
  const admin = await signInAsAdmin(server);
  const user = await signUp(server);
  if (role !== 'user') {
    await request(server)
      .patch(`/admin/users/${user.user.id}/role`)
      .set(bearer(admin.accessToken))
      .send({ role })
      .expect(200);
  }
  if (planId) {
    await request(server)
      .put(`/admin/users/${user.user.id}/subscription`)
      .set(bearer(admin.accessToken))
      .send({
        planId,
        currentPeriodEnd: new Date(Date.now() + 30 * 86_400_000).toISOString(),
      })
      .expect(200);
  }
  const { body } = await request(server)
    .post('/auth/refresh')
    .send({ refreshToken: user.refreshToken })
    .expect(200);
  return body as {
    accessToken: string;
    refreshToken: string;
    user: { id: string };
  };
}
