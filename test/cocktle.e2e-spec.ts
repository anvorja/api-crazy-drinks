import request from 'supertest';
import { MINOR_BIRTH_DATE, bearer, signUp } from './support/auth.js';
import { TestApp, createTestApp } from './support/create-test-app.js';

describe('cocktle (e2e)', () => {
  let t: TestApp;
  let token: string;
  const http = () => request(t.app.getHttpServer());
  const guess = (drinkId: string, mode = 'zero') =>
    http()
      .post('/v1/cocktle/today/guesses')
      .set(bearer(token))
      .send({ drinkId, mode });

  beforeEach(async () => {
    t = await createTestApp();
    ({ accessToken: token } = await signUp(t.app.getHttpServer()));
  });

  afterEach(async () => {
    await t.app.close();
  });

  it('starts with one clue and no answer', async () => {
    const { body } = await http()
      .get('/v1/cocktle/today?mode=zero')
      .set(bearer(token))
      .expect(200);
    expect(body).toMatchObject({
      mode: 'zero',
      attemptsLeft: 6,
      finished: false,
      answer: null,
      share: null,
    });
    expect(body.clues).toHaveLength(1);
  });

  it('reveals a clue per miss and ends with the answer and a share text', async () => {
    // Zero mode with the test catalog: the answer is Limeade (id 5).
    const miss = await guess('6').expect(200);
    expect(miss.body.clues).toHaveLength(2);
    expect(miss.body.guesses[0]).toMatchObject({
      correct: false,
      drink: { id: '6' },
    });

    const hit = await guess('5').expect(200);
    expect(hit.body).toMatchObject({
      finished: true,
      solved: true,
      answer: { id: '5' },
    });
    expect(hit.body.clues).toHaveLength(6);
    expect(hit.body.share).toMatch(/· 2\/6\n.🟩$/u);

    await guess('4').expect(409);
    const stats = await http()
      .get('/v1/cocktle/stats?mode=zero')
      .set(bearer(token))
      .expect(200);
    expect(stats.body).toMatchObject({
      played: 1,
      won: 1,
      currentStreak: 1,
      distribution: [0, 1, 0, 0, 0, 0],
    });
  });

  it('rejects repeated or unknown guesses', async () => {
    await guess('6').expect(200);
    await guess('6').expect(400);
    await guess('999').expect(404);
  });

  it('classic mode is for adults; minors play zero by default', async () => {
    const minor = await signUp(t.app.getHttpServer(), MINOR_BIRTH_DATE);
    await http()
      .get('/v1/cocktle/today?mode=classic')
      .set(bearer(minor.accessToken))
      .expect(403);
    const { body } = await http()
      .get('/v1/cocktle/today')
      .set(bearer(minor.accessToken))
      .expect(200);
    expect(body.mode).toBe('zero');
    await http().get('/v1/cocktle/today').expect(401);
  });
});
