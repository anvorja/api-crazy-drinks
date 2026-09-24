import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Ip,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { UnauthorizedError } from '../../../shared/domain/errors.js';
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
import { RefreshCookie } from './refresh-cookie.js';
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
    private readonly refreshCookie: RefreshCookie,
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
      'Returns a short-lived access token. By default the refresh token is set as an httpOnly cookie (send requests with credentials); ask for refreshTokenIn: "body" if you are not a browser. Repeated failures lock the account and the IP for a while (429 LOGIN_LOCKED with Retry-After).',
  })
  @ApiBodyFrom(loginBodySchema)
  @ApiResponseFrom(200, sessionResponseSchema, 'Session')
  @ApiErrors(400, 401, 429)
  async signIn(
    @Body(new ZodValidationPipe(loginBodySchema)) body: LoginBodyDto,
    @Ip() ip: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const session = await this.login.execute({
      email: body.email,
      password: body.password,
      ip,
    });
    if (body.refreshTokenIn === 'cookie')
      this.refreshCookie.set(res, session.refreshToken);
    return toSessionResponse(session, body.refreshTokenIn);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Refresh the session',
    description:
      'Uses the refresh token from the body or, if omitted, from the session cookie (only from the allowed frontend origins). The token rotates on every use; reusing an old one revokes every session of that login.',
  })
  @ApiBodyFrom(refreshTokenBodySchema)
  @ApiResponseFrom(200, sessionResponseSchema, 'New session')
  @ApiErrors(400, 401)
  async refresh(
    @Body(new ZodValidationPipe(refreshTokenBodySchema))
    body: RefreshTokenBodyDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const fromCookie = body.refreshToken
      ? undefined
      : this.refreshCookie.read(req);
    const token = body.refreshToken ?? fromCookie;
    if (!token) {
      throw new UnauthorizedError(
        'No refresh token: send it or use the session cookie',
        'INVALID_REFRESH_TOKEN',
      );
    }
    const deliverIn = body.refreshTokenIn ?? (fromCookie ? 'cookie' : 'body');
    const session = await this.refreshSession.execute(token);
    if (deliverIn === 'cookie')
      this.refreshCookie.set(res, session.refreshToken);
    return toSessionResponse(session, deliverIn);
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Log out',
    description:
      'Revokes the session (token from the body or the cookie) and clears the cookie. Idempotent.',
  })
  @ApiBodyFrom(refreshTokenBodySchema)
  @ApiResponseFrom(204, null, 'Logged out')
  @ApiErrors(400)
  async signOut(
    @Body(new ZodValidationPipe(refreshTokenBodySchema))
    body: RefreshTokenBodyDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const token = body.refreshToken ?? this.refreshCookie.read(req);
    if (token) await this.logout.execute(token);
    this.refreshCookie.clear(res);
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
