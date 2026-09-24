import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Put,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Principal } from '../../../identity/domain/principal.js';
import {
  Authenticated,
  CurrentPrincipal,
  Roles,
} from '../../../identity/infrastructure/http/auth.decorators.js';
import {
  ApiBearer,
  ApiBodyFrom,
  ApiParamFrom,
  ApiErrors,
  ApiQueryFrom,
  ApiResponseFrom,
} from '../../../shared/infrastructure/http/openapi.js';
import { ZodValidationPipe } from '../../../shared/infrastructure/http/zod-validation.pipe.js';
import type { DrinkVisibility } from '../../domain/drink.js';
import {
  GetMyTasteProfile,
  RecommendForMyTaste,
} from '../../application/use-cases/personal.js';
import type { TasteRecommendationsQueryDto } from './dto/taste.dto.js';
import {
  myTasteResponseSchema,
  tasteRecommendationsQuerySchema,
  tasteRecommendationsResponseSchema,
  toMyTasteResponse,
  toTasteRecommendationsResponse,
} from './dto/taste.dto.js';
import { ViewerVisibility } from './viewer-visibility.decorator.js';
import {
  CompareWithSharedTaste,
  GetMyTasteShare,
  ShareMyTaste,
  StopSharingMyTaste,
} from '../../application/use-cases/taste-share.js';
import type { ShareTasteBodyDto } from './dto/taste-share.dto.js';
import {
  compatibilityResponseSchema,
  myTasteShareResponseSchema,
  shareTasteBodySchema,
  tasteShareResponseSchema,
  tasteSlugSchema,
  toCompatibilityResponse,
  toTasteShareResponse,
} from './dto/taste-share.dto.js';

@ApiTags('Me · tu ADN de sabor')
@ApiBearer()
@Authenticated()
@Controller('me/taste')
export class MeTasteController {
  constructor(
    private readonly getMyTasteProfile: GetMyTasteProfile,
    private readonly recommendForMyTaste: RecommendForMyTaste,
    private readonly shareMyTaste: ShareMyTaste,
    private readonly getMyTasteShare: GetMyTasteShare,
    private readonly stopSharingMyTaste: StopSharingMyTaste,
    private readonly compareWithSharedTaste: CompareWithSharedTaste,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'My taste profile',
    description:
      'Learned from your favorites: average flavor DNA, dominant traits, personality, preferred strength and the ingredients you repeat most. The more favorites, the higher the confidence.',
  })
  @ApiResponseFrom(
    200,
    myTasteResponseSchema,
    'The profile (null, with a hint, if you have no favorites)',
  )
  async taste(
    @CurrentPrincipal() me: Principal,
    @ViewerVisibility() visibility: DrinkVisibility,
  ) {
    return toMyTasteResponse(
      await this.getMyTasteProfile.execute(me.userId, visibility),
    );
  }

  @Get('recommendations')
  @Roles('premium', 'admin')
  @ApiOperation({
    summary: 'Recommendations for my taste (premium)',
    description:
      'Drinks you have not favorited yet, closest to your taste first (70% flavor similarity + 30% shared ingredients), each with a match 0-100 and the reasons. Requires the premium role.',
  })
  @ApiQueryFrom(tasteRecommendationsQuerySchema)
  @ApiResponseFrom(200, tasteRecommendationsResponseSchema, 'Recommendations')
  @ApiErrors(400, 403)
  async recommendations(
    @CurrentPrincipal() me: Principal,
    @Query(new ZodValidationPipe(tasteRecommendationsQuerySchema))
    query: TasteRecommendationsQueryDto,
    @ViewerVisibility() visibility: DrinkVisibility,
  ) {
    return toTasteRecommendationsResponse(
      await this.recommendForMyTaste.execute(
        me.userId,
        query.limit,
        visibility,
      ),
    );
  }

  @Get('share')
  @ApiOperation({
    summary: 'My public taste link',
    description: 'null if you are not sharing.',
  })
  @ApiResponseFrom(200, myTasteShareResponseSchema, 'The link, if any')
  async myShare(@CurrentPrincipal() me: Principal) {
    const share = await this.getMyTasteShare.execute(me.userId);
    return { share: share ? toTasteShareResponse(share) : null };
  }

  @Put('share')
  @ApiOperation({
    summary: 'Share my taste',
    description:
      'Turns on a public link (profile + shareable card) showing only the display name you choose. Calling it again renames it and keeps the same link.',
  })
  @ApiBodyFrom(shareTasteBodySchema)
  @ApiResponseFrom(200, tasteShareResponseSchema, 'The public link')
  @ApiErrors(400)
  async share(
    @CurrentPrincipal() me: Principal,
    @Body(new ZodValidationPipe(shareTasteBodySchema)) body: ShareTasteBodyDto,
  ) {
    return toTasteShareResponse(
      await this.shareMyTaste.execute(me.userId, body.displayName),
    );
  }

  @Delete('share')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Stop sharing',
    description: 'The link stops working. Idempotent.',
  })
  @ApiResponseFrom(204, null, 'Turned off')
  async stopSharing(@CurrentPrincipal() me: Principal) {
    await this.stopSharingMyTaste.execute(me.userId);
  }

  @Get('compatibility/:slug')
  @ApiOperation({
    summary: 'How compatible am I with a friend?',
    description:
      'Compares your taste with a shared one: score (75% flavor similarity + 25% favorite ingredients), shared and different traits, and 3 bridge drinks neither has tried that both would enjoy.',
  })
  @ApiParamFrom('slug', tasteSlugSchema, "Your friend's share slug")
  @ApiResponseFrom(200, compatibilityResponseSchema, 'Compatibility')
  @ApiErrors(400, 404)
  async compatibility(
    @CurrentPrincipal() me: Principal,
    @Param('slug', new ZodValidationPipe(tasteSlugSchema)) slug: string,
    @ViewerVisibility() visibility: DrinkVisibility,
  ) {
    return toCompatibilityResponse(
      await this.compareWithSharedTaste.execute(me.userId, slug, visibility),
    );
  }
}
