import { Payment, extendSubscription, settle, toCents } from './payment.js';

const DAY = 86_400_000;
const now = new Date('2026-09-24T12:00:00Z');
const payment: Payment = {
  id: 'p1',
  reference: 'drinks-p1',
  userId: 'u1',
  planId: 'pro',
  amountInCents: toCents(89000),
  currency: 'COP',
  status: 'pending',
  transactionId: null,
  createdAt: now,
  updatedAt: now,
};
const outcome = {
  reference: 'drinks-p1',
  transactionId: 't1',
  status: 'approved' as const,
  amountInCents: 8_900_000,
  currency: 'COP',
};

describe('payments', () => {
  it('settles once and ignores later outcomes', () => {
    const approved = settle(payment, outcome, now);
    expect(approved).toMatchObject({ status: 'approved', transactionId: 't1' });
    expect(settle(approved, { ...outcome, status: 'declined' }, now)).toBe(
      approved,
    );
  });

  it('never approves a different amount or currency', () => {
    expect(
      settle(payment, { ...outcome, amountInCents: 100 }, now).status,
    ).toBe('error');
    expect(settle(payment, { ...outcome, currency: 'USD' }, now).status).toBe(
      'error',
    );
  });

  it('starts a new period, or extends the same plan from its end', () => {
    const fresh = extendSubscription(null, payment, 30, now);
    expect(fresh.currentPeriodEnd.getTime()).toBe(now.getTime() + 30 * DAY);

    const renewed = extendSubscription(fresh, payment, 30, now);
    expect(renewed.currentPeriodEnd.getTime()).toBe(now.getTime() + 60 * DAY);

    const otherPlan = extendSubscription(
      { ...fresh, planId: 'business' },
      payment,
      30,
      now,
    );
    expect(otherPlan.currentPeriodEnd.getTime()).toBe(now.getTime() + 30 * DAY);
  });
});
