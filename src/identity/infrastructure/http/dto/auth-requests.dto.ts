import { z } from 'zod';
import { ROLES } from '../../../domain/role.js';

export const registerBodySchema = z
  .object({
    email: z.email().meta({ example: 'ana@example.com' }),
    password: z.string().min(1).max(200).meta({
      description: '10+ characters with letters and numbers',
      example: 'secret-password-123',
    }),
    name: z.string().trim().min(1).max(100).meta({ example: 'Ana' }),
    birthDate: z.iso
      .date()
      .transform((d) => new Date(`${d}T00:00:00Z`))
      .meta({
        description: 'YYYY-MM-DD. Adults (18+) can see alcoholic drinks.',
        example: '1995-05-20',
      }),
  })
  .meta({ id: 'RegisterRequest' });
export type RegisterBodyDto = z.infer<typeof registerBodySchema>;

export const loginBodySchema = z
  .object({
    email: z.string().min(1).meta({ example: 'ana@example.com' }),
    password: z.string().min(1).meta({ example: 'secret-password-123' }),
  })
  .meta({ id: 'LoginRequest' });
export type LoginBodyDto = z.infer<typeof loginBodySchema>;

export const refreshTokenBodySchema = z
  .object({ refreshToken: z.string().min(1) })
  .meta({ id: 'RefreshTokenRequest' });
export type RefreshTokenBodyDto = z.infer<typeof refreshTokenBodySchema>;

export const changeRoleBodySchema = z
  .object({ role: z.enum(ROLES) })
  .meta({ id: 'ChangeRoleRequest' });
export type ChangeRoleBodyDto = z.infer<typeof changeRoleBodySchema>;

export const userIdSchema = z.uuid().meta({ description: 'User id' });

export const listUsersQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});
export type ListUsersQueryDto = z.infer<typeof listUsersQuerySchema>;

export const createApiKeyBodySchema = z
  .object({
    name: z.string().trim().min(1).max(60).meta({
      description: 'To recognise the key later',
      example: 'Integración POS',
    }),
  })
  .meta({ id: 'CreateApiKeyRequest' });
export type CreateApiKeyBodyDto = z.infer<typeof createApiKeyBodySchema>;

export const apiKeyIdSchema = z.uuid().meta({ description: 'API key id' });
