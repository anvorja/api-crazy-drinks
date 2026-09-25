import { existsSync } from 'node:fs';
import { z } from 'zod';

const isoDate = z.iso.date().transform((d) => new Date(`${d}T00:00:00Z`));
const booleanString = z.enum(['true', 'false']).transform((v) => v === 'true');
/** "https://a.com,https://b.com" -> ["https://a.com", "https://b.com"] (each must be an origin). */
const originList = z
  .string()
  .transform((v) =>
    v
      .split(',')
      .map((o) => o.trim())
      .filter(Boolean),
  )
  .pipe(
    z
      .array(
        z
          .url()
          .refine(
            (u) => new URL(u).origin === u,
            'Use bare origins: https://app.example.com',
          ),
      )
      .min(1),
  );
/** Optional variable where an empty value (`NAME=` in a .env file) means "not set". */
const optional = <T extends z.ZodType>(schema: T) =>
  z.preprocess((v) => (v === '' ? undefined : v), schema.optional());

/** Database connection, also used alone by the migration runner. */
const databaseEnvSchema = z.object({
  DB_HOST: z.string().min(1),
  DB_PORT: z.coerce.number().int().positive(),
  DB_NAME: z.string().min(1),
  DB_USER: z.string().min(1),
  DB_PASSWORD: z.string().min(1),
  DB_POOL_MAX: z.coerce.number().int().min(1).max(100),
});

export type DatabaseEnv = z.infer<typeof databaseEnvSchema>;

