import { z } from 'zod';
import { PAYMENT_VIEW_STATUSES, PaymentView } from '../../../domain/payment.js';

export const checkoutBodySchema = z
  .object({ planId: z.string().min(1).meta({ example: 'pro' }) })
  .meta({ id: 'CheckoutRequest' });
export type CheckoutBodyDto = z.infer<typeof checkoutBodySchema>;

export const verifyPaymentBodySchema = z
  .object({
    transactionId: z.string().min(1).max(100).meta({
      description:
        'The ?id=… the checkout appends when it returns to your page',
    }),
  })
  .meta({ id: 'VerifyPaymentRequest' });
export type VerifyPaymentBodyDto = z.infer<typeof verifyPaymentBodySchema>;

export const paymentResponseSchema = z
  .object({
    id: z.uuid(),
    reference: z.string(),
    planId: z.string(),
    amount: z
      .number()
      .meta({ description: 'In currency units (not cents)', example: 89000 }),
    currency: z.string().meta({ example: 'COP' }),
    status: z.enum(PAYMENT_VIEW_STATUSES).meta({
      description:
        'expired: the checkout link expired before any transaction started (it can no longer be paid)',
    }),
    transactionId: z.string().nullable(),
    expiresAt: z
      .string()
      .meta({ description: 'Until when the checkout link can be paid' }),
    createdAt: z.string(),
    updatedAt: z.string(),
  })
  .meta({ id: 'Payment' });

export const paymentListResponseSchema = z.array(paymentResponseSchema);

export const checkoutResponseSchema = z
  .object({
    payment: paymentResponseSchema,
    checkoutUrl: z.string().meta({
      description:
        'Send the user here (redirect or new tab). They come back to PAYMENTS_REDIRECT_URL?id=<transactionId>.',
    }),
  })
  .meta({ id: 'Checkout' });

export const toPaymentResponse = (
  p: PaymentView,
): z.infer<typeof paymentResponseSchema> => ({
  id: p.id,
  reference: p.reference,
  planId: p.planId,
  amount: p.amountInCents / 100,
  currency: p.currency,
  status: p.status,
  transactionId: p.transactionId,
  expiresAt: p.expiresAt.toISOString(),
  createdAt: p.createdAt.toISOString(),
  updatedAt: p.updatedAt.toISOString(),
});
