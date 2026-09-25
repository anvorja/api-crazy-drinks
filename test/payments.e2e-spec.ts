import request from 'supertest';
import { signedWompiEvent } from './support/fake-wompi.js';
import { bearer, signUp } from './support/auth.js';
import { TestApp, createTestApp } from './support/create-test-app.js';

describe('payments with Wompi (e2e)', () => {
  let t: TestApp;
  let token: string;
  const http = () => request(t.app.getHttpServer());

  beforeEach(async () => {
    t = await createTestApp();
    ({ accessToken: token } = await signUp(t.app.getHttpServer()));
  });

  afterEach(async () => {
    await t.app.close();
  });

  const checkout = async (planId = 'pro') =>
    (
      await http()
        .post('/v1/me/subscription/checkout')
        .set(bearer(token))
        .send({ planId })
        .expect(201)
    ).body as {
      payment: { reference: string; amount: number; expiresAt: string };
      checkoutUrl: string;
    };

  const myPlan = async () =>
    (await http().get('/v1/me/subscription').set(bearer(token)).expect(200))
      .body;

  it('creates a pending payment and a signed Wompi checkout', async () => {
    const { payment, checkoutUrl } = await checkout();
    expect(payment).toMatchObject({
      amount: 89000,
      currency: 'COP',
      status: 'pending',
    });
    const url = new URL(checkoutUrl);
    expect(url.searchParams.get('reference')).toBe(payment.reference);
    expect(url.searchParams.get('amount-in-cents')).toBe('8900000');
    expect(url.searchParams.get('signature:integrity')).toMatch(
      /^[a-f0-9]{64}$/,
    );
  });

  it('the checkout link expires after PAYMENTS_CHECKOUT_TTL_MINUTES', async () => {
    const before = Date.now();
    const { payment, checkoutUrl } = await checkout();
    const expiresAt = Date.parse(payment.expiresAt);
    // TEST_ENV: 60 minutes.
    expect(expiresAt - before).toBeGreaterThanOrEqual(60 * 60_000 - 1000);
    expect(expiresAt - before).toBeLessThanOrEqual(60 * 60_000 + 5000);
    expect(new URL(checkoutUrl).searchParams.get('expiration-time')).toBe(
      payment.expiresAt,
    );
    const [listed] = (
      await http().get('/v1/me/payments').set(bearer(token)).expect(200)
    ).body as { status: string; expiresAt: string }[];
    expect(listed).toMatchObject({
      status: 'pending',
      expiresAt: payment.expiresAt,
    });
  });

  it('an approved webhook activates the plan, once', async () => {
    const { payment } = await checkout();
    const event = signedWompiEvent({
      id: 'tx-1',
      reference: payment.reference,
      status: 'APPROVED',
      amountInCents: 8_900_000,
    });
    await http().post('/v1/webhooks/wompi').send(event).expect(200);
    const first = await myPlan();
    expect(first.plan.id).toBe('pro');

    // Wompi retries: the same event again must not add another period.
    await http().post('/v1/webhooks/wompi').send(event).expect(200);
    expect((await myPlan()).subscription.currentPeriodEnd).toBe(
      first.subscription.currentPeriodEnd,
    );

    const payments = await http()
      .get('/v1/me/payments')
      .set(bearer(token))
      .expect(200);
    expect(payments.body[0]).toMatchObject({
      status: 'approved',
      transactionId: 'tx-1',
    });
  });

  it('rejects forged webhooks and never approves a wrong amount', async () => {
    const { payment } = await checkout();
    const forged = signedWompiEvent(
      {
        id: 'tx-2',
        reference: payment.reference,
        status: 'APPROVED',
        amountInCents: 8_900_000,
      },
      'test_events_attacker',
    );
    const res = await http()
      .post('/v1/webhooks/wompi')
      .send(forged)
      .expect(401);
    expect(res.body.code).toBe('INVALID_WEBHOOK_SIGNATURE');

    const cheap = signedWompiEvent({
      id: 'tx-3',
      reference: payment.reference,
      status: 'APPROVED',
      amountInCents: 100,
    });
    await http().post('/v1/webhooks/wompi').send(cheap).expect(200);
    expect((await myPlan()).plan.id).toBe('free');
  });

  it('confirms on return with the transaction id, when the webhook is late', async () => {
    const { payment } = await checkout();
    t.wompi.transactions.set('tx-4', {
      reference: payment.reference,
      transactionId: 'tx-4',
      status: 'approved',
      amountInCents: 8_900_000,
      currency: 'COP',
    });
    const res = await http()
      .post('/v1/me/payments/verify')
      .set(bearer(token))
      .send({ transactionId: 'tx-4' })
      .expect(200);
    expect(res.body.status).toBe('approved');
    expect((await myPlan()).plan.id).toBe('pro');

    const other = await signUp(t.app.getHttpServer());
    await http()
      .post('/v1/me/payments/verify')
      .set(bearer(other.accessToken))
      .send({ transactionId: 'tx-4' })
      .expect(403);
    await http()
      .post('/v1/me/payments/verify')
      .set(bearer(token))
      .send({ transactionId: 'nope' })
      .expect(404);
  });

  it('free plans and unknown plans cannot be bought', async () => {
    const free = await http()
      .post('/v1/me/subscription/checkout')
      .set(bearer(token))
      .send({ planId: 'free' })
      .expect(400);
    expect(free.body.code).toBe('PLAN_NOT_PURCHASABLE');
    const gold = await http()
      .post('/v1/me/subscription/checkout')
      .set(bearer(token))
      .send({ planId: 'gold' })
      .expect(404);
    expect(gold.body.code).toBe('PLAN_NOT_FOUND');
  });
});
