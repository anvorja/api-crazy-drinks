import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Principal } from '../../../identity/domain/principal.js';
import {
  Authenticated,
  CurrentPrincipal,
  Roles,
} from '../../../identity/infrastructure/http/auth.decorators.js';
import {
  ApiBearer,
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

@ApiTags('Me · tu ADN de sabor')
@ApiBearer()
@Authenticated()
@Controller('me/taste')
export class MeTasteController {
  constructor(
    private readonly getMyTasteProfile: GetMyTasteProfile,
    private readonly recommendForMyTaste: RecommendForMyTaste,
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
}
