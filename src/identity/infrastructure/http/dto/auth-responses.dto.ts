import { z } from 'zod';
import { Quota } from '../../../application/use-cases/api-keys.js';
import { Session } from '../../../application/use-cases/sessions.js';
import { ApiKey } from '../../../domain/api-key.js';
import { ROLES } from '../../../domain/role.js';
import { User, isAdult } from '../../../domain/user.js';

export const userResponseSchema = z
  .object({
    id: z.uuid(),
    email: z.string().meta({ example: 'ana@example.com' }),
    name: z.string(),
    role: z.enum(ROLES),
    birthDate: z.string().meta({ example: '1995-05-20' }),
    adult: z.boolean(),
    createdAt: z.string(),
  })
  .meta({
    id: 'User',
    description: 'Public view of a user. Never includes the password hash.',
  });
export type UserResponseDto = z.infer<typeof userResponseSchema>;

export const userListResponseSchema = z.array(userResponseSchema);

export const sessionResponseSchema = z
  .object({
    tokenType: z.literal('Bearer'),
    accessToken: z
      .string()
      .meta({ description: 'JWT. Send as Authorization: Bearer <token>' }),
    expiresIn: z
      .number()
      .int()
      .meta({ description: 'Access token lifetime in seconds' }),
    refreshToken: z.string().nullable().meta({
      description:
        'Opaque, single use (each refresh returns a new one). null when it was set as an httpOnly cookie.',
    }),
    refreshTokenIn: z.enum(['cookie', 'body']),
    user: userResponseSchema,
  })
  .meta({ id: 'Session' });

export const quotaResponseSchema = z
  .object({
    limit: z.number().int(),
    used: z.number().int(),
    remaining: z.number().int(),
    resetsInSeconds: z.number().int(),
  })
  .meta({
    id: 'ApiQuota',
    description: 'Daily requests across all your API keys (UTC day).',
  });

export const apiKeyResponseSchema = z
  .object({
    id: z.uuid(),
    name: z.string(),
    prefix: z.string().meta({
      example: 'dk_a1B2c3',
      description: 'First characters of the key',
    }),
    createdAt: z.string(),
    lastUsedAt: z.string().nullable(),
    revokedAt: z.string().nullable(),
  })
  .meta({ id: 'ApiKey' });

export const createdApiKeyResponseSchema = apiKeyResponseSchema
  .extend({
    key: z
      .string()
      .meta({ description: 'The secret. Shown only once: store it now.' }),
  })
  .meta({ id: 'CreatedApiKey' });

export const apiKeyListResponseSchema = z
  .object({ quota: quotaResponseSchema, keys: z.array(apiKeyResponseSchema) })
  .meta({ id: 'ApiKeyList' });

export const toUserResponse = (
  user: User,
  today = new Date(),
): UserResponseDto => ({
  id: user.id,
  email: user.email,
  name: user.name,
  role: user.role,
  birthDate: user.birthDate.toISOString().slice(0, 10),
  adult: isAdult(user, today),
  createdAt: user.createdAt.toISOString(),
});

export const toSessionResponse = (
  session: Session,
  refreshTokenIn: 'cookie' | 'body',
): z.infer<typeof sessionResponseSchema> => ({
  tokenType: 'Bearer',
  accessToken: session.accessToken,
  expiresIn: session.expiresInSeconds,
  refreshToken: refreshTokenIn === 'body' ? session.refreshToken : null,
  refreshTokenIn,
  user: toUserResponse(session.user),
});

export const toApiKeyResponse = (
  key: ApiKey,
): z.infer<typeof apiKeyResponseSchema> => ({
  id: key.id,
  name: key.name,
  prefix: key.prefix,
  createdAt: key.createdAt.toISOString(),
  lastUsedAt: key.lastUsedAt?.toISOString() ?? null,
  revokedAt: key.revokedAt?.toISOString() ?? null,
});

export const toApiKeyListResponse = (result: {
  keys: ApiKey[];
  quota: Quota;
}): z.infer<typeof apiKeyListResponseSchema> => ({
  quota: result.quota,
  keys: result.keys.map(toApiKeyResponse),
});
