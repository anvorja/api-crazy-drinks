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
  AddFavorite,
  GetMyPantry,
  ListFavorites,
  RemoveFavorite,
  SaveMyPantry,
  SuggestFromMyPantry,
} from '../../application/use-cases/personal.js';
import { drinkIdSchema } from './dto/drink-requests.dto.js';
import {
  drinkResponseSchema,
  toDrinkResponse,
} from './dto/drink-responses.dto.js';
import type { PantrySuggestionOptionsDto } from './dto/lab-requests.dto.js';
import { pantrySuggestionOptionsSchema } from './dto/lab-requests.dto.js';
import {
  pantryResponseSchema as pantrySuggestionsResponseSchema,
  toPantryResponse,
} from './dto/lab-responses.dto.js';
import type { SavePantryBodyDto } from './dto/personal.dto.js';
import {
  favoriteListResponseSchema,
  pantryResponseSchema,
  savePantryBodySchema,
  toFavoriteResponse,
  toUserPantryResponse,
} from './dto/personal.dto.js';
import { ViewerVisibility } from './viewer-visibility.decorator.js';

const drinkId = new ZodValidationPipe(drinkIdSchema);

@ApiTags('Me · pantry & favorites')
@ApiBearer()
@Authenticated()
@Controller('me')
export class MeDrinksController {
  constructor(
    private readonly getMyPantry: GetMyPantry,
    private readonly saveMyPantry: SaveMyPantry,
    private readonly suggestFromMyPantry: SuggestFromMyPantry,
    private readonly listFavorites: ListFavorites,
    private readonly addFavorite: AddFavorite,
    private readonly removeFavorite: RemoveFavorite,
  ) {}

  @Get('pantry')
  @ApiOperation({ summary: 'My saved pantry' })
  @ApiResponseFrom(
    200,
    pantryResponseSchema,
    'Saved ingredients (empty if never saved)',
  )
  async pantry(@CurrentPrincipal() me: Principal) {
    return toUserPantryResponse(await this.getMyPantry.execute(me.userId));
  }

  @Put('pantry')
  @ApiOperation({
    summary: 'Save my pantry',
    description:
      'Replaces the saved ingredients. Duplicates (ignoring case and accents) are dropped.',
  })
  @ApiBodyFrom(savePantryBodySchema)
  @ApiResponseFrom(200, pantryResponseSchema, 'The saved pantry')
  @ApiErrors(400)
  async savePantry(
    @CurrentPrincipal() me: Principal,
    @Body(new ZodValidationPipe(savePantryBodySchema)) body: SavePantryBodyDto,
  ) {
    return toUserPantryResponse(
      await this.saveMyPantry.execute(me.userId, body.ingredients),
    );
  }

  @Get('pantry/suggestions')
  @ApiOperation({
    summary: 'Suggestions from my saved pantry',
    description: 'Same as GET /v1/lab/pantry, using the saved ingredients.',
  })
  @ApiQueryFrom(pantrySuggestionOptionsSchema)
  @ApiResponseFrom(200, pantrySuggestionsResponseSchema, 'Suggestions')
  @ApiErrors(400)
  async pantrySuggestions(
    @CurrentPrincipal() me: Principal,
    @Query(new ZodValidationPipe(pantrySuggestionOptionsSchema))
    query: PantrySuggestionOptionsDto,
    @ViewerVisibility() visibility: DrinkVisibility,
  ) {
    return toPantryResponse(
      await this.suggestFromMyPantry.execute(me.userId, query, visibility),
    );
  }

  @Get('favorites')
  @ApiOperation({ summary: 'My favorite drinks', description: 'Newest first.' })
  @ApiResponseFrom(200, favoriteListResponseSchema, 'Favorites')
  async favorites(
    @CurrentPrincipal() me: Principal,
    @ViewerVisibility() visibility: DrinkVisibility,
  ) {
    return (await this.listFavorites.execute(me.userId, visibility)).map(
      toFavoriteResponse,
    );
  }

  @Put('favorites/:drinkId')
  @ApiOperation({ summary: 'Add a favorite', description: 'Idempotent.' })
  @ApiParamFrom('drinkId', drinkIdSchema, 'Drink id')
  @ApiResponseFrom(200, drinkResponseSchema, 'The drink added')
  @ApiErrors(400, 403, 404)
  async favorite(
    @CurrentPrincipal() me: Principal,
    @Param('drinkId', drinkId) id: string,
    @ViewerVisibility() visibility: DrinkVisibility,
  ) {
    return toDrinkResponse(
      await this.addFavorite.execute(me.userId, id, visibility),
    );
  }

  @Delete('favorites/:drinkId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove a favorite', description: 'Idempotent.' })
  @ApiParamFrom('drinkId', drinkIdSchema, 'Drink id')
  @ApiResponseFrom(204, null, 'Removed')
  @ApiErrors(400)
  async unfavorite(
    @CurrentPrincipal() me: Principal,
    @Param('drinkId', drinkId) id: string,
  ) {
    await this.removeFavorite.execute(me.userId, id);
  }
}
