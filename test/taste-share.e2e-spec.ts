import request from 'supertest';
import { bearer, signUp } from './support/auth.js';
import { TestApp, createTestApp } from './support/create-test-app.js';

describe('shareable taste and compatibility (e2e)', () => {
  let t: TestApp;
  const http = () => request(t.app.getHttpServer());
  const server = () => t.app.getHttpServer();

  beforeEach(async () => {
    t = await createTestApp();
  });

  afterEach(async () => {
    await t.app.close();
  });

  async function userWhoLikes(...ids: string[]) {
    const { accessToken } = await signUp(server());
    for (const id of ids) {
      await http()
        .put(`/v1/discover/${id}`)
        .set(bearer(accessToken))
        .send({ reaction: 'like' })
        .expect(200);
    }
    return accessToken;
  }

  it('cannot share an empty taste', async () => {
    const { accessToken } = await signUp(server());
    await http()
      .put('/v1/me/taste/share')
      .set(bearer(accessToken))
      .send({ displayName: 'Ana' })
      .expect(400);
  });

  it('shares a public profile and card that anyone can open', async () => {
    const token = await userWhoLikes('1', '2');
    const { body: share } = await http()
      .put('/v1/me/taste/share')
      .set(bearer(token))
      .send({ displayName: 'Ana <3' })
      .expect(200);
    expect(share.links.cardPng).toBe(`/v1/taste/${share.slug}/card.png`);

    // Renaming keeps the same link.
    const renamed = await http()
      .put('/v1/me/taste/share')
      .set(bearer(token))
      .send({ displayName: 'Ana' })
      .expect(200);
    expect(renamed.body.slug).toBe(share.slug);

    const profile = await http().get(`/v1/taste/${share.slug}`).expect(200);
    expect(profile.body).toMatchObject({
      displayName: 'Ana',
      taste: { basedOn: 2 },
    });
    expect(JSON.stringify(profile.body)).not.toMatch(/@test\.local|userId/);

    const svg = await http()
      .get(`/v1/taste/${share.slug}/card.svg`)
      .buffer(true)
      .parse((res, done) => {
        let text = '';
        res.on('data', (chunk: Buffer) => (text += chunk.toString()));
        res.on('end', () => done(null, text));
      })
      .expect(200);
    expect(svg.headers['content-type']).toContain('image/svg+xml');
    expect(svg.body).toContain('ADN DE SABOR');

    const png = await http()
      .get(`/v1/taste/${share.slug}/card.png`)
      .buffer(true)
      .expect(200);
    expect(png.headers['content-type']).toBe('image/png');
    expect((png.body as Buffer).subarray(1, 4).toString()).toBe('PNG');
  });

  it('compares with a friend and suggests bridge drinks', async () => {
    const friend = await userWhoLikes('1', '2');
    const { body: share } = await http()
      .put('/v1/me/taste/share')
      .set(bearer(friend))
      .send({ displayName: 'Friend' })
      .expect(200);

    const me = await userWhoLikes('3');
    const { body } = await http()
      .get(`/v1/me/taste/compatibility/${share.slug}`)
      .set(bearer(me))
      .expect(200);
    expect(body.score).toBeGreaterThan(50);
    expect(body.headline).toContain('% compatibles');
    expect(body.them.displayName).toBe('Friend');
    expect(body.bridges.map((b: { id: string }) => b.id)).not.toEqual(
      expect.arrayContaining(['1', '2', '3']),
    );

    await http()
      .get(`/v1/me/taste/compatibility/${share.slug}`)
      .set(bearer(friend))
      .expect(400);
  });

  it('turning sharing off kills the link', async () => {
    const token = await userWhoLikes('2');
    const { body: share } = await http()
      .put('/v1/me/taste/share')
      .set(bearer(token))
      .send({ displayName: 'Temp' })
      .expect(200);
    await http().delete('/v1/me/taste/share').set(bearer(token)).expect(204);
    await http().get(`/v1/taste/${share.slug}`).expect(404);
    const mine = await http()
      .get('/v1/me/taste/share')
      .set(bearer(token))
      .expect(200);
    expect(mine.body).toEqual({ share: null });
    await http().get('/v1/taste/bad!slug').expect(400);
  });
});
