import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { PasswordHasher } from '../../application/ports/security.ports.js';

const scryptAsync = promisify(scrypt) as (
  password: string,
  salt: Buffer,
  keylen: number,
  options: { N: number; r: number; p: number; maxmem: number },
) => Promise<Buffer>;

const PARAMS = { N: 2 ** 15, r: 8, p: 1 };
const KEY_LENGTH = 64;

/**
 * scrypt from Node's standard library (no native addons).
 * Stored as `scrypt$N$r$p$salt$hash` so parameters can be raised later.
 */
export class ScryptPasswordHasher implements PasswordHasher {
  async hash(password: string): Promise<string> {
    const salt = randomBytes(16);
    const key = await this.derive(password, salt, PARAMS);
    const { N, r, p } = PARAMS;
    return [
      'scrypt',
      N,
      r,
      p,
      salt.toString('base64'),
      key.toString('base64'),
    ].join('$');
  }

  async verify(password: string, stored: string): Promise<boolean> {
    const [algorithm, N, r, p, salt, hash] = stored.split('$');
    if (algorithm !== 'scrypt' || !hash) return false;
    const expected = Buffer.from(hash, 'base64');
    const actual = await this.derive(password, Buffer.from(salt, 'base64'), {
      N: Number(N),
      r: Number(r),
      p: Number(p),
    });
    return (
      actual.length === expected.length && timingSafeEqual(actual, expected)
    );
  }

  private derive(password: string, salt: Buffer, params: typeof PARAMS) {
    return scryptAsync(password, salt, KEY_LENGTH, {
      ...params,
      maxmem: 256 * params.N * params.r,
    });
  }
}
