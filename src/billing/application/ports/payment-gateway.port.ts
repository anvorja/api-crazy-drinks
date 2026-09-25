import { Payment, PaymentOutcome } from '../../domain/payment.js';

/** A payment provider (Wompi today). */
export interface PaymentGateway {
  /** URL of the provider's hosted checkout for this payment. */
  checkoutUrl(payment: Payment, customer: { email: string }): string;
  /** Asks the provider about a transaction; null if it doesn't exist. */
  fetchOutcome(transactionId: string): Promise<PaymentOutcome | null>;
}
