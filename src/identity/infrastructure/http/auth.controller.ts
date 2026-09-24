import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Ip,
  Post,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  ApiBearer,
  ApiBodyFrom,
  ApiErrors,
  ApiResponseFrom,
} from '../../../shared/infrastructure/http/openapi.js';
import { ZodValidationPipe } from '../../../shared/infrastructure/http/zod-validation.pipe.js';
import {
  Login,
  Logout,
  RefreshSession,
} from '../../application/use-cases/sessions.js';
import { GetProfile, RegisterUser } from '../../application/use-cases/users.js';
import type { Principal } from '../../domain/principal.js';
import { Authenticated, CurrentPrincipal } from './auth.decorators.js';
import type {
  LoginBodyDto,
  RefreshTokenBodyDto,
  RegisterBodyDto,
} from './dto/auth-requests.dto.js';
import {
  loginBodySchema,
  refreshTokenBodySchema,
  registerBodySchema,
} from './dto/auth-requests.dto.js';
import {
  sessionResponseSchema,
  toSessionResponse,
  toUserResponse,
  userResponseSchema,
} from './dto/auth-responses.dto.js';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly registerUser: RegisterUser,
    private readonly login: Login,
    private readonly refreshSession: RefreshSession,
    private readonly logout: Logout,
    private readonly getProfile: GetProfile,
  ) {}

  @Post('register')
  @ApiOperation({
    summary: 'Create an account',
    description:
      'Role `user`. The birth date decides access to alcoholic drinks (18+).',
  })
  @ApiBodyFrom(registerBodySchema)
  @ApiResponseFrom(201, userResponseSchema, 'Account created')
  @ApiErrors(400, 409)
  async register(
    @Body(new ZodValidationPipe(registerBodySchema)) body: RegisterBodyDto,
  ) {
    return toUserResponse(await this.registerUser.execute(body));
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Log in',
    description:
      'Returns an access token and a refresh token. Repeated failures lock the account and the IP for a while (429 with Retry-After).',
  })
  @ApiBodyFrom(loginBodySchema)
  @ApiResponseFrom(200, sessionResponseSchema, 'Session')
  @ApiErrors(400, 401, 429)
  async signIn(
    @Body(new ZodValidationPipe(loginBodySchema)) body: LoginBodyDto,
    @Ip() ip: string,
  ) {
    return toSessionResponse(await this.login.execute({ ...body, ip }));
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Refresh the session',
    description:
      'Rotates the refresh token. Reusing an already rotated token revokes every session of that login.',
  })
  @ApiBodyFrom(refreshTokenBodySchema)
  @ApiResponseFrom(200, sessionResponseSchema, 'New session')
  @ApiErrors(400, 401)
  async refresh(
    @Body(new ZodValidationPipe(refreshTokenBodySchema))
    body: RefreshTokenBodyDto,
  ) {
    return toSessionResponse(
      await this.refreshSession.execute(body.refreshToken),
    );
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Log out',
    description: 'Revokes the session. Idempotent.',
  })
  @ApiBodyFrom(refreshTokenBodySchema)
  @ApiResponseFrom(204, null, 'Logged out')
  @ApiErrors(400)
  async signOut(
    @Body(new ZodValidationPipe(refreshTokenBodySchema))
    body: RefreshTokenBodyDto,
  ) {
    await this.logout.execute(body.refreshToken);
  }

  @Get('me')
  @Authenticated()
  @ApiBearer()
  @ApiOperation({ summary: 'My profile' })
  @ApiResponseFrom(200, userResponseSchema, 'The authenticated user')
  async me(@CurrentPrincipal() principal: Principal) {
    return toUserResponse(await this.getProfile.execute(principal));
  }
}
