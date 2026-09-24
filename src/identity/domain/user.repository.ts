import { Role } from './role.js';
import { User } from './user.js';

export interface UserRepository {
  findById(id: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  create(user: User): Promise<void>;
  updateRole(id: string, role: Role): Promise<void>;
  list(page: { limit: number; offset: number }): Promise<User[]>;
  updatePassword(id: string, passwordHash: string): Promise<void>;
  updateName(id: string, name: string): Promise<void>;
  /** Deletes the account and, in cascade, everything that belongs to it. */
  delete(id: string): Promise<void>;
}
