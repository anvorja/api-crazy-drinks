import {
  PasswordReset,
  PasswordResetRepository,
} from '../../../domain/password-reset.js';
import {
  ApiKey,
  ApiKeyRepository,
  ApiUsageRepository,
} from '../../../domain/api-key.js';
import { LoginFailureRepository } from '../../../domain/login-throttle.js';
import {
  RefreshToken,
  RefreshTokenRepository,
} from '../../../domain/refresh-token.js';
import { Role } from '../../../domain/role.js';
import { User } from '../../../domain/user.js';
import { UserRepository } from '../../../domain/user.repository.js';

export class InMemoryUserRepository implements UserRepository {
  private readonly users = new Map<string, User>();

  async findById(id: string): Promise<User | null> {
    return this.users.get(id) ?? null;
  }

  async findByEmail(email: string): Promise<User | null> {
    return [...this.users.values()].find((u) => u.email === email) ?? null;
  }

  async create(user: User): Promise<void> {
    this.users.set(user.id, { ...user });
  }

  async updateRole(id: string, role: Role): Promise<void> {
    const user = this.users.get(id);
    if (user) this.users.set(id, { ...user, role });
  }

  async list({
    limit,
    offset,
  }: {
    limit: number;
    offset: number;
  }): Promise<User[]> {
    return [...this.users.values()].slice(offset, offset + limit);
  }

  async updatePassword(id: string, passwordHash: string): Promise<void> {
    const user = this.users.get(id);
    if (user) this.users.set(id, { ...user, passwordHash });
  }

  async updateName(id: string, name: string): Promise<void> {
    const user = this.users.get(id);
    if (user) this.users.set(id, { ...user, name });
  }

  async delete(id: string): Promise<void> {
    this.users.delete(id);
  }
}

export class InMemoryRefreshTokenRepository implements RefreshTokenRepository {
  private readonly tokens = new Map<string, RefreshToken>();

  async create(token: RefreshToken): Promise<void> {
    this.tokens.set(token.id, { ...token });
  }

  async findByHash(tokenHash: string): Promise<RefreshToken | null> {
    return (
      [...this.tokens.values()].find((t) => t.tokenHash === tokenHash) ?? null
    );
  }

  async revoke(id: string, at: Date): Promise<boolean> {
    const token = this.tokens.get(id);
    if (!token || token.revokedAt) return false;
    token.revokedAt = at;
    return true;
  }

  async revokeFamily(familyId: string, at: Date): Promise<void> {
    for (const token of this.tokens.values()) {
      if (token.familyId === familyId && !token.revokedAt) token.revokedAt = at;
    }
  }

  async revokeAllForUser(userId: string, at: Date): Promise<void> {
    for (const token of this.tokens.values()) {
      if (token.userId === userId && !token.revokedAt) token.revokedAt = at;
    }
  }
}

export class InMemoryLoginFailureRepository implements LoginFailureRepository {
  private readonly failures = new Map<string, Date[]>();

  async since(key: string, since: Date): Promise<Date[]> {
    return (this.failures.get(key) ?? []).filter((d) => d >= since);
  }

  async record(key: string, at: Date, forgetBefore: Date): Promise<void> {
    const kept = (this.failures.get(key) ?? []).filter(
      (d) => d >= forgetBefore,
    );
    this.failures.set(key, [...kept, at]);
  }

  async clear(key: string): Promise<void> {
    this.failures.delete(key);
  }
}

export class InMemoryApiKeyRepository implements ApiKeyRepository {
  private readonly keys = new Map<string, ApiKey>();

  async create(key: ApiKey): Promise<void> {
    this.keys.set(key.id, { ...key });
  }

  async findById(id: string): Promise<ApiKey | null> {
    return this.keys.get(id) ?? null;
  }

  async findByHash(keyHash: string): Promise<ApiKey | null> {
    return [...this.keys.values()].find((k) => k.keyHash === keyHash) ?? null;
  }

  async listByUser(userId: string): Promise<ApiKey[]> {
    return [...this.keys.values()].filter((k) => k.userId === userId);
  }

  async revoke(id: string, at: Date): Promise<void> {
    const key = this.keys.get(id);
    if (key) key.revokedAt = at;
  }

  async touch(id: string, at: Date): Promise<void> {
    const key = this.keys.get(id);
    if (key) key.lastUsedAt = at;
  }
}

export class InMemoryApiUsageRepository implements ApiUsageRepository {
  private readonly counts = new Map<string, number>();

  async increment(userId: string, day: string): Promise<number> {
    const next = (this.counts.get(`${userId}:${day}`) ?? 0) + 1;
    this.counts.set(`${userId}:${day}`, next);
    return next;
  }

  async get(userId: string, day: string): Promise<number> {
    return this.counts.get(`${userId}:${day}`) ?? 0;
  }
}

export class InMemoryPasswordResetRepository implements PasswordResetRepository {
  private readonly resets = new Map<string, PasswordReset>();

  async create(reset: PasswordReset): Promise<void> {
    this.resets.set(reset.id, { ...reset });
  }

  async findByHash(tokenHash: string): Promise<PasswordReset | null> {
    return (
      [...this.resets.values()].find((r) => r.tokenHash === tokenHash) ?? null
    );
  }

  async markUsed(id: string, at: Date): Promise<boolean> {
    const reset = this.resets.get(id);
    if (!reset || reset.usedAt) return false;
    reset.usedAt = at;
    return true;
  }

  async invalidateForUser(userId: string, at: Date): Promise<void> {
    for (const reset of this.resets.values()) {
      if (reset.userId === userId && !reset.usedAt) reset.usedAt = at;
    }
  }
}
