import { asc, eq } from 'drizzle-orm';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import { Role } from '../../../domain/role.js';
import { User } from '../../../domain/user.js';
import { UserRepository } from '../../../domain/user.repository.js';
import { UserRecord, usersTable } from './identity.schema.js';

const toDomain = (r: UserRecord): User => ({ ...r });

export class DrizzleUserRepository implements UserRepository {
  constructor(private readonly db: PgDatabase<PgQueryResultHKT>) {}

  async findById(id: string): Promise<User | null> {
    const [record] = await this.db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, id));
    return record ? toDomain(record) : null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const [record] = await this.db
      .select()
      .from(usersTable)
      .where(eq(usersTable.email, email));
    return record ? toDomain(record) : null;
  }

  async create(user: User): Promise<void> {
    await this.db.insert(usersTable).values(user);
  }

  async updateRole(id: string, role: Role): Promise<void> {
    await this.db.update(usersTable).set({ role }).where(eq(usersTable.id, id));
  }

  async list({
    limit,
    offset,
  }: {
    limit: number;
    offset: number;
  }): Promise<User[]> {
    const records = await this.db
      .select()
      .from(usersTable)
      .orderBy(asc(usersTable.createdAt))
      .limit(limit)
      .offset(offset);
    return records.map(toDomain);
  }

  async updatePassword(id: string, passwordHash: string): Promise<void> {
    await this.db
      .update(usersTable)
      .set({ passwordHash })
      .where(eq(usersTable.id, id));
  }

  async updateName(id: string, name: string): Promise<void> {
    await this.db.update(usersTable).set({ name }).where(eq(usersTable.id, id));
  }

  /** Foreign keys cascade: sessions, favorites, swipes, venues, keys, subscription… */
  async delete(id: string): Promise<void> {
    await this.db.delete(usersTable).where(eq(usersTable.id, id));
  }
}
