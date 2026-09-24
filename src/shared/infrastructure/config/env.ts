import { existsSync } from 'node:fs';
import { z } from 'zod';

const isoDate = z.iso.date().transform((d) => new Date(`${d}T00:00:00Z`));
const booleanString = z.enum(['true', 'false']).transform((v) => v === 'true');
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

    COCKTAILDB_BASE_URL: z.url(),
    COCKTAILDB_API_KEY: z.string().min(1),
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

    // Optional operator account created/promoted on boot. All four or none.
    ADMIN_EMAIL: optional(z.email()),
    ADMIN_PASSWORD: optional(z.string().min(1)),
    ADMIN_NAME: optional(z.string().min(1)),
    ADMIN_BIRTH_DATE: optional(isoDate),
  })
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
