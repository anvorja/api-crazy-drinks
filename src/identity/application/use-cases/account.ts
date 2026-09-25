import { Clock, IdGenerator } from '../../../shared/application/ports.js';
import {
  ForbiddenError,
  NotFoundError,
  RateLimitedError,
  UnauthorizedError,
} from '../../../shared/domain/errors.js';
import {
  LoginFailureRepository,
  ThrottleRule,
  lockRemainingMs,
} from '../../domain/login-throttle.js';
import {
  PasswordResetRepository,
  isUsable,
} from '../../domain/password-reset.js';
import { Principal } from '../../domain/principal.js';
import { RefreshTokenRepository } from '../../domain/refresh-token.js';
import {
  User,
  assertPasswordPolicy,
  cleanName,
  normalizeEmail,
} from '../../domain/user.js';
import { UserRepository } from '../../domain/user.repository.js';
import { AccountNotifier } from '../ports/account-notifier.port.js';
import { OpaqueTokens, PasswordHasher } from '../ports/security.ports.js';

const INVALID_RESET = 'This reset link is invalid, expired or already used';

export interface PasswordResetSettings {
  ttlMinutes: number;
  /** Requests allowed per email and per IP in the window (every request counts). */
  throttle: { perAccount: ThrottleRule; perIp: ThrottleRule };
}

/**
 * Always answers the same, whether the email exists or not (no account enumeration).
 * When it exists, emails a single-use link and invalidates the previous ones.
 */
export class RequestPasswordReset {
  constructor(
    private readonly users: UserRepository,
    private readonly resets: PasswordResetRepository,
    private readonly requests: LoginFailureRepository,
    private readonly opaque: OpaqueTokens,
    private readonly ids: IdGenerator,
    private readonly notifier: AccountNotifier,
    private readonly clock: Clock,
    private readonly settings: PasswordResetSettings,
  ) {}

  async execute(input: { email: string; ip: string }): Promise<void> {
    const now = this.clock.now();
    const email = normalizeEmail(input.email);
    const checks: [string, ThrottleRule][] = [
      [`reset:${email}`, this.settings.throttle.perAccount],
      [`reset-ip:${input.ip}`, this.settings.throttle.perIp],
    ];
    for (const [key, rule] of checks) {
      const since = new Date(now.getTime() - rule.windowMs);
      const lockMs = lockRemainingMs(
        await this.requests.since(key, since),
        rule,
        now,
      );
      if (lockMs > 0) {
        throw new RateLimitedError(
          'Too many reset requests. Try again later.',
          Math.ceil(lockMs / 1000),
        );
      }
    }
    for (const [key, rule] of checks) {
      await this.requests.record(
        key,
        now,
        new Date(now.getTime() - rule.windowMs),
      );
    }

    const user = await this.users.findByEmail(email);
    if (!user) return;

    await this.resets.invalidateForUser(user.id, now);
    const token = this.opaque.generate();
    await this.resets.create({
      id: this.ids.next(),
      userId: user.id,
      tokenHash: this.opaque.hash(token),
      expiresAt: new Date(now.getTime() + this.settings.ttlMinutes * 60_000),
      usedAt: null,
    });
    await this.notifier.passwordResetRequested(
      user,
      token,
      this.settings.ttlMinutes,
    );
  }
}

/** Sets a new password with an emailed token and closes every session. */
export class ResetPassword {
  constructor(
    private readonly users: UserRepository,
    private readonly resets: PasswordResetRepository,
    private readonly refreshTokens: RefreshTokenRepository,
    private readonly loginFailures: LoginFailureRepository,
    private readonly hasher: PasswordHasher,
    private readonly opaque: OpaqueTokens,
    private readonly notifier: AccountNotifier,
    private readonly clock: Clock,
  ) {}

  async execute(input: { token: string; newPassword: string }): Promise<void> {
    const now = this.clock.now();
    assertPasswordPolicy(input.newPassword);
    const reset = await this.resets.findByHash(this.opaque.hash(input.token));
    if (!reset || !isUsable(reset, now))
      throw new UnauthorizedError(INVALID_RESET, 'INVALID_RESET_TOKEN');
    // Atomic: two concurrent uses of the same link, only one wins.
    if (!(await this.resets.markUsed(reset.id, now))) {
      throw new UnauthorizedError(INVALID_RESET, 'INVALID_RESET_TOKEN');
    }
    const user = await this.users.findById(reset.userId);
    if (!user)
      throw new UnauthorizedError(INVALID_RESET, 'INVALID_RESET_TOKEN');

    await this.users.updatePassword(
      user.id,
      await this.hasher.hash(input.newPassword),
    );
    await this.refreshTokens.revokeAllForUser(user.id, now);
    await this.loginFailures.clear(`account:${user.email}`);
    await this.notifier.passwordChanged(user);
  }
}

/** Needs the current password; closes every session (log in again afterwards). */
export class ChangePassword {
  constructor(
    private readonly users: UserRepository,
    private readonly refreshTokens: RefreshTokenRepository,
    private readonly hasher: PasswordHasher,
    private readonly notifier: AccountNotifier,
    private readonly clock: Clock,
  ) {}

  async execute(
    actor: Principal,
    input: { currentPassword: string; newPassword: string },
  ): Promise<void> {
    const user = await this.requireUser(actor);
    if (!(await this.hasher.verify(input.currentPassword, user.passwordHash))) {
      throw new UnauthorizedError(
        'The current password is not correct',
        'WRONG_PASSWORD',
      );
    }
    assertPasswordPolicy(input.newPassword);
    await this.users.updatePassword(
      user.id,
      await this.hasher.hash(input.newPassword),
    );
    await this.refreshTokens.revokeAllForUser(user.id, this.clock.now());
    await this.notifier.passwordChanged(user);
  }

  private async requireUser(actor: Principal): Promise<User> {
    const user = await this.users.findById(actor.userId);
    if (!user) throw new NotFoundError('User not found', 'USER_NOT_FOUND');
    return user;
  }
}

export class UpdateProfile {
  constructor(private readonly users: UserRepository) {}

  async execute(actor: Principal, input: { name: string }): Promise<User> {
    const user = await this.users.findById(actor.userId);
    if (!user) throw new NotFoundError('User not found', 'USER_NOT_FOUND');
    const name = cleanName(input.name);
    await this.users.updateName(user.id, name);
    return { ...user, name };
  }
}

/**
 * Deletes the account and everything it owns (favorites, swipes, venues, API keys,
 * subscription…). Needs the password. Admins must be demoted first.
 */
export class DeleteAccount {
  constructor(
    private readonly users: UserRepository,
    private readonly hasher: PasswordHasher,
  ) {}

  async execute(actor: Principal, password: string): Promise<void> {
    const user = await this.users.findById(actor.userId);
    if (!user) throw new NotFoundError('User not found', 'USER_NOT_FOUND');
    if (user.role === 'admin') {
      throw new ForbiddenError(
        'Admins cannot delete their own account',
        'ADMIN_SELF_DELETION',
      );
    }
    if (!(await this.hasher.verify(password, user.passwordHash))) {
      throw new UnauthorizedError(
        'The password is not correct',
        'WRONG_PASSWORD',
      );
    }
    await this.users.delete(user.id);
  }
}
