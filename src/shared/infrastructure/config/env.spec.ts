import { TEST_ENV } from '../../../../test/support/test-env.js';
import { parseEnv } from './env.js';

describe('parseEnv', () => {
  it('lists every missing variable', () => {
    expect(() => parseEnv({})).toThrow(/PORT[\s\S]*COCKTAILDB_BASE_URL/);
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
});
