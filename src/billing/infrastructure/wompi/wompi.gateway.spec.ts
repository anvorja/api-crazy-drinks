import { createHash } from 'node:crypto';
import { WompiGateway } from './wompi.gateway.js';

const sha256 = (v: string) => createHash('sha256').update(v).digest('hex');

const gateway = (
  eventsSecret = 'prod_events_OcHnIzeBl5socpwByQ4hA52Em3USQ93Z',
) =>
  new WompiGateway({
    publicKey: 'pub_test_abc',
    privateKey: 'prv_test_def',
    integritySecret: 'test_integrity_xyz',
    eventsSecret,
    apiUrl: 'https://sandbox.wompi.co/v1',
    checkoutUrl: 'https://checkout.wompi.co/p/',
    redirectUrl: 'https://app.example.com/pago',
    timeoutMs: 1000,
  });

describe('WompiGateway', () => {
  it('builds the Web Checkout URL with the integrity signature', () => {
    const url = new URL(
      gateway().checkoutUrl(
        {
          id: 'p1',
          reference: 'drinks-p1',
          userId: 'u1',
          planId: 'pro',
          amountInCents: 8_900_000,
          currency: 'COP',
          status: 'pending',
          transactionId: null,
          expiresAt: new Date('2026-09-25T14:00:00.000Z'),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        { email: 'ana@example.com' },
      ),
    );
    expect(url.origin + url.pathname).toBe('https://checkout.wompi.co/p/');
    expect(Object.fromEntries(url.searchParams)).toEqual({
      'public-key': 'pub_test_abc',
      currency: 'COP',
      'amount-in-cents': '8900000',
      reference: 'drinks-p1',
      // With expiration-time, it goes before the secret in the integrity signature.
      'signature:integrity': sha256(
        'drinks-p18900000COP2026-09-25T14:00:00.000Ztest_integrity_xyz',
      ),
      'expiration-time': '2026-09-25T14:00:00.000Z',
      'redirect-url': 'https://app.example.com/pago',
      'customer-data:email': 'ana@example.com',
    });
  });

  // The example from https://docs.wompi.co/docs/colombia/eventos/
  const docsEvent = {
    event: 'transaction.updated',
    data: {
      transaction: {
        id: '1234-1610641025-49201',
        amount_in_cents: 4490000,
        reference: 'MZQ3X2DE2SMX',
        currency: 'COP',
        status: 'APPROVED',
      },
    },
    signature: {
      properties: [
        'transaction.id',
        'transaction.status',
        'transaction.amount_in_cents',
      ],
      checksum: sha256(
        '1234-1610641025-49201APPROVED44900001530291411prod_events_OcHnIzeBl5socpwByQ4hA52Em3USQ93Z',
      ),
    },
    timestamp: 1530291411,
  };

  it('verifies events exactly as the Wompi docs describe', () => {
    expect(gateway().verifyEvent(docsEvent)).toEqual({
      valid: true,
      outcome: {
        reference: 'MZQ3X2DE2SMX',
        transactionId: '1234-1610641025-49201',
        status: 'approved',
        amountInCents: 4490000,
        currency: 'COP',
      },
    });
  });

  it('rejects tampered events and other secrets', () => {
    const tampered = structuredClone(docsEvent);
    tampered.data.transaction.status = 'DECLINED';
    expect(gateway().verifyEvent(tampered).valid).toBe(false);
    expect(gateway('prod_events_other').verifyEvent(docsEvent).valid).toBe(
      false,
    );
    expect(gateway().verifyEvent({ nope: true }).valid).toBe(false);
  });

  it('queries a transaction with the private key (Wompi rejects it otherwise)', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          data: {
            id: '12-34',
            reference: 'drinks-p1',
            status: 'APPROVED',
            amount_in_cents: 8_900_000,
            currency: 'COP',
          },
        }),
        { status: 200 },
      ),
    );
    try {
      const outcome = await gateway().fetchOutcome('12-34');
      expect(outcome).toMatchObject({
        transactionId: '12-34',
        status: 'approved',
      });
      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toBe('https://sandbox.wompi.co/v1/transactions/12-34');
      expect(init?.headers).toEqual({ Authorization: 'Bearer prv_test_def' });
    } finally {
      fetchMock.mockRestore();
    }
  });
});
