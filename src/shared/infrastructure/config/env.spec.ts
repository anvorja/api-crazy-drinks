import { TEST_ENV } from '../../../../test/support/test-env.js';
import { parseEnv } from './env.js';

describe('parseEnv', () => {
  it('lists every missing variable', () => {
    expect(() => parseEnv({})).toThrow(/PORT[\s\S]*CATALOG_SOURCE/);
  });

  it('treats empty optional variables as not set', () => {
    const complete = {
      ...TEST_ENV,
      ADMIN_EMAIL: '',
      ADMIN_PASSWORD: '',
      ADMIN_NAME: '',
      ADMIN_BIRTH_DATE: '',
    };
    expect(parseEnv(complete).ADMIN_EMAIL).toBeUndefined();
  });

  it('requires all admin variables or none', () => {
    expect(() => parseEnv({ ...TEST_ENV, ADMIN_NAME: '' })).toThrow(
      'ADMIN_EMAIL',
    );
  });

  it('parses the CORS origins and rejects paths or trailing slashes', () => {
    expect(
      parseEnv({ ...TEST_ENV, CORS_ORIGINS: 'https://a.com, https://b.com' })
        .CORS_ORIGINS,
    ).toEqual(['https://a.com', 'https://b.com']);
    expect(() =>
      parseEnv({ ...TEST_ENV, CORS_ORIGINS: 'https://a.com/' }),
    ).toThrow('CORS_ORIGINS');
  });

  it('SameSite=none needs a secure cookie', () => {
    expect(() =>
      parseEnv({
        ...TEST_ENV,
        REFRESH_COOKIE_SAMESITE: 'none',
        REFRESH_COOKIE_SECURE: 'false',
      }),
    ).toThrow('REFRESH_COOKIE_SECURE');
  });

  it('rejects a Wompi redirect on localhost, which Wompi blocks', () => {
    const wompi = {
      ...TEST_ENV,
      PAYMENTS_PROVIDER: 'wompi',
      WOMPI_PUBLIC_KEY: 'pub_test_x',
      WOMPI_PRIVATE_KEY: 'prv_test_x',
      WOMPI_INTEGRITY_SECRET: 'test_integrity_x',
      WOMPI_EVENTS_SECRET: 'test_events_x',
      WOMPI_API_URL: 'https://sandbox.wompi.co/v1',
      WOMPI_CHECKOUT_URL: 'https://checkout.wompi.co/p/',
    };
    expect(() =>
      parseEnv({
        ...wompi,
        PAYMENTS_REDIRECT_URL: 'http://localhost:5173/pago/resultado',
      }),
    ).toThrow('lvh.me');
    expect(
      parseEnv({
        ...wompi,
        PAYMENTS_REDIRECT_URL: 'http://lvh.me:5173/pago/resultado',
      }).PAYMENTS_PROVIDER,
    ).toBe('wompi');
  });

  it('Wompi needs the private key, and only a prv_ key', () => {
    const wompi = {
      ...TEST_ENV,
      PAYMENTS_PROVIDER: 'wompi',
      PAYMENTS_REDIRECT_URL: 'http://lvh.me:5173/pago/resultado',
    };
    const withoutKey = Object.fromEntries(
      Object.entries(wompi).filter(([key]) => key !== 'WOMPI_PRIVATE_KEY'),
    );
    expect(() => parseEnv(withoutKey)).toThrow('WOMPI_*');
    expect(() =>
      parseEnv({ ...wompi, WOMPI_PRIVATE_KEY: 'pub_test_x' }),
    ).toThrow('prv_test_');
  });

  it('the snapshot catalog needs no TheCocktailDB settings; cocktaildb needs them', () => {
    const withoutCocktailDb = Object.fromEntries(
      Object.entries(TEST_ENV).filter(
        ([key]) => !key.startsWith('COCKTAILDB_') && key !== 'CATALOG_TTL_MS',
      ),
    );
    expect(
      parseEnv({ ...withoutCocktailDb, CATALOG_SOURCE: 'snapshot' })
        .CATALOG_SOURCE,
    ).toBe('snapshot');
    expect(() =>
      parseEnv({ ...withoutCocktailDb, CATALOG_SOURCE: 'cocktaildb' }),
    ).toThrow('COCKTAILDB_');
  });
});
