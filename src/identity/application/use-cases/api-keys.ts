import { Clock, IdGenerator } from '../../../shared/application/ports.js';
import {
  ForbiddenError,
  NotFoundError,
  PlanLimitError,
  RateLimitedError,
  UnauthorizedError,
} from '../../../shared/domain/errors.js';
import {
  ApiKey,
  ApiKeyRepository,
  ApiUsageRepository,
  isActive,
  secondsUntilNextUtcDay,
  utcDay,
} from '../../domain/api-key.js';
import { Principal, principalOf } from '../../domain/principal.js';
import { UserRepository } from '../../domain/user.repository.js';
import { ApiPlanLimitsPort } from '../ports/plan-limits.port.js';
import { OpaqueTokens } from '../ports/security.ports.js';

const KEY_PREFIX = 'dk_';
const INVALID_KEY = 'Invalid or revoked API key';

export interface Quota {
  limit: number;
  used: number;
  remaining: number;
  resetsInSeconds: number;
}

export class CreateApiKey {
  constructor(
    private readonly keys: ApiKeyRepository,
    private readonly limits: ApiPlanLimitsPort,
    private readonly opaque: OpaqueTokens,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
  ) {}

  /** Returns the secret once; only its hash is stored. */
  async execute(
    actor: Principal,
    name: string,
  ): Promise<{ apiKey: ApiKey; secret: string }> {
    const { apiKeys } = await this.limits.limitsFor(actor);
    const active = (await this.keys.listByUser(actor.userId)).filter(isActive);
    if (active.length >= apiKeys) {
      throw new PlanLimitError(`Your plan allows ${apiKeys} active API key(s)`);
    }
    const secret = `${KEY_PREFIX}${this.opaque.generate()}`;
    const apiKey: ApiKey = {
      id: this.ids.next(),
      userId: actor.userId,
      name: name.trim(),
      prefix: secret.slice(0, KEY_PREFIX.length + 6),
      keyHash: this.opaque.hash(secret),
      createdAt: this.clock.now(),
      revokedAt: null,
      lastUsedAt: null,
    };
    await this.keys.create(apiKey);
    return { apiKey, secret };
  }
}

export class ListMyApiKeys {
  constructor(
    private readonly keys: ApiKeyRepository,
    private readonly usage: ApiUsageRepository,
    private readonly limits: ApiPlanLimitsPort,
    private readonly clock: Clock,
  ) {}

  async execute(actor: Principal): Promise<{ keys: ApiKey[]; quota: Quota }> {
    const now = this.clock.now();
    const [keys, used, limits] = await Promise.all([
      this.keys.listByUser(actor.userId),
      this.usage.get(actor.userId, utcDay(now)),
      this.limits.limitsFor(actor),
    ]);
    return { keys, quota: quotaOf(limits.apiDailyRequests, used, now) };
  }
}

export class RevokeApiKey {
  constructor(
    private readonly keys: ApiKeyRepository,
    private readonly clock: Clock,
  ) {}

  async execute(actor: Principal, keyId: string): Promise<void> {
    const key = await this.keys.findById(keyId);
    if (!key) throw new NotFoundError(`API key ${keyId} not found`);
    if (key.userId !== actor.userId && actor.role !== 'admin') {
      throw new ForbiddenError('This API key is not yours');
    }
    if (isActive(key)) await this.keys.revoke(key.id, this.clock.now());
  }
}

/** Resolves an API key into its owner's principal and charges one request to the daily quota. */
export class AuthenticateApiKey {
  constructor(
    private readonly keys: ApiKeyRepository,
    private readonly usage: ApiUsageRepository,
    private readonly users: UserRepository,
    private readonly limits: ApiPlanLimitsPort,
    private readonly opaque: OpaqueTokens,
    private readonly clock: Clock,
  ) {}

  async execute(
    secret: string,
  ): Promise<{ principal: Principal; quota: Quota }> {
    const now = this.clock.now();
    const key = secret.startsWith(KEY_PREFIX)
      ? await this.keys.findByHash(this.opaque.hash(secret))
      : null;
    if (!key || !isActive(key))
      throw new UnauthorizedError(INVALID_KEY, 'INVALID_API_KEY');
    const user = await this.users.findById(key.userId);
    if (!user) throw new UnauthorizedError(INVALID_KEY, 'INVALID_API_KEY');

    const principal = principalOf(user, now, 'api_key');
    const { apiDailyRequests } = await this.limits.limitsFor(principal);
    const used = await this.usage.increment(user.id, utcDay(now));
    const quota = quotaOf(apiDailyRequests, used, now);
    if (used > apiDailyRequests) {
      throw new RateLimitedError(
        `Daily quota of ${apiDailyRequests} requests reached. Upgrade your plan or wait for the reset.`,
        quota.resetsInSeconds,
        'API_QUOTA_EXCEEDED',
      );
    }
    await this.keys.touch(key.id, now);
    return { principal, quota };
  }
}

function quotaOf(limit: number, used: number, now: Date): Quota {
  return {
    limit,
    used,
    remaining: Math.max(limit - used, 0),
    resetsInSeconds: secondsUntilNextUtcDay(now),
  };
}
