/**
 * Compile-time checks of the generated client types (openapi/api.d.ts), used the way a
 * frontend would. `pnpm typecheck` fails if the contract stops exposing these shapes.
 */
import type { components, paths } from '../openapi/api.js';

type Json<T> = T extends { content: { 'application/json': infer B } }
  ? B
  : never;

type Drink = Json<paths['/v1/drinks/{id}']['get']['responses'][200]>;
type Session = Json<paths['/v1/auth/login']['post']['responses'][200]>;
type LoginBody = NonNullable<
  paths['/v1/auth/login']['post']['requestBody']
>['content']['application/json'];
type ErrorCode = components['schemas']['ErrorResponse']['code'];

export const drink: Pick<Drink, 'id' | 'name' | 'alcoholic'> = {
  id: '11007',
  name: 'Margarita',
  alcoholic: true,
};
export const session: Pick<Session, 'refreshTokenIn' | 'refreshToken'> = {
  refreshTokenIn: 'cookie',
  refreshToken: null,
};
export const login: LoginBody = { email: 'ana@example.com', password: 'x' };
export const codes: ErrorCode[] = [
  'AGE_RESTRICTED',
  'VALIDATION_FAILED',
  'PLAN_LIMIT',
];
