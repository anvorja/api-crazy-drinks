import { ValidationError } from '../../shared/domain/errors.js';
import { DEFAULT_PLAN_ID } from './plan.js';

export type SubscriptionStatus = 'active' | 'canceled';

/** A paid plan for a user. Canceled subscriptions keep working until the period ends. */
export interface Subscription {
  userId: string;
  planId: string;
  status: SubscriptionStatus;
  currentPeriodEnd: Date;
  updatedAt: Date;
}

export const isCurrent = (
  subscription: Subscription | null,
  now: Date,
): boolean => subscription !== null && subscription.currentPeriodEnd > now;

export const effectivePlanId = (
  subscription: Subscription | null,
  now: Date,
): string =>
  subscription && isCurrent(subscription, now)
    ? subscription.planId
    : DEFAULT_PLAN_ID;

export function assertValidPeriodEnd(periodEnd: Date, now: Date): void {
  if (periodEnd <= now)
    throw new ValidationError('The period must end in the future');
}
