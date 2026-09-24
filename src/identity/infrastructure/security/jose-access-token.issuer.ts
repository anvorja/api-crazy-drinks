import { SignJWT, jwtVerify } from 'jose';
import {
  AccessToken,
  AccessTokenIssuer,
} from '../../application/ports/security.ports.js';
import { Principal } from '../../domain/principal.js';
import { isRole } from '../../domain/role.js';

export interface JwtSettings {
  secret: string;
  issuer: string;
  ttlSeconds: number;
}

/** HS256 JWT access tokens. Claims: sub (user id), role, adult. */
export class JoseAccessTokenIssuer implements AccessTokenIssuer {
  private readonly key: Uint8Array;

  constructor(private readonly settings: JwtSettings) {
    this.key = new TextEncoder().encode(settings.secret);
  }

  async issue(principal: Principal): Promise<AccessToken> {
    const token = await new SignJWT({
      role: principal.role,
      adult: principal.adult,
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(principal.userId)
      .setIssuer(this.settings.issuer)
      .setIssuedAt()
      .setExpirationTime(`${this.settings.ttlSeconds}s`)
      .sign(this.key);
    return { token, expiresInSeconds: this.settings.ttlSeconds };
  }

  async verify(token: string): Promise<Principal | null> {
    try {
      const { payload } = await jwtVerify(token, this.key, {
        issuer: this.settings.issuer,
        algorithms: ['HS256'],
      });
      const { sub, role, adult } = payload;
      if (
        !sub ||
        typeof role !== 'string' ||
        !isRole(role) ||
        typeof adult !== 'boolean'
      ) {
        return null;
      }
      return { userId: sub, role, adult, via: 'token' };
    } catch {
      return null;
    }
  }
}
