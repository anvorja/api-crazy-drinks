import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  ApiBearer,
  ApiBodyFrom,
  ApiErrors,
  ApiParamFrom,
  ApiResponseFrom,
} from '../../../shared/infrastructure/http/openapi.js';
import { ZodValidationPipe } from '../../../shared/infrastructure/http/zod-validation.pipe.js';
import {
  CreateApiKey,
  ListMyApiKeys,
  RevokeApiKey,
} from '../../application/use-cases/api-keys.js';
import type { Principal } from '../../domain/principal.js';
import { Authenticated, CurrentPrincipal } from './auth.decorators.js';
import type { CreateApiKeyBodyDto } from './dto/auth-requests.dto.js';
import {
  apiKeyIdSchema,
  createApiKeyBodySchema,
} from './dto/auth-requests.dto.js';
import {
  apiKeyListResponseSchema,
  createdApiKeyResponseSchema,
  toApiKeyListResponse,
  toApiKeyResponse,
} from './dto/auth-responses.dto.js';

@ApiTags('Me · API keys')
@ApiBearer()
@Authenticated()
@Controller('me/api-keys')
export class ApiKeysController {
  constructor(
    private readonly createApiKey: CreateApiKey,
    private readonly listMyApiKeys: ListMyApiKeys,
    private readonly revokeApiKey: RevokeApiKey,
  ) {}

  @Get()
  @ApiOperation({ summary: 'My API keys and daily quota' })
  @ApiResponseFrom(
    200,
    apiKeyListResponseSchema,
    'Keys (without secrets) and quota',
  )
  async list(@CurrentPrincipal() me: Principal) {
    return toApiKeyListResponse(await this.listMyApiKeys.execute(me));
  }

  @Post()
  @ApiOperation({
    summary: 'Create an API key',
    description:
      'For third-party integrations: send it as `X-API-Key`. The secret is returned only once. How many keys and daily requests you get depends on your plan.',
  })
  @ApiBodyFrom(createApiKeyBodySchema)
  @ApiResponseFrom(
    201,
    createdApiKeyResponseSchema,
    'The new key, with its secret',
  )
  @ApiErrors(400, 402)
  async create(
    @CurrentPrincipal() me: Principal,
    @Body(new ZodValidationPipe(createApiKeyBodySchema))
    body: CreateApiKeyBodyDto,
  ) {
    const { apiKey, secret } = await this.createApiKey.execute(me, body.name);
    return { ...toApiKeyResponse(apiKey), key: secret };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Revoke an API key', description: 'Idempotent.' })
  @ApiParamFrom('id', apiKeyIdSchema, 'API key id')
  @ApiResponseFrom(204, null, 'Revoked')
  @ApiErrors(400, 403, 404)
  async revoke(
    @CurrentPrincipal() me: Principal,
    @Param('id', new ZodValidationPipe(apiKeyIdSchema)) id: string,
  ) {
    await this.revokeApiKey.execute(me, id);
  }
}
