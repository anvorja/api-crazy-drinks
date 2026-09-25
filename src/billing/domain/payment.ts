import { Subscription } from './subscription.js';

export const PAYMENT_STATUSES = [
  'pending',
  'approved',
  'declined',
  'voided',
  'error',
] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

/** One purchase of a plan period, paid through a payment gateway. */
export interface Payment {
  id: string;
  /** Unique reference shared with the gateway. */
  reference: string;
  userId: string;
  planId: string;
  amountInCents: number;
  currency: string;
  status: PaymentStatus;
  /** The gateway's transaction id, once known. */
  transactionId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface PaymentRepository {
  create(payment: Payment): Promise<void>;
  findByReference(reference: string): Promise<Payment | null>;
  save(payment: Payment): Promise<void>;
  listByUser(userId: string): Promise<Payment[]>;
}

/** What the gateway says happened to a transaction. */
export interface PaymentOutcome {
  reference: string;
  transactionId: string;
  status: PaymentStatus;
  amountInCents: number;
  currency: string;
}

export const isFinal = (status: PaymentStatus) => status !== 'pending';

export const toCents = (amount: number) => Math.round(amount * 100);

/**
 * Applies an outcome to a payment. A payment only moves forward once (idempotent: the webhook
 * and a manual verification may both arrive). An amount or currency that doesn't match
 * becomes an error: never activate a plan for less than its price.
 */
export function settle(
  payment: Payment,
  outcome: PaymentOutcome,
  now: Date,
): Payment {
  if (isFinal(payment.status)) return payment;
  const matches =
    outcome.amountInCents === payment.amountInCents &&
    outcome.currency === payment.currency;
  return {
    ...payment,
    status: matches ? outcome.status : 'error',
    transactionId: outcome.transactionId,
    updatedAt: now,
  };
}

/**
 * An approved payment adds a period. Renewing the same plan while it is still current
 * extends it from its end; otherwise the new period starts now.
 */
export function extendSubscription(
  current: Subscription | null,
  payment: Payment,
  periodDays: number,
  now: Date,
): Subscription {
  const renewing =
    current !== null &&
    current.planId === payment.planId &&
    current.currentPeriodEnd > now;
  const start = renewing ? current.currentPeriodEnd : now;
  return {
    userId: payment.userId,
    planId: payment.planId,
    status: 'active',
    currentPeriodEnd: new Date(start.getTime() + periodDays * 86_400_000),
    updatedAt: now,
  };
}
