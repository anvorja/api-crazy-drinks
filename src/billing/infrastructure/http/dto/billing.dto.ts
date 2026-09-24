import { z } from 'zod';
import { PlanStatus } from '../../../application/use-cases/billing.js';
import { Plan } from '../../../domain/plan.js';
import { Subscription } from '../../../domain/subscription.js';

export const planResponseSchema = z
  .object({
    id: z.string().meta({ example: 'pro' }),
    name: z.string().meta({ example: 'Pro' }),
    monthlyPrice: z.number(),
    currency: z.string().meta({ example: 'COP' }),
    limits: z.object({
      venues: z
        .number()
        .int()
        .nullable()
        .meta({ description: 'null = unlimited' }),
      inventoryItems: z
        .number()
        .int()
        .nullable()
        .meta({ description: 'null = unlimited' }),
      menuPricing: z.boolean().meta({
        description: 'Costs, suggested prices and margins on the venue menu',
      }),
      apiKeys: z.number().int(),
      apiDailyRequests: z.number().int(),
    }),
  })
  .meta({ id: 'Plan' });

export const planListResponseSchema = z.array(planResponseSchema);

export const subscriptionResponseSchema = z
  .object({
    userId: z.uuid(),
    planId: z.string(),
    status: z.enum(['active', 'canceled']),
    currentPeriodEnd: z.string(),
    updatedAt: z.string(),
  })
  .meta({
    id: 'Subscription',
    description:
      'A canceled subscription keeps working until currentPeriodEnd.',
  });

export const planStatusResponseSchema = z
  .object({
    plan: planResponseSchema.meta({
      description: 'The plan in effect right now',
    }),
    subscription: subscriptionResponseSchema.nullable(),
  })
  .meta({ id: 'MySubscription' });

export const setSubscriptionBodySchema = z
  .object({
    planId: z.string().min(1).meta({ example: 'pro' }),
    currentPeriodEnd: z.iso
      .datetime()
      .transform((d) => new Date(d))
      .meta({ example: '2026-10-24T00:00:00Z' }),
  })
  .meta({ id: 'SetSubscriptionRequest' });
export type SetSubscriptionBodyDto = z.infer<typeof setSubscriptionBodySchema>;

export const toPlanResponse = (
  plan: Plan,
): z.infer<typeof planResponseSchema> => ({
  id: plan.id,
  name: plan.name,
  monthlyPrice: plan.monthlyPrice,
  currency: plan.currency,
  limits: { ...plan.limits },
});

export const toSubscriptionResponse = (
  s: Subscription,
): z.infer<typeof subscriptionResponseSchema> => ({
  userId: s.userId,
  planId: s.planId,
  status: s.status,
  currentPeriodEnd: s.currentPeriodEnd.toISOString(),
  updatedAt: s.updatedAt.toISOString(),
});

export const toPlanStatusResponse = (
  status: PlanStatus,
): z.infer<typeof planStatusResponseSchema> => ({
  plan: toPlanResponse(status.plan),
  subscription: status.subscription
    ? toSubscriptionResponse(status.subscription)
    : null,
});
