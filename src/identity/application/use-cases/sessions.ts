import {
  RateLimitedError,
  UnauthorizedError,
} from '../../../shared/domain/errors.js';
import {
  LoginFailureRepository,
  ThrottleRule,
  lockRemainingMs,
} from '../../domain/login-throttle.js';
import { principalOf } from '../../domain/principal.js';
import { RefreshTokenRepository } from '../../domain/refresh-token.js';
import { User, normalizeEmail } from '../../domain/user.js';
import { UserRepository } from '../../domain/user.repository.js';
import { Clock, IdGenerator } from '../../../shared/application/ports.js';
import {
  AccessTokenIssuer,
  OpaqueTokens,
  PasswordHasher,
} from '../ports/security.ports.js';

export interface Session {
  user: User;
  accessToken: string;
  expiresInSeconds: number;
  refreshToken: string;
}

export interface SessionSettings {
  refreshTokenTtlMs: number;
}

const INVALID_CREDENTIALS = 'Invalid email or password';
const INVALID_REFRESH = 'Invalid or expired refresh token';

/** Issues access + refresh tokens. Shared by login and refresh. */
export class SessionIssuer {
  constructor(
    private readonly tokens: RefreshTokenRepository,
    private readonly accessTokens: AccessTokenIssuer,
    private readonly opaque: OpaqueTokens,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
    private readonly settings: SessionSettings,
  ) {}

  async issue(user: User, familyId = this.ids.next()): Promise<Session> {
    const now = this.clock.now();
    const refreshToken = this.opaque.generate();
    await this.tokens.create({
      id: this.ids.next(),
      userId: user.id,
      familyId,
      tokenHash: this.opaque.hash(refreshToken),
      expiresAt: new Date(now.getTime() + this.settings.refreshTokenTtlMs),
      revokedAt: null,
    });
    const access = await this.accessTokens.issue(principalOf(user, now));
    return {
      user,
      accessToken: access.token,
      expiresInSeconds: access.expiresInSeconds,
      refreshToken,
    };
  }
}

export interface LoginThrottleSettings {
  perAccount: ThrottleRule;
  perIp: ThrottleRule;
}

export class Login {
  constructor(
    private readonly users: UserRepository,
    private readonly hasher: PasswordHasher,
    private readonly sessions: SessionIssuer,
    private readonly failures: LoginFailureRepository,
    private readonly clock: Clock,
    private readonly throttle: LoginThrottleSettings,
  ) {}

  async execute(input: {
    email: string;
    password: string;
    ip: string;
  }): Promise<Session> {
    const now = this.clock.now();
    const email = normalizeEmail(input.email);
    const checks: [string, ThrottleRule][] = [
      [`account:${email}`, this.throttle.perAccount],
      [`ip:${input.ip}`, this.throttle.perIp],
    ];

    for (const [key, rule] of checks) {
      const since = new Date(now.getTime() - rule.windowMs);
      const lockMs = lockRemainingMs(
        await this.failures.since(key, since),
        rule,
        now,
      );
      if (lockMs > 0) {
        throw new RateLimitedError(
          'Too many failed login attempts. Try again later.',
          Math.ceil(lockMs / 1000),
          'LOGIN_LOCKED',
        );
      }
    }

    const user = await this.users.findByEmail(email);
    // Hash anyway when the account doesn't exist, so response times don't reveal it.
    const valid = user
      ? await this.hasher.verify(input.password, user.passwordHash)
      : (await this.hasher.hash(input.password), false);

    if (!user || !valid) {
      for (const [key, rule] of checks) {
        await this.failures.record(
          key,
          now,
          new Date(now.getTime() - rule.windowMs),
        );
      }
      // Same error whether the email exists or not, to avoid account enumeration.
      throw new UnauthorizedError(INVALID_CREDENTIALS, 'INVALID_CREDENTIALS');
    }
    await this.failures.clear(`account:${email}`);
    return this.sessions.issue(user);
  }
}

export class RefreshSession {
  constructor(
    private readonly users: UserRepository,
    private readonly tokens: RefreshTokenRepository,
    private readonly opaque: OpaqueTokens,
    private readonly sessions: SessionIssuer,
    private readonly clock: Clock,
  ) {}

  async execute(refreshToken: string): Promise<Session> {
    const now = this.clock.now();
    const stored = await this.tokens.findByHash(this.opaque.hash(refreshToken));
    if (!stored)
      throw new UnauthorizedError(INVALID_REFRESH, 'INVALID_REFRESH_TOKEN');

    if (stored.expiresAt <= now)
      throw new UnauthorizedError(INVALID_REFRESH, 'INVALID_REFRESH_TOKEN');

    // Atomic: of two concurrent refreshes with the same token only one wins.
    if (stored.revokedAt || !(await this.tokens.revoke(stored.id, now))) {
      // A rotated token came back: it was stolen or leaked. Kill the whole family.
      await this.tokens.revokeFamily(stored.familyId, now);
      throw new UnauthorizedError(INVALID_REFRESH, 'INVALID_REFRESH_TOKEN');
    }

    const user = await this.users.findById(stored.userId);
    if (!user)
      throw new UnauthorizedError(INVALID_REFRESH, 'INVALID_REFRESH_TOKEN');

    // Reloading the user means role changes apply on the next refresh.
    return this.sessions.issue(user, stored.familyId);
  }
}

export class Logout {
  constructor(
    private readonly tokens: RefreshTokenRepository,
    private readonly opaque: OpaqueTokens,
    private readonly clock: Clock,
  ) {}

  /** Idempotent: unknown tokens are ignored. */
  async execute(refreshToken: string): Promise<void> {
    const stored = await this.tokens.findByHash(this.opaque.hash(refreshToken));
    if (stored)
      await this.tokens.revokeFamily(stored.familyId, this.clock.now());
  }
}
