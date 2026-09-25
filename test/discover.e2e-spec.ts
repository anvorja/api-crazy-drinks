import request from 'supertest';
import { bearer, signUp } from './support/auth.js';
import { TestApp, createTestApp } from './support/create-test-app.js';

describe('discover · swipe (e2e)', () => {
  let t: TestApp;
  const http = () => request(t.app.getHttpServer());
  let token: string;

  beforeEach(async () => {
    t = await createTestApp();
    ({ accessToken: token } = await signUp(t.app.getHttpServer()));
  });

  afterEach(async () => {
    await t.app.close();
  });

  const swipe = (id: string, reaction: string) =>
    http().put(`/v1/discover/${id}`).set(bearer(token)).send({ reaction });

  it('deals cards, learns from swipes and never repeats them', async () => {
    const first = await http()
      .get('/v1/discover/deck?count=30')
      .set(bearer(token))
      .expect(200);
    expect(first.body).toHaveLength(6);
    expect(first.body[0]).toMatchObject({
      id: expect.any(String),
      images: expect.anything(),
    });

    const liked = await swipe('2', 'like').expect(200);
    expect(liked.body).toMatchObject({ drinkId: '2', reaction: 'like' });
    expect(liked.body.taste.basedOn).toBe(1);

    await swipe('6', 'dislike').expect(200);
    const deck = await http()
      .get('/v1/discover/deck?count=30')
      .set(bearer(token))
      .expect(200);
    expect(deck.body.map((d: { id: string }) => d.id)).not.toEqual(
      expect.arrayContaining(['2']),
    );
    expect(deck.body).toHaveLength(4);

    const taste = await http()
      .get('/v1/me/taste')
      .set(bearer(token))
      .expect(200);
    expect(taste.body.taste.basedOn).toBe(2);
  });

  it('a superlike also saves a favorite; swiping again replaces the reaction', async () => {
    await swipe('4', 'superlike').expect(200);
    const favorites = await http()
      .get('/v1/me/favorites')
      .set(bearer(token))
      .expect(200);
    expect(
      favorites.body.map((f: { drink: { id: string } }) => f.drink.id),
    ).toEqual(['4']);

    await swipe('1', 'like').expect(200);
    await swipe('1', 'dislike').expect(200);
    const stats = await http()
      .get('/v1/discover/stats')
      .set(bearer(token))
      .expect(200);
    expect(stats.body).toEqual({
      likes: 0,
      dislikes: 1,
      superlikes: 1,
      swiped: 2,
    });
  });

  it('undo puts the drink back in the deck', async () => {
    await swipe('3', 'dislike').expect(200);
    await http().delete('/v1/discover/3').set(bearer(token)).expect(204);
    const deck = await http()
      .get('/v1/discover/deck?count=30')
      .set(bearer(token))
      .expect(200);
    expect(deck.body.map((d: { id: string }) => d.id)).toContain('3');
  });

  it('validates the reaction and respects the age rule', async () => {
    await swipe('2', 'love').expect(400);
    await swipe('999', 'like').expect(404);
    await http().get('/v1/discover/deck').expect(401);
  });
});
