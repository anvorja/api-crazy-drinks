/**
 * A refresh token as stored: only its hash. Tokens rotate on every use; all the tokens
 * descending from one login share a `familyId`, so reusing an old one revokes the family.
 */
export interface RefreshToken {
  id: string;
  userId: string;
  familyId: string;
  tokenHash: string;
  expiresAt: Date;
  revokedAt: Date | null;
}

export interface RefreshTokenRepository {
  create(token: RefreshToken): Promise<void>;
  findByHash(tokenHash: string): Promise<RefreshToken | null>;
  /** Revokes only if still active; returns false when it was already revoked. */
  revoke(id: string, at: Date): Promise<boolean>;
  revokeFamily(familyId: string, at: Date): Promise<void>;
}
