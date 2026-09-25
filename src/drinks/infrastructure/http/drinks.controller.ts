import { Controller, Get, Inject, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  ApiErrors,
  ApiOptionalAuth,
  ApiParamFrom,
  ApiQueryFrom,
  ApiResponseFrom,
} from '../../../shared/infrastructure/http/openapi.js';
import { ZodValidationPipe } from '../../../shared/infrastructure/http/zod-validation.pipe.js';
import { Cacheable } from '../../../shared/infrastructure/http/cache-control.js';
import { ENV } from '../../../shared/infrastructure/config/config.module.js';
import type { Env } from '../../../shared/infrastructure/config/env.js';
import {
  ExploreDrinks,
  GetDrinkFacets,
  SuggestDrinks,
} from '../../application/use-cases/explore.js';
import { ingredientImage } from '../cocktaildb/images.js';
import type { ExploreQueryDto, SuggestQueryDto } from './dto/explore.dto.js';
import {
  explorePageSchema,
  exploreQuerySchema,
  facetsResponseSchema,
  suggestQuerySchema,
  suggestResponseSchema,
  toExplorePage,
  toFacetsResponse,
  toSuggestResponse,
} from './dto/explore.dto.js';
import type { DrinkVisibility } from '../../domain/drink.js';
import {
  GetDrink,
  GetDrinkOfTheDay,
  GetRandomDrink,
  SearchDrinks,
} from '../../application/use-cases/drink-queries.js';
import {
  FindDrinkTwins,
  GetFlavorDna,
} from '../../application/use-cases/drink-insights.js';
import type {
  RandomDrinkQueryDto,
  SearchDrinksQueryDto,
  TwinsQueryDto,
} from './dto/drink-requests.dto.js';
import {
  drinkIdSchema,
  randomDrinkQuerySchema,
  searchDrinksQuerySchema,
  twinsQuerySchema,
} from './dto/drink-requests.dto.js';
import {
  drinkListResponseSchema,
  drinkOfTheDayResponseSchema,
  drinkResponseSchema,
  flavorDnaResponseSchema,
  toDrinkResponse,
  toFlavorDnaResponse,
  toTwinsResponse,
  twinsResponseSchema,
} from './dto/drink-responses.dto.js';
import { ViewerVisibility } from './viewer-visibility.decorator.js';

const AGE_NOTE = 'Alcoholic drinks are only returned to authenticated adults.';

@ApiTags('Drinks')
@ApiOptionalAuth()
@Controller('drinks')
export class DrinksController {
  constructor(
    private readonly searchDrinks: SearchDrinks,
    private readonly getDrink: GetDrink,
    private readonly getRandomDrink: GetRandomDrink,
    private readonly getDrinkOfTheDay: GetDrinkOfTheDay,
    private readonly getFlavorDna: GetFlavorDna,
    private readonly findDrinkTwins: FindDrinkTwins,
    private readonly exploreDrinks: ExploreDrinks,
    private readonly getDrinkFacets: GetDrinkFacets,
    private readonly suggestDrinks: SuggestDrinks,
    @Inject(ENV) private readonly env: Env,
  ) {}

  @Get()
  @Cacheable()
  @ApiOperation({
    summary: 'Explore the catalog',
    description: `Combinable filters and cursor pagination for infinite scroll: pass \`nextCursor\` as \`cursor\` to get the next page. Sorted by name. ${AGE_NOTE}`,
  })
  @ApiQueryFrom(exploreQuerySchema)
  @ApiResponseFrom(200, explorePageSchema, 'A page of drink cards')
  @ApiErrors(400, 503)
  async explore(
    @Query(new ZodValidationPipe(exploreQuerySchema)) query: ExploreQueryDto,
    @ViewerVisibility() visibility: DrinkVisibility,
  ) {
    const { limit, cursor, ...filters } = query;
    return toExplorePage(
      await this.exploreDrinks.execute(
        filters,
        { limit, after: cursor ?? null },
        visibility,
      ),
    );
  }

  @Get('facets')
  @Cacheable()
  @ApiOperation({
    summary: 'Filter options',
    description:
      'Categories, glasses and most used ingredients with how many drinks each has (Spanish names included), to build the filters UI.',
  })
  @ApiResponseFrom(200, facetsResponseSchema, 'Facets')
  @ApiErrors(503)
  async facets(@ViewerVisibility() visibility: DrinkVisibility) {
    return toFacetsResponse(await this.getDrinkFacets.execute(visibility));
  }

