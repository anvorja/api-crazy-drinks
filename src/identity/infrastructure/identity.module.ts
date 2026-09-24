import { Inject, Logger, Module, OnApplicationBootstrap } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { GetPlanLimits } from '../../billing/application/use-cases/billing.js';
import type { Clock, IdGenerator } from '../../shared/application/ports.js';
import { APP_NAME } from '../../shared/infrastructure/app-info.js';
import { ENV } from '../../shared/infrastructure/config/config.module.js';
import type { Env } from '../../shared/infrastructure/config/env.js';
import {
  DRIZZLE,
  type Database,
} from '../../shared/infrastructure/database/database.module.js';
import { provide } from '../../shared/infrastructure/di/provide.js';
import {
  CLOCK,
  ID_GENERATOR,
} from '../../shared/infrastructure/system.module.js';
import type { ApiPlanLimitsPort } from '../application/ports/plan-limits.port.js';
import type {
  AccessTokenIssuer,
  OpaqueTokens,
  PasswordHasher,
} from '../application/ports/security.ports.js';
import {
  AuthenticateApiKey,
  CreateApiKey,
  ListMyApiKeys,
  RevokeApiKey,
} from '../application/use-cases/api-keys.js';
import {
  Login,
  Logout,
  RefreshSession,
  SessionIssuer,
} from '../application/use-cases/sessions.js';
import {
  ChangeUserRole,
  EnsureAdmin,
  GetProfile,
  ListUsers,
  RegisterUser,
} from '../application/use-cases/users.js';
import type {
  ApiKeyRepository,
  ApiUsageRepository,
} from '../domain/api-key.js';
import type { LoginFailureRepository } from '../domain/login-throttle.js';
import type { RefreshTokenRepository } from '../domain/refresh-token.js';
import type { UserRepository } from '../domain/user.repository.js';
import { AdminUsersController } from './http/admin-users.controller.js';
import { AccountController } from './http/account.controller.js';
import { EmailAccountNotifier } from './mail/email-account-notifier.js';
import { DrizzlePasswordResetRepository } from './persistence/drizzle/drizzle-password-reset.repository.js';
import {
  ChangePassword,
  DeleteAccount,
  RequestPasswordReset,
  ResetPassword,
  UpdateProfile,
} from '../application/use-cases/account.js';
import type { AccountNotifier } from '../application/ports/account-notifier.port.js';
import type { PasswordResetRepository } from '../domain/password-reset.js';
import type { Mailer } from '../../shared/application/ports.js';
import { MAILER } from '../../shared/infrastructure/mail/mail.module.js';
import { ApiKeysController } from './http/api-keys.controller.js';
import { AuthController } from './http/auth.controller.js';
import { AuthenticationGuard } from './http/authentication.guard.js';
import { RefreshCookie } from './http/refresh-cookie.js';
import {
  DrizzleApiKeyRepository,
  DrizzleApiUsageRepository,
} from './persistence/drizzle/drizzle-api-key.repositories.js';
import { DrizzleLoginFailureRepository } from './persistence/drizzle/drizzle-login-failure.repository.js';
import { DrizzleRefreshTokenRepository } from './persistence/drizzle/drizzle-refresh-token.repository.js';
import { DrizzleUserRepository } from './persistence/drizzle/drizzle-user.repository.js';
import { JoseAccessTokenIssuer } from './security/jose-access-token.issuer.js';
import { RandomOpaqueTokens } from './security/node-crypto.js';
import { ScryptPasswordHasher } from './security/scrypt-password.hasher.js';
import {
  ACCESS_TOKEN_ISSUER,
  ACCOUNT_NOTIFIER,
  PASSWORD_RESET_REPOSITORY,
  API_KEY_REPOSITORY,
  API_PLAN_LIMITS,
  API_USAGE_REPOSITORY,
  LOGIN_FAILURE_REPOSITORY,
  OPAQUE_TOKENS,
  PASSWORD_HASHER,
  REFRESH_TOKEN_REPOSITORY,
  USER_REPOSITORY,
} from './tokens.js';

const DAY_MS = 86_400_000;

