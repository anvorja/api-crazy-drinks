/** A single-use, short-lived password reset. Only a hash of the emailed token is stored. */
export interface PasswordReset {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  usedAt: Date | null;
}

export const isUsable = (reset: PasswordReset, now: Date): boolean =>
  reset.usedAt === null && reset.expiresAt > now;

export interface PasswordResetRepository {
  create(reset: PasswordReset): Promise<void>;
  findByHash(tokenHash: string): Promise<PasswordReset | null>;
  /** Marks it used only if still unused; false when it was already used. */
  markUsed(id: string, at: Date): Promise<boolean>;
  /** A new request invalidates the previous links. */
  invalidateForUser(userId: string, at: Date): Promise<void>;
}
