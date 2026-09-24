/** Credential for third-party integrations. Only a hash of the secret is stored. */
export interface ApiKey {
  id: string;
  userId: string;
  name: string;
  /** First characters of the secret, to recognise it in listings. */
  prefix: string;
  keyHash: string;
  createdAt: Date;
  revokedAt: Date | null;
  lastUsedAt: Date | null;
}

export const isActive = (key: ApiKey): boolean => key.revokedAt === null;

export const utcDay = (date: Date): string => date.toISOString().slice(0, 10);

export function secondsUntilNextUtcDay(now: Date): number {
  const next = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() + 1,
  );
  return Math.ceil((next - now.getTime()) / 1000);
}

export interface ApiKeyRepository {
  create(key: ApiKey): Promise<void>;
  findById(id: string): Promise<ApiKey | null>;
  findByHash(keyHash: string): Promise<ApiKey | null>;
  listByUser(userId: string): Promise<ApiKey[]>;
  revoke(id: string, at: Date): Promise<void>;
  touch(id: string, at: Date): Promise<void>;
}

/** Requests per user and UTC day, across all their keys. */
export interface ApiUsageRepository {
  /** Adds one request and returns the new total for that day. */
  increment(userId: string, day: string): Promise<number>;
  get(userId: string, day: string): Promise<number>;
}
