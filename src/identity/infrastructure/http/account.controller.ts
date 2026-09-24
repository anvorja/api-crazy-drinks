import {
  Body,
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  Patch,
  Put,
  Res,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import {
  ApiBearer,
  ApiBodyFrom,
  ApiErrors,
  ApiResponseFrom,
} from '../../../shared/infrastructure/http/openapi.js';
import { ZodValidationPipe } from '../../../shared/infrastructure/http/zod-validation.pipe.js';
import {
  ChangePassword,
  DeleteAccount,
  UpdateProfile,
} from '../../application/use-cases/account.js';
import type { Principal } from '../../domain/principal.js';
import { Authenticated, CurrentPrincipal } from './auth.decorators.js';
import type {
  ChangePasswordBodyDto,
  DeleteAccountBodyDto,
  UpdateProfileBodyDto,
} from './dto/account.dto.js';
import {
  changePasswordBodySchema,
  deleteAccountBodySchema,
  updateProfileBodySchema,
} from './dto/account.dto.js';
import {
  toUserResponse,
  userResponseSchema,
} from './dto/auth-responses.dto.js';
import { RefreshCookie } from './refresh-cookie.js';

@ApiTags('Me · cuenta')
@ApiBearer()
@Authenticated()
@Controller('me')
export class AccountController {
  constructor(
    private readonly updateProfile: UpdateProfile,
    private readonly changePassword: ChangePassword,
    private readonly deleteAccount: DeleteAccount,
    private readonly refreshCookie: RefreshCookie,
  ) {}

  @Patch('profile')
  @ApiOperation({
    summary: 'Update my profile',
    description:
      'For now, the name. The birth date cannot change: it decides access to alcohol.',
  })
  @ApiBodyFrom(updateProfileBodySchema)
  @ApiResponseFrom(200, userResponseSchema, 'The updated user')
  @ApiErrors(400)
  async profile(
    @CurrentPrincipal() me: Principal,
    @Body(new ZodValidationPipe(updateProfileBodySchema))
    body: UpdateProfileBodyDto,
  ) {
    return toUserResponse(await this.updateProfile.execute(me, body));
  }

  @Put('password')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Change my password',
    description:
      'Needs the current password (401 WRONG_PASSWORD otherwise). Closes every session, this one included: log in again. An email confirms the change.',
  })
  @ApiBodyFrom(changePasswordBodySchema)
  @ApiResponseFrom(204, null, 'Changed')
  @ApiErrors(400)
  async password(
    @CurrentPrincipal() me: Principal,
    @Body(new ZodValidationPipe(changePasswordBodySchema))
    body: ChangePasswordBodyDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.changePassword.execute(me, body);
    this.refreshCookie.clear(res);
  }

  @Delete()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete my account',
    description:
      'Deletes the account and everything that belongs to it (sessions, favorites, swipes, shared taste, games, venues, API keys, subscription). Irreversible. Needs the password. Admins must be demoted first.',
  })
  @ApiBodyFrom(deleteAccountBodySchema)
  @ApiResponseFrom(204, null, 'Deleted')
  @ApiErrors(400, 403)
  async remove(
    @CurrentPrincipal() me: Principal,
    @Body(new ZodValidationPipe(deleteAccountBodySchema))
    body: DeleteAccountBodyDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.deleteAccount.execute(me, body.password);
    this.refreshCookie.clear(res);
  }
}
