import request from 'supertest';
import { bearer, signUp, signUpAs } from './support/auth.js';
import { TestApp, createTestApp } from './support/create-test-app.js';

describe('tu ADN de sabor (e2e)', () => {
  let t: TestApp;
  const http = () => request(t.app.getHttpServer());
  const server = () => t.app.getHttpServer();

  beforeEach(async () => {
    t = await createTestApp();
  });

  afterEach(async () => {
    await t.app.close();
  });

  const favorite = (token: string, ...ids: string[]) =>
    Promise.all(
      ids.map((id) =>
        http().put(`/me/favorites/${id}`).set(bearer(token)).expect(200),
      ),
    );

  it('has no profile until there are favorites', async () => {
    const { accessToken } = await signUp(server());
    const { body } = await http()
      .get('/me/taste')
      .set(bearer(accessToken))
      .expect(200);
    expect(body).toMatchObject({
      taste: null,
      hint: expect.stringContaining('/me/favorites'),
    });
  });

  it('learns the profile from favorites', async () => {
    const { accessToken } = await signUp(server());
    await favorite(accessToken, '1', '2', '3');

    const { body } = await http()
      .get('/me/taste')
      .set(bearer(accessToken))
      .expect(200);
    expect(body.hint).toBeNull();
    expect(body.taste).toMatchObject({ basedOn: 3, confidence: 'medium' });
    expect(body.taste.favoriteIngredients[0]).toEqual({
      ingredient: 'light rum',
      count: 3,
    });
  });

  it('recommendations are premium only', async () => {
    const { accessToken } = await signUp(server());
    await http()
      .get('/me/taste/recommendations')
      .set(bearer(accessToken))
      .expect(403);
  });

  it('recommends unseen drinks with reasons to premium users', async () => {
    const { accessToken } = await signUpAs(server(), 'premium');
    await http()
      .get('/me/taste/recommendations')
      .set(bearer(accessToken))
      .expect(400);

    await favorite(accessToken, '1', '2');
    const { body } = await http()
      .get('/me/taste/recommendations?limit=3')
      .set(bearer(accessToken))
      .expect(200);

    const ids = body.recommendations.map((r: { id: string }) => r.id);
    expect(ids).toHaveLength(3);
    expect(ids).not.toContain('1');
    expect(ids).not.toContain('2');
    expect(body.recommendations[0]).toMatchObject({
      name: 'Cuba Libre',
      match: expect.any(Number),
      reasons: expect.arrayContaining([expect.stringContaining('light rum')]),
    });
  });
});
