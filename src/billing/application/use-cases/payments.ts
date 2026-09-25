import { Clock, IdGenerator } from '../../../shared/application/ports.js';
import {
  ForbiddenError,
  NotFoundError,
  UnavailableError,
  ValidationError,
} from '../../../shared/domain/errors.js';
import { Principal } from '../../../identity/domain/principal.js';
import {
  PlanRepository,
  SubscriptionRepository,
} from '../../domain/billing.repositories.js';
import {
  Payment,
  PaymentOutcome,
  PaymentRepository,
  PaymentView,
  extendSubscription,
  settle,
  toCents,
  viewOf,
} from '../../domain/payment.js';
import { PaymentGateway } from '../ports/payment-gateway.port.js';
import { UserDirectory } from '../ports/user-directory.port.js';

export interface PaymentSettings {
  periodDays: number;
}

export interface CheckoutSettings {
  /** How long the checkout link can be paid. */
  ttlMinutes: number;
}

const unavailable = () =>
  new UnavailableError('Payments are not configured', 'PAYMENTS_UNAVAILABLE');

/** Creates a pending payment for a plan and returns the hosted checkout to pay it. */
export class StartCheckout {
  constructor(
    private readonly plans: PlanRepository,
    private readonly payments: PaymentRepository,
    private readonly users: UserDirectory,
    private readonly gateway: PaymentGateway | null,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
    private readonly settings: CheckoutSettings,
  ) {}

  async execute(
    actor: Principal,
    planId: string,
  ): Promise<{ payment: Payment; checkoutUrl: string }> {
    if (!this.gateway) throw unavailable();
    const plan = await this.plans.findById(planId);
    if (!plan)
      throw new NotFoundError(`Unknown plan ${planId}`, 'PLAN_NOT_FOUND');
    if (plan.monthlyPrice <= 0) {
      throw new ValidationError(
        'That plan is free: nothing to pay',
        'PLAN_NOT_PURCHASABLE',
      );
    }
    const email = await this.users.emailOf(actor.userId);
    if (!email) throw new NotFoundError('User not found', 'USER_NOT_FOUND');

    const now = this.clock.now();
    const id = this.ids.next();
    const payment: Payment = {
      id,
      reference: `drinks-${id}`,
      userId: actor.userId,
      planId: plan.id,
      amountInCents: toCents(plan.monthlyPrice),
      currency: plan.currency,
      status: 'pending',
      transactionId: null,
      expiresAt: new Date(now.getTime() + this.settings.ttlMinutes * 60_000),
      createdAt: now,
      updatedAt: now,
    };
    await this.payments.create(payment);
    return {
      payment,
      checkoutUrl: this.gateway.checkoutUrl(payment, { email }),
    };
  }
}

/** Applies a gateway outcome; an approval activates or extends the subscription. */
export class ApplyPaymentOutcome {
  constructor(
    private readonly payments: PaymentRepository,
    private readonly subscriptions: SubscriptionRepository,
    private readonly clock: Clock,
    private readonly settings: PaymentSettings,
  ) {}

  /** Null when the reference is not ours (the gateway may send other events). */
  async execute(outcome: PaymentOutcome): Promise<Payment | null> {
    const payment = await this.payments.findByReference(outcome.reference);
    if (!payment) return null;
    const now = this.clock.now();
    const settled = settle(payment, outcome, now);
    if (settled === payment) return payment;

    if (settled.status === 'approved') {
      const current = await this.subscriptions.findByUser(payment.userId);
      await this.subscriptions.save(
        extendSubscription(current, settled, this.settings.periodDays, now),
      );
    }
    await this.payments.save(settled);
    return settled;
  }
}

/**
 * Confirms a payment by asking the gateway about the transaction id the checkout returned
 * (useful when the webhook is late, or can't reach the API, like in local development).
 */
export class VerifyPayment {
  constructor(
    private readonly payments: PaymentRepository,
    private readonly gateway: PaymentGateway | null,
    private readonly apply: ApplyPaymentOutcome,
  ) {}

  async execute(actor: Principal, transactionId: string): Promise<Payment> {
    if (!this.gateway) throw unavailable();
    const outcome = await this.gateway.fetchOutcome(transactionId);
    const payment =
      outcome && (await this.payments.findByReference(outcome.reference));
    if (!outcome || !payment)
      throw new NotFoundError('Payment not found', 'PAYMENT_NOT_FOUND');
    if (payment.userId !== actor.userId) {
      throw new ForbiddenError('That payment is not yours', 'FORBIDDEN');
    }
    return (await this.apply.execute(outcome)) ?? payment;
  }
}

/** The person's payments, with abandoned checkouts shown as expired. */
export class ListMyPayments {
  constructor(
    private readonly payments: PaymentRepository,
    private readonly clock: Clock,
  ) {}

  async execute(actor: Principal): Promise<PaymentView[]> {
    const now = this.clock.now();
    return (await this.payments.listByUser(actor.userId)).map((p) =>
      viewOf(p, now),
    );
  }
}
