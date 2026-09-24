import { desc, eq } from 'drizzle-orm';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import { Payment, PaymentRepository } from '../../../domain/payment.js';
import { paymentsTable } from './billing.schema.js';

export class DrizzlePaymentRepository implements PaymentRepository {
  constructor(private readonly db: PgDatabase<PgQueryResultHKT>) {}

  async create(payment: Payment): Promise<void> {
    await this.db.insert(paymentsTable).values(payment);
  }

  async findByReference(reference: string): Promise<Payment | null> {
    const [row] = await this.db
      .select()
      .from(paymentsTable)
      .where(eq(paymentsTable.reference, reference));
    return row ?? null;
  }

  async save(payment: Payment): Promise<void> {
    await this.db
      .update(paymentsTable)
      .set({
        status: payment.status,
        transactionId: payment.transactionId,
        updatedAt: payment.updatedAt,
      })
      .where(eq(paymentsTable.id, payment.id));
  }

  async listByUser(userId: string): Promise<Payment[]> {
    return this.db
      .select()
      .from(paymentsTable)
      .where(eq(paymentsTable.userId, userId))
      .orderBy(desc(paymentsTable.createdAt));
  }
}
