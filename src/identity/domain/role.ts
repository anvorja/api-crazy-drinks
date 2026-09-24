export const ROLES = [
  'user',
  'premium',
  'bartender',
  'venue_owner',
  'admin',
] as const;
export type Role = (typeof ROLES)[number];

export const isRole = (value: string): value is Role =>
  (ROLES as readonly string[]).includes(value);
