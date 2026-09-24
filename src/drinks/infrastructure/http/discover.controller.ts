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
import { z } from 'zod';
import type { Principal } from '../../../identity/domain/principal.js';
import {
  Authenticated,
  CurrentPrincipal,
} from '../../../identity/infrastructure/http/auth.decorators.js';
import {
  ApiBearer,
  ApiBodyFrom,
  ApiErrors,
  ApiParamFrom,
  ApiQueryFrom,
  ApiResponseFrom,
} from '../../../shared/infrastructure/http/openapi.js';
import { ZodValidationPipe } from '../../../shared/infrastructure/http/zod-validation.pipe.js';
import type { DrinkVisibility } from '../../domain/drink.js';
import {
  GetDiscoverDeck,
  GetDiscoverStats,
  ReactToDrink,
  UndoReaction,
} from '../../application/use-cases/discover.js';
import { drinkIdSchema } from './dto/drink-requests.dto.js';
import type { DeckQueryDto, ReactBodyDto } from './dto/discover.dto.js';
import {
  deckQuerySchema,
  discoverStatsSchema,
  reactBodySchema,
  reactionResponseSchema,
  toDiscoverStatsResponse,
  toReactionResponse,
} from './dto/discover.dto.js';
import { drinkCardSchema, toDrinkCard } from './dto/explore.dto.js';
import { ViewerVisibility } from './viewer-visibility.decorator.js';

const drinkId = new ZodValidationPipe(drinkIdSchema);

@ApiTags('Discover · swipe')
@ApiBearer()
@Authenticated()
@Controller('discover')
export class DiscoverController {
  constructor(
    private readonly getDiscoverDeck: GetDiscoverDeck,
    private readonly reactToDrink: ReactToDrink,
    private readonly undoReaction: UndoReaction,
    private readonly getDiscoverStats: GetDiscoverStats,
  ) {}

  @Get('deck')
  @ApiOperation({
    summary: 'Cards to swipe',
    description:
      'Drinks you have not seen yet: ~70% close to your taste (once you have one) and ~30% to explore. Call again for more.',
  })
  @ApiQueryFrom(deckQuerySchema)
  @ApiResponseFrom(200, z.array(drinkCardSchema), 'Drink cards')
  @ApiErrors(400)
  async deck(
    @CurrentPrincipal() me: Principal,
    @Query(new ZodValidationPipe(deckQuerySchema)) query: DeckQueryDto,
    @ViewerVisibility() visibility: DrinkVisibility,
  ) {
    return (
      await this.getDiscoverDeck.execute(me.userId, query.count, visibility)
    ).map(toDrinkCard);
  }

  @Put(':drinkId')
  @ApiOperation({
    summary: 'Swipe a drink',
    description:
      'like / dislike / superlike. Swiping again replaces the previous reaction. Returns your updated taste profile.',
  })
  @ApiParamFrom('drinkId', drinkIdSchema, 'Drink id')
  @ApiBodyFrom(reactBodySchema)
  @ApiResponseFrom(200, reactionResponseSchema, 'Reaction saved')
  @ApiErrors(400, 403, 404)
  async react(
    @CurrentPrincipal() me: Principal,
    @Param('drinkId', drinkId) id: string,
    @Body(new ZodValidationPipe(reactBodySchema)) body: ReactBodyDto,
    @ViewerVisibility() visibility: DrinkVisibility,
  ) {
    return toReactionResponse(
      await this.reactToDrink.execute(me.userId, id, body.reaction, visibility),
    );
  }

  @Delete(':drinkId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Undo a swipe',
    description:
      'The drink can appear in the deck again. A superlike keeps the favorite.',
  })
  @ApiParamFrom('drinkId', drinkIdSchema, 'Drink id')
  @ApiResponseFrom(204, null, 'Undone')
  @ApiErrors(400)
  async undo(
    @CurrentPrincipal() me: Principal,
    @Param('drinkId', drinkId) id: string,
  ) {
    await this.undoReaction.execute(me.userId, id);
  }

  @Get('stats')
  @ApiOperation({ summary: 'My swipe stats' })
  @ApiResponseFrom(200, discoverStatsSchema, 'Counts')
  async stats(@CurrentPrincipal() me: Principal) {
    return toDiscoverStatsResponse(
      await this.getDiscoverStats.execute(me.userId),
    );
  }
}
