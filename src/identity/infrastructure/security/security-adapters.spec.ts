import { JoseAccessTokenIssuer } from './jose-access-token.issuer.js';
import { ScryptPasswordHasher } from './scrypt-password.hasher.js';

describe('ScryptPasswordHasher', () => {
  const hasher = new ScryptPasswordHasher();

  it('verifies the right password only, with a random salt', async () => {
    const hash = await hasher.hash('letters-and-123');
    expect(await hasher.verify('letters-and-123', hash)).toBe(true);
    expect(await hasher.verify('letters-and-124', hash)).toBe(false);
    expect(await hasher.hash('letters-and-123')).not.toBe(hash);
  });

  it('rejects malformed hashes', async () => {
    expect(await hasher.verify('x', 'md5$abc')).toBe(false);
  });
});

describe('JoseAccessTokenIssuer', () => {
  const settings = {
    secret: 'x'.repeat(32),
    issuer: 'api-drinks',
    ttlSeconds: 60,
  };
  const principal = {
    userId: 'u1',
    role: 'admin' as const,
    adult: true,
    via: 'token' as const,
  };

  it('round-trips the principal', async () => {
    const issuer = new JoseAccessTokenIssuer(settings);
    const { token } = await issuer.issue(principal);
    expect(await issuer.verify(token)).toEqual(principal);
  });

  it('rejects tokens signed with another secret', async () => {
    const { token } = await new JoseAccessTokenIssuer(settings).issue(
      principal,
    );
    const other = new JoseAccessTokenIssuer({
      ...settings,
      secret: 'y'.repeat(32),
    });
    expect(await other.verify(token)).toBeNull();
  });
});
