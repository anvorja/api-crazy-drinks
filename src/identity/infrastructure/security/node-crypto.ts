import { createHash, randomBytes } from 'node:crypto';
import { OpaqueTokens } from '../../application/ports/security.ports.js';

export class RandomOpaqueTokens implements OpaqueTokens {
  generate(): string {
    return randomBytes(32).toString('base64url');
  }

  /** High-entropy tokens don't need a slow hash; SHA-256 keeps lookups indexable. */
  hash(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}
