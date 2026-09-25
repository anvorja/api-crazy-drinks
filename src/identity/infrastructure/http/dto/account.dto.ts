import { z } from 'zod';
import { MAX_NAME_LENGTH } from '../../../domain/user.js';

export const forgotPasswordBodySchema = z
  .object({ email: z.string().min(1).meta({ example: 'ana@example.com' }) })
  .meta({ id: 'ForgotPasswordRequest' });
export type ForgotPasswordBodyDto = z.infer<typeof forgotPasswordBodySchema>;

export const resetPasswordBodySchema = z
  .object({
    token: z
      .string()
      .min(1)
      .meta({ description: 'The token from the emailed link (?token=…)' }),
    newPassword: z
      .string()
      .min(1)
      .max(200)
      .meta({ description: '10+ characters with letters and numbers' }),
  })
  .meta({ id: 'ResetPasswordRequest' });
export type ResetPasswordBodyDto = z.infer<typeof resetPasswordBodySchema>;

export const changePasswordBodySchema = z
  .object({
    currentPassword: z.string().min(1),
    newPassword: z
      .string()
      .min(1)
      .max(200)
      .meta({ description: '10+ characters with letters and numbers' }),
  })
  .meta({ id: 'ChangePasswordRequest' });
export type ChangePasswordBodyDto = z.infer<typeof changePasswordBodySchema>;

export const updateProfileBodySchema = z
  .object({
    name: z.string().max(MAX_NAME_LENGTH).meta({ example: 'Ana María' }),
  })
  .meta({ id: 'UpdateProfileRequest' });
export type UpdateProfileBodyDto = z.infer<typeof updateProfileBodySchema>;

export const deleteAccountBodySchema = z
  .object({
    password: z
      .string()
      .min(1)
      .meta({ description: 'Confirms it is really you' }),
  })
  .meta({ id: 'DeleteAccountRequest' });
export type DeleteAccountBodyDto = z.infer<typeof deleteAccountBodySchema>;
