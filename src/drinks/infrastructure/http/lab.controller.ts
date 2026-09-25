import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  ApiErrors,
  ApiOptionalAuth,
  ApiParamFrom,
  ApiQueryFrom,
  ApiResponseFrom,
} from '../../../shared/infrastructure/http/openapi.js';
import { Cacheable } from '../../../shared/infrastructure/http/cache-control.js';
import { ZodValidationPipe } from '../../../shared/infrastructure/http/zod-validation.pipe.js';
import type { DrinkVisibility } from '../../domain/drink.js';
import {
  ListMoods,
  RecommendByMood,
  SuggestFromPantry,
} from '../../application/use-cases/lab.js';
import type { PantryQueryDto } from './dto/lab-requests.dto.js';
import { moodParamSchema, pantryQuerySchema } from './dto/lab-requests.dto.js';
import {
  moodListResponseSchema,
  moodRecommendationResponseSchema,
  pantryResponseSchema,
  toMoodRecommendationResponse,
  toMoodResponse,
  toPantryResponse,
} from './dto/lab-responses.dto.js';
import { ViewerVisibility } from './viewer-visibility.decorator.js';

@ApiTags('Lab')
@ApiOptionalAuth()
@Controller('lab')
export class LabController {
  constructor(
    private readonly listMoods: ListMoods,
    private readonly recommendByMood: RecommendByMood,
    private readonly suggestFromPantry: SuggestFromPantry,
  ) {}

  @Get('moods')
  @Cacheable()
  @ApiOperation({ summary: 'Available moods' })
  @ApiResponseFrom(
    200,
    moodListResponseSchema,
    'All moods with their Spanish aliases',
  )
  moods() {
    return this.listMoods.execute().map(toMoodResponse);
  }

  @Get('moods/:mood')
  @ApiOperation({
    summary: 'A drink for your mood',
    description:
      'Picks one of the 10 best matches at random (plus 3 alternatives). `focused` and `hungover` are alcohol-free; `party` needs alcohol access.',
  })
  @ApiParamFrom('mood', moodParamSchema, 'Mood key or alias')
  @ApiResponseFrom(200, moodRecommendationResponseSchema, 'The recommendation')
  @ApiErrors(403, 404)
  async byMood(
    @Param('mood', new ZodValidationPipe(moodParamSchema)) mood: string,
    @ViewerVisibility() visibility: DrinkVisibility,
  ) {
    return toMoodRecommendationResponse(
      await this.recommendByMood.execute(mood, visibility),
    );
  }

  @Get('pantry')
  @Cacheable()
  @ApiOperation({
    summary: 'Smart pantry',
    description:
      'What you can make with what you have, what you almost can, and which single purchase unlocks the most recipes. Understands Spanish names (ron, limón, hierbabuena…); assumes ice and water.',
  })
  @ApiQueryFrom(pantryQuerySchema)
  @ApiResponseFrom(200, pantryResponseSchema, 'Suggestions')
  @ApiErrors(400, 503)
  async pantry(
    @Query(new ZodValidationPipe(pantryQuerySchema)) query: PantryQueryDto,
    @ViewerVisibility() visibility: DrinkVisibility,
  ) {
    return toPantryResponse(
      await this.suggestFromPantry.execute(query, visibility),
    );
  }
}