const schema = z
  .object({
    NODE_ENV: z
      .enum(['development', 'test', 'production'])
      .default('development'),
    PORT: z.coerce.number().int().min(0).max(65535),
    /** Behind a reverse proxy, trust X-Forwarded-For so login throttling sees the real IP. */
    TRUST_PROXY: booleanString,
    OPENAPI_ENABLED: booleanString,
    /** json: one JSON object per line (production, log collectors). pretty: for humans. */
    LOG_FORMAT: z.enum(['json', 'pretty']),
    LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'log', 'debug', 'verbose']),
    /** Prometheus metrics at /metrics; if METRICS_TOKEN is set it needs Authorization: Bearer <token>. */
    METRICS_ENABLED: booleanString,
    METRICS_TOKEN: optional(z.string().min(16)),
    /** Unexpected errors are sent to Sentry when set. */
    SENTRY_DSN: optional(z.url()),
    /** Per-IP request limit (fixed window). postgres: shared by every instance. */
    RATE_LIMIT_ENABLED: booleanString,
    RATE_LIMIT_STORE: z.enum(['memory', 'postgres']),
    RATE_LIMIT_WINDOW_SECONDS: z.coerce.number().int().min(1),
    RATE_LIMIT_MAX: z.coerce.number().int().min(1),
    /** For expensive endpoints: card images and autocomplete. */
    RATE_LIMIT_HEAVY_MAX: z.coerce.number().int().min(1),
    /** Largest JSON body accepted, in KB (413 PAYLOAD_TOO_LARGE above). */
    BODY_LIMIT_KB: z.coerce.number().int().min(1).max(10_240),
    /** Frontend origins allowed by CORS (and to refresh the session with the cookie). */
    CORS_ORIGINS: originList,
    /** Refresh token cookie. Frontend on another site -> none + secure. */
    REFRESH_COOKIE_SAMESITE: z.enum(['strict', 'lax', 'none']),
    REFRESH_COOKIE_SECURE: booleanString,
    /** Optional: share the cookie across subdomains, e.g. ".example.com". */
    REFRESH_COOKIE_DOMAIN: optional(z.string().min(1)),
    /** max-age of Cache-Control on catalog responses (0 disables caching). */
    CACHE_MAX_AGE_SECONDS: z.coerce.number().int().min(0),

    COCKTAILDB_BASE_URL: z.url(),
    COCKTAILDB_API_KEY: z.string().min(1),
    COCKTAILDB_IMAGES_BASE_URL: z.url(),
    COCKTAILDB_TIMEOUT_MS: z.coerce.number().int().positive(),
    COCKTAILDB_RETRIES: z.coerce.number().int().min(0).max(5),
    COCKTAILDB_CRAWL_CONCURRENCY: z.coerce.number().int().min(1).max(20),
    CATALOG_TTL_MS: z.coerce.number().int().positive(),

    ...databaseEnvSchema.shape,

    JWT_SECRET: z.string().min(32, 'Use at least 32 random characters'),
    JWT_ACCESS_TTL_SECONDS: z.coerce.number().int().min(60).max(86_400),
    REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().min(1).max(365),

    LOGIN_MAX_FAILURES_PER_ACCOUNT: z.coerce.number().int().min(1),
    LOGIN_MAX_FAILURES_PER_IP: z.coerce.number().int().min(1),
    LOGIN_LOCKOUT_WINDOW_SECONDS: z.coerce.number().int().min(1),

    /** Frontend page that finishes a password reset; the email links to it with ?token=… */
    PASSWORD_RESET_URL: z.url(),
    PASSWORD_RESET_TTL_MINUTES: z.coerce.number().int().min(5).max(1440),
    PASSWORD_RESET_MAX_PER_ACCOUNT: z.coerce.number().int().min(1),
    PASSWORD_RESET_MAX_PER_IP: z.coerce.number().int().min(1),
    PASSWORD_RESET_WINDOW_SECONDS: z.coerce.number().int().min(60),

    /** none: the API runs without payments (checkout answers 503). wompi: Wompi Web Checkout. */
    PAYMENTS_PROVIDER: z.enum(['none', 'wompi']),
    /** Days a paid period lasts. */
    SUBSCRIPTION_PERIOD_DAYS: z.coerce.number().int().min(1).max(366),
    /** Frontend page the checkout returns to (Wompi appends ?id=<transactionId>). */
    PAYMENTS_REDIRECT_URL: optional(z.url()),
    WOMPI_PUBLIC_KEY: optional(
      z
        .string()
        .regex(/^pub_(test|prod)_/, 'Starts with pub_test_ or pub_prod_'),
    ),
    WOMPI_INTEGRITY_SECRET: optional(
      z.string().regex(/^(test|prod)_integrity_/),
    ),
    WOMPI_EVENTS_SECRET: optional(z.string().regex(/^(test|prod)_events_/)),
    WOMPI_API_URL: optional(z.url()),
    WOMPI_CHECKOUT_URL: optional(z.url()),
    WOMPI_TIMEOUT_MS: z.coerce.number().int().positive(),

    /** log: prints emails (development). smtp: sends them. */
    MAIL_TRANSPORT: z.enum(['log', 'smtp']),
    MAIL_FROM: z.string().min(3),
    SMTP_HOST: optional(z.string().min(1)),
    SMTP_PORT: optional(z.coerce.number().int().positive()),
    SMTP_SECURE: booleanString,
    SMTP_USER: optional(z.string().min(1)),
    SMTP_PASSWORD: optional(z.string().min(1)),

    // Optional operator account created/promoted on boot. All four or none.
    ADMIN_EMAIL: optional(z.email()),
    ADMIN_PASSWORD: optional(z.string().min(1)),
    ADMIN_NAME: optional(z.string().min(1)),
    ADMIN_BIRTH_DATE: optional(isoDate),
  })
  .refine(
    (env) =>
      env.PAYMENTS_PROVIDER !== 'wompi' ||
      (env.WOMPI_PUBLIC_KEY &&
        env.WOMPI_INTEGRITY_SECRET &&
        env.WOMPI_EVENTS_SECRET &&
        env.WOMPI_API_URL &&
        env.WOMPI_CHECKOUT_URL &&
        env.PAYMENTS_REDIRECT_URL),
    {
      message:
        'PAYMENTS_PROVIDER=wompi requires WOMPI_* and PAYMENTS_REDIRECT_URL',
    },
  )
  .refine(
    (env) => env.MAIL_TRANSPORT !== 'smtp' || (env.SMTP_HOST && env.SMTP_PORT),
    {
      message: 'MAIL_TRANSPORT=smtp requires SMTP_HOST and SMTP_PORT',
    },
  )
  .refine(
    (env) =>
      env.REFRESH_COOKIE_SAMESITE !== 'none' || env.REFRESH_COOKIE_SECURE,
    {
      message:
        'REFRESH_COOKIE_SAMESITE=none requires REFRESH_COOKIE_SECURE=true (browsers demand it)',
    },
  )
  .refine(
    (env) => {
      const set = [
        env.ADMIN_EMAIL,
        env.ADMIN_PASSWORD,
        env.ADMIN_NAME,
        env.ADMIN_BIRTH_DATE,
      ];
      return (
        set.every((v) => v === undefined) || set.every((v) => v !== undefined)
      );
    },
    {
      message:
        'Set all of ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_NAME, ADMIN_BIRTH_DATE or none',
    },
  );

export type Env = z.infer<typeof schema>;

/** Loads `.env` (if present) without overriding variables already set by the environment. */
export function loadEnvFile(path = '.env'): void {
  if (existsSync(path)) process.loadEnvFile(path);
}

function validate<T>(schema: z.ZodType<T>, source: NodeJS.ProcessEnv): T {
  const result = schema.safeParse(source);
  if (!result.success) {
    const problems = result.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${problems}`);
  }
  return result.data;
}

/** Validates the environment and fails fast listing every missing or invalid variable. */
export const parseEnv = (source: NodeJS.ProcessEnv = process.env): Env =>
  validate(schema, source);

/** Only the database variables (for the migration runner). */
export const parseDatabaseEnv = (
  source: NodeJS.ProcessEnv = process.env,
): DatabaseEnv => validate(databaseEnvSchema, source);
