import { createHash, timingSafeEqual } from 'node:crypto';
import { UnavailableError } from '../../../shared/domain/errors.js';
import { PaymentGateway } from '../../application/ports/payment-gateway.port.js';
import {
  Payment,
  PaymentOutcome,
  PaymentStatus,
} from '../../domain/payment.js';

export interface WompiSettings {
  publicKey: string;
  /** Server-side only: Wompi answers transaction queries only with it. */
  privateKey: string;
  integritySecret: string;
  eventsSecret: string;
  /** https://sandbox.wompi.co/v1 or https://production.wompi.co/v1 */
  apiUrl: string;
  /** https://checkout.wompi.co/p/ */
  checkoutUrl: string;
  /** Frontend page Wompi returns to (it appends ?id=<transactionId>). */
  redirectUrl: string;
  timeoutMs: number;
}

/** What Wompi sends and returns for a transaction (only what we use). */
interface WompiTransactionDto {
  id: string;
  reference: string;
  status: string;
  amount_in_cents: number;
  currency: string;
}

const STATUSES: Record<string, PaymentStatus> = {
  APPROVED: 'approved',
  DECLINED: 'declined',
  VOIDED: 'voided',
  ERROR: 'error',
  PENDING: 'pending',
};

const sha256 = (value: string) =>
  createHash('sha256').update(value).digest('hex');

const toOutcome = (t: WompiTransactionDto): PaymentOutcome => ({
  reference: t.reference,
  transactionId: t.id,
  status: STATUSES[t.status] ?? 'error',
  amountInCents: t.amount_in_cents,
  currency: t.currency,
});

/** Wompi (https://docs.wompi.co): hosted Web Checkout + signed events. */
export class WompiGateway implements PaymentGateway {
  constructor(private readonly settings: WompiSettings) {}

  /**
   * Web Checkout URL. With an expiration time the integrity signature is
   * SHA256(reference + amount + currency + expirationTime + secret); after that time Wompi
   * refuses to charge the link.
   */
  checkoutUrl(payment: Payment, customer: { email: string }): string {
    const expirationTime = payment.expiresAt.toISOString();
    const signature = sha256(
      `${payment.reference}${payment.amountInCents}${payment.currency}${expirationTime}${this.settings.integritySecret}`,
    );
    const params = new URLSearchParams({
      'public-key': this.settings.publicKey,
      currency: payment.currency,
      'amount-in-cents': String(payment.amountInCents),
      reference: payment.reference,
      'signature:integrity': signature,
      'expiration-time': expirationTime,
      'redirect-url': this.settings.redirectUrl,
      'customer-data:email': customer.email,
    });
    return `${this.settings.checkoutUrl}?${params.toString()}`;
  }

  async fetchOutcome(transactionId: string): Promise<PaymentOutcome | null> {
    let res: Response;
    try {
      res = await fetch(
        `${this.settings.apiUrl}/transactions/${encodeURIComponent(transactionId)}`,
        {
          headers: { Authorization: `Bearer ${this.settings.privateKey}` },
          signal: AbortSignal.timeout(this.settings.timeoutMs),
        },
      );
    } catch {
      throw new UnavailableError(
        'Wompi is not reachable right now',
        'PAYMENTS_UNAVAILABLE',
      );
    }
    if (res.status === 404) return null;
    if (!res.ok)
      throw new UnavailableError(
        `Wompi answered ${res.status}`,
        'PAYMENTS_UNAVAILABLE',
      );
    const body = (await res.json()) as { data: WompiTransactionDto };
    return toOutcome(body.data);
  }

  /**
   * Verifies a Wompi event: SHA256 of the values listed in signature.properties (in order),
   * then the timestamp, then the events secret. Returns the outcome for transaction events,
   * null for events we don't handle, and throws nothing: callers decide on invalid ones.
   */
  verifyEvent(event: unknown): {
    valid: boolean;
    outcome: PaymentOutcome | null;
  } {
    const e = event as {
      event?: string;
      data?: { transaction?: WompiTransactionDto };
      signature?: { properties?: unknown; checksum?: unknown };
      timestamp?: unknown;
    };
    const properties = e.signature?.properties;
    const checksum = e.signature?.checksum;
    const timestamp = e.timestamp;
    if (
      !Array.isArray(properties) ||
      typeof checksum !== 'string' ||
      (typeof timestamp !== 'number' && typeof timestamp !== 'string')
    ) {
      return { valid: false, outcome: null };
    }
    const values = properties.map((path) =>
      String(
        String(path)
          .split('.')
          .reduce<unknown>(
            (node, key) => (node as Record<string, unknown> | undefined)?.[key],
            e.data,
          ),
      ),
    );
    const expected = sha256(
      `${values.join('')}${timestamp}${this.settings.eventsSecret}`,
    );
    const valid =
      expected.length === checksum.length &&
      timingSafeEqual(
        Buffer.from(expected),
        Buffer.from(checksum.toLowerCase()),
      );
    const outcome =
      valid && e.event === 'transaction.updated' && e.data?.transaction
        ? toOutcome(e.data.transaction)
        : null;
    return { valid, outcome };
  }
}