  @Get('suggest')
  @Cacheable()
  @ApiOperation({
    summary: 'Autocomplete',
    description:
      'Drinks and ingredients matching what the user is typing, tolerant to typos ("margarta", "mojto"). Search-as-you-type friendly.',
  })
  @ApiQueryFrom(suggestQuerySchema)
  @ApiResponseFrom(200, suggestResponseSchema, 'Suggestions, best first')
  @ApiErrors(400, 503)
  async suggest(
    @Query(new ZodValidationPipe(suggestQuerySchema)) query: SuggestQueryDto,
    @ViewerVisibility() visibility: DrinkVisibility,
  ) {
    const suggestions = await this.suggestDrinks.execute(
      query.q,
      query.limit,
      visibility,
    );
    return toSuggestResponse(suggestions, (name) =>
      ingredientImage(this.env.COCKTAILDB_IMAGES_BASE_URL, name),
    );
  }

  @Get('search')
  @Cacheable()
  @ApiOperation({
    summary: 'Search drinks by name',
    description: `Searches TheCocktailDB and stores the results; falls back to the local catalog if it is down. ${AGE_NOTE}`,
  })
  @ApiQueryFrom(searchDrinksQuerySchema)
  @ApiResponseFrom(200, drinkListResponseSchema, 'Matching drinks')
  @ApiErrors(400, 503)
  async search(
    @Query(new ZodValidationPipe(searchDrinksQuerySchema))
    query: SearchDrinksQueryDto,
    @ViewerVisibility() visibility: DrinkVisibility,
  ) {
    return (await this.searchDrinks.execute(query.q, visibility)).map(
      toDrinkResponse,
    );
  }

  @Get('random')
  @ApiOperation({ summary: 'A random drink', description: AGE_NOTE })
  @ApiQueryFrom(randomDrinkQuerySchema)
  @ApiResponseFrom(200, drinkResponseSchema, 'A random drink')
  @ApiErrors(400, 403, 404)
  async random(
    @Query(new ZodValidationPipe(randomDrinkQuerySchema))
    query: RandomDrinkQueryDto,
    @ViewerVisibility() visibility: DrinkVisibility,
  ) {
    return toDrinkResponse(
      await this.getRandomDrink.execute(query.alcoholic, visibility),
    );
  }

  @Get('of-the-day')
  @Cacheable()
  @ApiOperation({
    summary: 'Drink of the day',
    description: `The same drink for everyone during a UTC day. ${AGE_NOTE}`,
  })
  @ApiResponseFrom(200, drinkOfTheDayResponseSchema, "Today's drink")
  @ApiErrors(404, 503)
  async ofTheDay(@ViewerVisibility() visibility: DrinkVisibility) {
    const { date, drink } = await this.getDrinkOfTheDay.execute(visibility);
    return { date, drink: toDrinkResponse(drink) };
  }

  @Get(':id')
  @Cacheable()
  @ApiOperation({ summary: 'Drink detail', description: AGE_NOTE })
  @ApiParamFrom('id', drinkIdSchema, 'Drink id')
  @ApiResponseFrom(200, drinkResponseSchema, 'The drink')
  @ApiErrors(400, 403, 404)
  async findOne(
    @Param('id', new ZodValidationPipe(drinkIdSchema)) id: string,
    @ViewerVisibility() visibility: DrinkVisibility,
  ) {
    return toDrinkResponse(await this.getDrink.execute(id, visibility));
  }

  @Get(':id/dna')
  @Cacheable()
  @ApiOperation({
    summary: 'Flavor DNA',
    description:
      'Flavor profile (sweet, sour, bitter, strong, fruity, herbal, creamy, fizzy, spicy), dominant traits, personality, strength and complexity.',
  })
  @ApiParamFrom('id', drinkIdSchema, 'Drink id')
  @ApiResponseFrom(200, flavorDnaResponseSchema, 'The flavor DNA')
  @ApiErrors(400, 403, 404)
  async dna(
    @Param('id', new ZodValidationPipe(drinkIdSchema)) id: string,
    @ViewerVisibility() visibility: DrinkVisibility,
  ) {
    const { drink, dna } = await this.getFlavorDna.execute(id, visibility);
    return toFlavorDnaResponse(drink, dna);
  }

  @Get(':id/twins')
  @Cacheable()
  @ApiOperation({
    summary: 'Twin drinks',
    description:
      'Most similar drinks: 60% shared ingredients (Jaccard) + 40% flavor similarity (cosine).',
  })
  @ApiParamFrom('id', drinkIdSchema, 'Drink id')
  @ApiQueryFrom(twinsQuerySchema)
  @ApiResponseFrom(200, twinsResponseSchema, 'The twins, most similar first')
  @ApiErrors(400, 403, 404)
  async twins(
    @Param('id', new ZodValidationPipe(drinkIdSchema)) id: string,
    @Query(new ZodValidationPipe(twinsQuerySchema)) query: TwinsQueryDto,
    @ViewerVisibility() visibility: DrinkVisibility,
  ) {
    const { drink, twins } = await this.findDrinkTwins.execute(
      id,
      query.limit,
      visibility,
    );
    return toTwinsResponse(drink, twins);
  }
}
