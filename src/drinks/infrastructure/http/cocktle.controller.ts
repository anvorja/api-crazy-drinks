import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Principal } from '../../../identity/domain/principal.js';
import {
  Authenticated,
  CurrentPrincipal,
} from '../../../identity/infrastructure/http/auth.decorators.js';
import {
  ApiBearer,
  ApiBodyFrom,
  ApiErrors,
  ApiQueryFrom,
  ApiResponseFrom,
} from '../../../shared/infrastructure/http/openapi.js';
import { ZodValidationPipe } from '../../../shared/infrastructure/http/zod-validation.pipe.js';
import type { CocktleMode } from '../../domain/cocktle.js';
import type { DrinkVisibility } from '../../domain/drink.js';
import {
  GetCocktleStats,
  GetTodayCocktle,
  GuessCocktle,
} from '../../application/use-cases/cocktle.js';
import type {
  CocktleGuessBodyDto,
  CocktleModeQueryDto,
} from './dto/cocktle.dto.js';
import {
  cocktleGuessBodySchema,
  cocktleModeQuerySchema,
  cocktleStateSchema,
  cocktleStatsSchema,
  toCocktleStateResponse,
  toCocktleStatsResponse,
} from './dto/cocktle.dto.js';
import { ViewerVisibility } from './viewer-visibility.decorator.js';

const defaultMode = (visibility: DrinkVisibility): CocktleMode =>
  visibility.includeAlcoholic ? 'classic' : 'zero';

@ApiTags('Cocktle · reto diario')
@ApiBearer()
@Authenticated()
@Controller('cocktle')
export class CocktleController {
  constructor(
    private readonly getTodayCocktle: GetTodayCocktle,
    private readonly guessCocktle: GuessCocktle,
    private readonly getCocktleStats: GetCocktleStats,
  ) {}

  @Get('today')
  @ApiOperation({
    summary: "Today's Cocktle",
    description:
      'Guess the drink of the day in 6 attempts. Clues go from abstract (flavor DNA) to concrete (name shape), one more after each miss. Same puzzle for everyone each UTC day.',
  })
  @ApiQueryFrom(cocktleModeQuerySchema)
  @ApiResponseFrom(200, cocktleStateSchema, 'Your game today')
  @ApiErrors(400, 403, 503)
  async today(
    @CurrentPrincipal() me: Principal,
    @Query(new ZodValidationPipe(cocktleModeQuerySchema))
    query: CocktleModeQueryDto,
    @ViewerVisibility() visibility: DrinkVisibility,
  ) {
    const mode = query.mode ?? defaultMode(visibility);
    return toCocktleStateResponse(
      await this.getTodayCocktle.execute(me.userId, mode, visibility),
    );
  }

  @Post('today/guesses')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Make a guess',
    description:
      'Each guess tells how close its flavor is to the answer (🟩🟨🟧🟥), the ingredients in common and whether category and glass match. The answer and a spoiler-free result to share appear when the game ends.',
  })
  @ApiBodyFrom(cocktleGuessBodySchema)
  @ApiResponseFrom(200, cocktleStateSchema, 'Your game after the guess')
  @ApiErrors(400, 403, 404, 409, 503)
  async guess(
    @CurrentPrincipal() me: Principal,
    @Body(new ZodValidationPipe(cocktleGuessBodySchema))
    body: CocktleGuessBodyDto,
    @ViewerVisibility() visibility: DrinkVisibility,
  ) {
    const mode = body.mode ?? defaultMode(visibility);
    return toCocktleStateResponse(
      await this.guessCocktle.execute(
        me.userId,
        mode,
        body.drinkId,
        visibility,
      ),
    );
  }

  @Get('stats')
  @ApiOperation({
    summary: 'My Cocktle stats',
    description: 'Games, wins, streaks and attempts distribution.',
  })
  @ApiQueryFrom(cocktleModeQuerySchema)
  @ApiResponseFrom(200, cocktleStatsSchema, 'Stats')
  @ApiErrors(400)
  async stats(
    @CurrentPrincipal() me: Principal,
    @Query(new ZodValidationPipe(cocktleModeQuerySchema))
    query: CocktleModeQueryDto,
    @ViewerVisibility() visibility: DrinkVisibility,
  ) {
    const mode = query.mode ?? defaultMode(visibility);
    return toCocktleStatsResponse(
      mode,
      await this.getCocktleStats.execute(me.userId, mode),
    );
  }
}
