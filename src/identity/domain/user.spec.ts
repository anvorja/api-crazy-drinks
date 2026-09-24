import {
  ageOn,
  assertPasswordPolicy,
  cleanName,
  isAdult,
  normalizeEmail,
} from './user.js';

const d = (iso: string) => new Date(`${iso}T00:00:00Z`);

describe('user rules', () => {
  it('computes age around birthdays', () => {
    expect(ageOn(d('2008-09-24'), d('2026-09-23'))).toBe(17);
    expect(ageOn(d('2008-09-24'), d('2026-09-24'))).toBe(18);
  });

  it('considers 18+ adults', () => {
    expect(isAdult({ birthDate: d('2008-09-24') }, d('2026-09-24'))).toBe(true);
    expect(isAdult({ birthDate: d('2008-09-25') }, d('2026-09-24'))).toBe(
      false,
    );
  });

  it('normalizes and validates emails', () => {
    expect(normalizeEmail('  Ana@Example.COM ')).toBe('ana@example.com');
    expect(() => normalizeEmail('nope')).toThrow('Invalid email');
  });

  it('enforces the password policy', () => {
    expect(() => assertPasswordPolicy('short1')).toThrow();
    expect(() => assertPasswordPolicy('onlyletters')).toThrow();
    expect(() => assertPasswordPolicy('letters-and-123')).not.toThrow();
  });

  it('cleans names', () => {
    expect(cleanName('  Ana   María ')).toBe('Ana María');
    expect(() => cleanName('   ')).toThrow('name');
  });
});