@Module({
  controllers: [
    AuthController,
    AccountController,
    ApiKeysController,
    AdminUsersController,
  ],
  providers: [
    // Outbound adapters
    provide(USER_REPOSITORY, (db: Database) => new DrizzleUserRepository(db), [
      DRIZZLE,
    ]),
    provide(
      REFRESH_TOKEN_REPOSITORY,
      (db: Database) => new DrizzleRefreshTokenRepository(db),
      [DRIZZLE],
    ),
    provide(
      LOGIN_FAILURE_REPOSITORY,
      (db: Database) => new DrizzleLoginFailureRepository(db),
      [DRIZZLE],
    ),
    provide(
      API_KEY_REPOSITORY,
      (db: Database) => new DrizzleApiKeyRepository(db),
      [DRIZZLE],
    ),
    provide(
      API_USAGE_REPOSITORY,
      (db: Database) => new DrizzleApiUsageRepository(db),
      [DRIZZLE],
    ),
    provide(PASSWORD_HASHER, () => new ScryptPasswordHasher()),
    provide(
      ACCESS_TOKEN_ISSUER,
      (env: Env) =>
        new JoseAccessTokenIssuer({
          secret: env.JWT_SECRET,
          issuer: APP_NAME,
          ttlSeconds: env.JWT_ACCESS_TTL_SECONDS,
        }),
      [ENV],
    ),
    provide(OPAQUE_TOKENS, () => new RandomOpaqueTokens()),
    // Adapter: identity's view of the billing plan (GetPlanLimits is exported globally by billing).
    provide(
      API_PLAN_LIMITS,
      (limits: GetPlanLimits): ApiPlanLimitsPort => ({
        limitsFor: async (actor) => {
          const { apiKeys, apiDailyRequests } = await limits.execute(actor);
          return { apiKeys, apiDailyRequests };
        },
      }),
      [GetPlanLimits],
    ),

    // Sessions
    provide(
      SessionIssuer,
      (
        tokens: RefreshTokenRepository,
        access: AccessTokenIssuer,
        opaque: OpaqueTokens,
        ids: IdGenerator,
        clock: Clock,
        env: Env,
      ) =>
        new SessionIssuer(tokens, access, opaque, ids, clock, {
          refreshTokenTtlMs: env.REFRESH_TOKEN_TTL_DAYS * DAY_MS,
        }),
      [
        REFRESH_TOKEN_REPOSITORY,
        ACCESS_TOKEN_ISSUER,
        OPAQUE_TOKENS,
        ID_GENERATOR,
        CLOCK,
        ENV,
      ],
    ),
    provide(
      Login,
      (
        users: UserRepository,
        hasher: PasswordHasher,
        sessions: SessionIssuer,
        failures: LoginFailureRepository,
        clock: Clock,
        env: Env,
      ) =>
        new Login(users, hasher, sessions, failures, clock, {
          perAccount: {
            maxFailures: env.LOGIN_MAX_FAILURES_PER_ACCOUNT,
            windowMs: env.LOGIN_LOCKOUT_WINDOW_SECONDS * 1000,
          },
          perIp: {
            maxFailures: env.LOGIN_MAX_FAILURES_PER_IP,
            windowMs: env.LOGIN_LOCKOUT_WINDOW_SECONDS * 1000,
          },
        }),
      [
        USER_REPOSITORY,
        PASSWORD_HASHER,
        SessionIssuer,
        LOGIN_FAILURE_REPOSITORY,
        CLOCK,
        ENV,
      ],
    ),
    provide(
      RefreshSession,
      (
        users: UserRepository,
        tokens: RefreshTokenRepository,
        opaque: OpaqueTokens,
        sessions: SessionIssuer,
        clock: Clock,
      ) => new RefreshSession(users, tokens, opaque, sessions, clock),
      [
        USER_REPOSITORY,
        REFRESH_TOKEN_REPOSITORY,
        OPAQUE_TOKENS,
        SessionIssuer,
        CLOCK,
      ],
    ),
    provide(
      Logout,
      (tokens: RefreshTokenRepository, opaque: OpaqueTokens, clock: Clock) =>
        new Logout(tokens, opaque, clock),
      [REFRESH_TOKEN_REPOSITORY, OPAQUE_TOKENS, CLOCK],
    ),

    // Users
    provide(
      RegisterUser,
      (
        users: UserRepository,
        hasher: PasswordHasher,
        ids: IdGenerator,
        clock: Clock,
      ) => new RegisterUser(users, hasher, ids, clock),
      [USER_REPOSITORY, PASSWORD_HASHER, ID_GENERATOR, CLOCK],
    ),
    provide(GetProfile, (users: UserRepository) => new GetProfile(users), [
      USER_REPOSITORY,
    ]),
    provide(ListUsers, (users: UserRepository) => new ListUsers(users), [
      USER_REPOSITORY,
    ]),
    provide(
      ChangeUserRole,
      (users: UserRepository) => new ChangeUserRole(users),
      [USER_REPOSITORY],
    ),
    provide(
      EnsureAdmin,
      (users: UserRepository, register: RegisterUser) =>
        new EnsureAdmin(users, register),
      [USER_REPOSITORY, RegisterUser],
    ),

    // API keys
    provide(
      CreateApiKey,
      (
        keys: ApiKeyRepository,
        limits: ApiPlanLimitsPort,
        opaque: OpaqueTokens,
        ids: IdGenerator,
        clock: Clock,
      ) => new CreateApiKey(keys, limits, opaque, ids, clock),
      [API_KEY_REPOSITORY, API_PLAN_LIMITS, OPAQUE_TOKENS, ID_GENERATOR, CLOCK],
    ),
    provide(
      ListMyApiKeys,
      (
        keys: ApiKeyRepository,
        usage: ApiUsageRepository,
        limits: ApiPlanLimitsPort,
        clock: Clock,
      ) => new ListMyApiKeys(keys, usage, limits, clock),
      [API_KEY_REPOSITORY, API_USAGE_REPOSITORY, API_PLAN_LIMITS, CLOCK],
    ),
    provide(
      RevokeApiKey,
      (keys: ApiKeyRepository, clock: Clock) => new RevokeApiKey(keys, clock),
      [API_KEY_REPOSITORY, CLOCK],
    ),
    provide(
      AuthenticateApiKey,
      (
        keys: ApiKeyRepository,
        usage: ApiUsageRepository,
        users: UserRepository,
        limits: ApiPlanLimitsPort,
        opaque: OpaqueTokens,
        clock: Clock,
      ) => new AuthenticateApiKey(keys, usage, users, limits, opaque, clock),
      [
        API_KEY_REPOSITORY,
        API_USAGE_REPOSITORY,
        USER_REPOSITORY,
        API_PLAN_LIMITS,
        OPAQUE_TOKENS,
        CLOCK,
      ],
    ),

    RefreshCookie,

    // Account: password reset, profile, deletion
    provide(
      PASSWORD_RESET_REPOSITORY,
      (db: Database) => new DrizzlePasswordResetRepository(db),
      [DRIZZLE],
    ),
    provide(
      ACCOUNT_NOTIFIER,
      (mailer: Mailer, env: Env): AccountNotifier =>
        new EmailAccountNotifier(mailer, env.PASSWORD_RESET_URL),
      [MAILER, ENV],
    ),
    provide(
      RequestPasswordReset,
      (
        users: UserRepository,
        resets: PasswordResetRepository,
        requests: LoginFailureRepository,
        opaque: OpaqueTokens,
        ids: IdGenerator,
        notifier: AccountNotifier,
        clock: Clock,
        env: Env,
      ) => {
        const windowMs = env.PASSWORD_RESET_WINDOW_SECONDS * 1000;
        return new RequestPasswordReset(
          users,
          resets,
          requests,
          opaque,
          ids,
          notifier,
          clock,
          {
            ttlMinutes: env.PASSWORD_RESET_TTL_MINUTES,
            throttle: {
              perAccount: {
                maxFailures: env.PASSWORD_RESET_MAX_PER_ACCOUNT,
                windowMs,
              },
              perIp: { maxFailures: env.PASSWORD_RESET_MAX_PER_IP, windowMs },
            },
          },
        );
      },
      [
        USER_REPOSITORY,
        PASSWORD_RESET_REPOSITORY,
        LOGIN_FAILURE_REPOSITORY,
        OPAQUE_TOKENS,
        ID_GENERATOR,
        ACCOUNT_NOTIFIER,
        CLOCK,
        ENV,
      ],
    ),
    provide(
      ResetPassword,
      (
        users: UserRepository,
        resets: PasswordResetRepository,
        tokens: RefreshTokenRepository,
        failures: LoginFailureRepository,
        hasher: PasswordHasher,
        opaque: OpaqueTokens,
        notifier: AccountNotifier,
        clock: Clock,
      ) =>
        new ResetPassword(
          users,
          resets,
          tokens,
          failures,
          hasher,
          opaque,
          notifier,
          clock,
        ),
      [
        USER_REPOSITORY,
        PASSWORD_RESET_REPOSITORY,
        REFRESH_TOKEN_REPOSITORY,
        LOGIN_FAILURE_REPOSITORY,
        PASSWORD_HASHER,
        OPAQUE_TOKENS,
        ACCOUNT_NOTIFIER,
        CLOCK,
      ],
    ),
    provide(
      ChangePassword,
      (
        users: UserRepository,
        tokens: RefreshTokenRepository,
        hasher: PasswordHasher,
        notifier: AccountNotifier,
        clock: Clock,
      ) => new ChangePassword(users, tokens, hasher, notifier, clock),
      [
        USER_REPOSITORY,
        REFRESH_TOKEN_REPOSITORY,
        PASSWORD_HASHER,
        ACCOUNT_NOTIFIER,
        CLOCK,
      ],
    ),
    provide(
      UpdateProfile,
      (users: UserRepository) => new UpdateProfile(users),
      [USER_REPOSITORY],
    ),
    provide(
      DeleteAccount,
      (users: UserRepository, hasher: PasswordHasher) =>
        new DeleteAccount(users, hasher),
      [USER_REPOSITORY, PASSWORD_HASHER],
    ),

    // Inbound: every request goes through authentication.
    { provide: APP_GUARD, useClass: AuthenticationGuard },
  ],
  exports: [ACCESS_TOKEN_ISSUER, USER_REPOSITORY],
})
export class IdentityModule implements OnApplicationBootstrap {
  private readonly logger = new Logger(IdentityModule.name);

  constructor(
    @Inject(ENV) private readonly env: Env,
    private readonly ensureAdmin: EnsureAdmin,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    const { ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_NAME, ADMIN_BIRTH_DATE } =
      this.env;
    if (!ADMIN_EMAIL || !ADMIN_PASSWORD || !ADMIN_NAME || !ADMIN_BIRTH_DATE)
      return;
    await this.ensureAdmin.execute({
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
      name: ADMIN_NAME,
      birthDate: ADMIN_BIRTH_DATE,
    });
    this.logger.log(`Admin account ready: ${ADMIN_EMAIL}`);
  }
}
