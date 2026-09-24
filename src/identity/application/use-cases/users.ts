import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from '../../../shared/domain/errors.js';
import { Principal, requireRole } from '../../domain/principal.js';
import { Role } from '../../domain/role.js';
import {
  User,
  assertPasswordPolicy,
  assertValidBirthDate,
  normalizeEmail,
} from '../../domain/user.js';
import { UserRepository } from '../../domain/user.repository.js';
import { Clock, IdGenerator } from '../../../shared/application/ports.js';
import { PasswordHasher } from '../ports/security.ports.js';

export interface RegisterUserInput {
  email: string;
  password: string;
  name: string;
  birthDate: Date;
}

export class RegisterUser {
  constructor(
    private readonly users: UserRepository,
    private readonly hasher: PasswordHasher,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
  ) {}

  async execute(input: RegisterUserInput, role: Role = 'user'): Promise<User> {
    const now = this.clock.now();
    const email = normalizeEmail(input.email);
    assertPasswordPolicy(input.password);
    assertValidBirthDate(input.birthDate, now);

    if (await this.users.findByEmail(email)) {
      throw new ConflictError('An account with that email already exists');
    }
    const user: User = {
      id: this.ids.next(),
      email,
      name: input.name.trim(),
      passwordHash: await this.hasher.hash(input.password),
      role,
      birthDate: input.birthDate,
      createdAt: now,
    };
    await this.users.create(user);
    return user;
  }
}

export class GetProfile {
  constructor(private readonly users: UserRepository) {}

  async execute(principal: Principal): Promise<User> {
    const user = await this.users.findById(principal.userId);
    if (!user) throw new NotFoundError('User not found');
    return user;
  }
}

export class ListUsers {
  constructor(private readonly users: UserRepository) {}

  async execute(
    actor: Principal | null,
    page: { limit: number; offset: number },
  ) {
    requireRole(actor, 'admin');
    return this.users.list(page);
  }
}

export class ChangeUserRole {
  constructor(private readonly users: UserRepository) {}

  async execute(
    actor: Principal | null,
    userId: string,
    role: Role,
  ): Promise<User> {
    const admin = requireRole(actor, 'admin');
    if (admin.userId === userId && role !== 'admin') {
      throw new ForbiddenError('Admins cannot remove their own admin role');
    }
    const user = await this.users.findById(userId);
    if (!user) throw new NotFoundError(`User ${userId} not found`);
    await this.users.updateRole(userId, role);
    return { ...user, role };
  }
}

/** Creates (or promotes) the operator's admin account from configuration. */
export class EnsureAdmin {
  constructor(
    private readonly users: UserRepository,
    private readonly register: RegisterUser,
  ) {}

  async execute(input: RegisterUserInput): Promise<void> {
    const existing = await this.users.findByEmail(normalizeEmail(input.email));
    if (!existing) {
      await this.register.execute(input, 'admin');
    } else if (existing.role !== 'admin') {
      await this.users.updateRole(existing.id, 'admin');
    }
  }
}
