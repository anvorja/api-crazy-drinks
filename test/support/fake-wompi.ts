import { createHash } from 'node:crypto';
import { PaymentOutcome } from '../../src/billing/domain/payment.js';
import { WompiGateway } from '../../src/billing/infrastructure/wompi/wompi.gateway.js';
import { TEST_ENV } from './test-env.js';

/** The real Wompi adapter (signatures included) with the HTTP lookup replaced. */
export class FakeWompiGateway extends WompiGateway {
  readonly transactions = new Map<string, PaymentOutcome>();

  constructor() {
    super({
      publicKey: TEST_ENV.WOMPI_PUBLIC_KEY,
      privateKey: TEST_ENV.WOMPI_PRIVATE_KEY,
      integritySecret: TEST_ENV.WOMPI_INTEGRITY_SECRET,
      eventsSecret: TEST_ENV.WOMPI_EVENTS_SECRET,
      apiUrl: TEST_ENV.WOMPI_API_URL,
      checkoutUrl: TEST_ENV.WOMPI_CHECKOUT_URL,
      redirectUrl: TEST_ENV.PAYMENTS_REDIRECT_URL,
      timeoutMs: 1000,
    });
  }

  override async fetchOutcome(
    transactionId: string,
  ): Promise<PaymentOutcome | null> {
    return this.transactions.get(transactionId) ?? null;
  }
}

/** A transaction.updated event signed like Wompi does. */
export function signedWompiEvent(
  tx: {
    id: string;
    reference: string;
    status: string;
    amountInCents: number;
    currency?: string;
  },
  secret = TEST_ENV.WOMPI_EVENTS_SECRET,
) {
  const timestamp = 1_790_000_000;
  const checksum = createHash('sha256')
    .update(`${tx.id}${tx.status}${tx.amountInCents}${timestamp}${secret}`)
    .digest('hex');
  return {
    event: 'transaction.updated',
    data: {
      transaction: {
        id: tx.id,
        reference: tx.reference,
        status: tx.status,
        amount_in_cents: tx.amountInCents,
        currency: tx.currency ?? 'COP',
      },
    },
    environment: 'test',
    signature: {
      properties: [
        'transaction.id',
        'transaction.status',
        'transaction.amount_in_cents',
      ],
      checksum,
    },
    timestamp,
    sent_at: new Date().toISOString(),
  };
}
