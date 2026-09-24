import { Principal } from '../../domain/principal.js';

export interface PasswordHasher {
  hash(password: string): Promise<string>;
  verify(password: string, hash: string): Promise<boolean>;
}

export interface AccessToken {
  token: string;
  expiresInSeconds: number;
}

export interface AccessTokenIssuer {
  issue(principal: Principal): Promise<AccessToken>;
  /** Returns null for invalid or expired tokens. */
  verify(token: string): Promise<Principal | null>;
}

/** Opaque random tokens (refresh tokens) and their one-way hash for storage. */
export interface OpaqueTokens {
  generate(): string;
  hash(token: string): string;
}
