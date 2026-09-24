import { ValidationError } from '../../shared/domain/errors.js';
import { Role } from './role.js';

/** Legal drinking age in Colombia. */
export const LEGAL_DRINKING_AGE = 18;

export interface User {
  id: string;
  email: string;
  name: string;
  passwordHash: string;
  role: Role;
  /** Declared at sign-up; calendar date in UTC. */
  birthDate: Date;
  createdAt: Date;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeEmail(email: string): string {
  const normalized = email.trim().toLowerCase();
  if (!EMAIL.test(normalized))
    throw new ValidationError('Invalid email address', 'INVALID_EMAIL');
  return normalized;
}

export function assertPasswordPolicy(password: string): void {
  if (
    password.length < 10 ||
    !/[a-zA-Z]/.test(password) ||
    !/\d/.test(password)
  ) {
    throw new ValidationError(
      'Password needs at least 10 characters, letters and numbers',
      'WEAK_PASSWORD',
    );
  }
}

export function ageOn(birthDate: Date, today: Date): number {
  let age = today.getUTCFullYear() - birthDate.getUTCFullYear();
  const birthdayPassed =
    today.getUTCMonth() > birthDate.getUTCMonth() ||
    (today.getUTCMonth() === birthDate.getUTCMonth() &&
      today.getUTCDate() >= birthDate.getUTCDate());
  if (!birthdayPassed) age--;
  return age;
}

export function assertValidBirthDate(birthDate: Date, today: Date): void {
  const age = ageOn(birthDate, today);
  if (Number.isNaN(age) || age < 0 || age > 120) {
    throw new ValidationError('Invalid birth date', 'INVALID_BIRTH_DATE');
  }
}

export const isAdult = (user: Pick<User, 'birthDate'>, today: Date): boolean =>
  ageOn(user.birthDate, today) >= LEGAL_DRINKING_AGE;
