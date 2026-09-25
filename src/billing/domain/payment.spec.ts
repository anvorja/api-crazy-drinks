import {
  Payment,
  extendSubscription,
  settle,
  toCents,
  viewOf,
} from './payment.js';

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
  expiresAt: new Date(now.getTime() + 60 * 60_000),
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

  describe('viewOf', () => {
    const later = new Date(payment.expiresAt.getTime() + 1);

    it('shows an unpaid checkout as expired once its link expired', () => {
      expect(viewOf(payment, now).status).toBe('pending');
      expect(viewOf(payment, payment.expiresAt).status).toBe('expired');
      expect(viewOf(payment, later).status).toBe('expired');
    });

    it('keeps a started transaction pending (a slow PSE may still settle)', () => {
      const started = { ...payment, transactionId: 't1' };
      expect(viewOf(started, later).status).toBe('pending');
    });

    it('never touches settled payments', () => {
      const approved = settle(payment, outcome, now);
      expect(viewOf(approved, later).status).toBe('approved');
    });
  });
});
