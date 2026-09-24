import { Body, Controller, Get, Param, Post, Put, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Principal } from '../../../identity/domain/principal.js';
import {
  Authenticated,
  CurrentPrincipal,
  Roles,
} from '../../../identity/infrastructure/http/auth.decorators.js';
import {
  ApiBearer,
  ApiBearerOrApiKey,
  ApiBodyFrom,
  ApiErrors,
  ApiParamFrom,
  ApiQueryFrom,
  ApiResponseFrom,
} from '../../../shared/infrastructure/http/openapi.js';
import { ZodValidationPipe } from '../../../shared/infrastructure/http/zod-validation.pipe.js';
import {
  BuildVenueMenu,
  CreateVenue,
  GetInventory,
  GetManagedVenue,
  ListMyVenues,
  ReplaceInventory,
} from '../../application/use-cases/venues.js';
import type {
  CreateVenueBodyDto,
  MenuQueryDto,
  ReplaceInventoryBodyDto,
} from './dto/venue-requests.dto.js';
import {
  createVenueBodySchema,
  menuQuerySchema,
  replaceInventoryBodySchema,
  venueIdSchema,
} from './dto/venue-requests.dto.js';
import {
  inventoryResponseSchema,
  menuResponseSchema,
  toInventoryResponse,
  toMenuResponse,
  toVenueResponse,
  venueListResponseSchema,
  venueResponseSchema,
} from './dto/venue-responses.dto.js';

const venueId = new ZodValidationPipe(venueIdSchema);

/** Reads accept API keys (e.g. a POS showing today's menu); writes need a user session. */
@ApiTags('Venues · smart menu')
@Controller('venues')
export class VenuesController {
  constructor(
    private readonly createVenue: CreateVenue,
    private readonly listMyVenues: ListMyVenues,
    private readonly getManagedVenue: GetManagedVenue,
    private readonly getInventory: GetInventory,
    private readonly replaceInventory: ReplaceInventory,
    private readonly buildVenueMenu: BuildVenueMenu,
  ) {}

  @Post()
  @Roles('venue_owner', 'admin')
  @ApiBearer()
  @ApiOperation({
    summary: 'Register a venue',
    description:
      'Needs the venue_owner role and legal age. The number of venues depends on the plan.',
  })
  @ApiBodyFrom(createVenueBodySchema)
  @ApiResponseFrom(201, venueResponseSchema, 'The venue')
  @ApiErrors(400, 402, 403)
  async create(
    @CurrentPrincipal() actor: Principal,
    @Body(new ZodValidationPipe(createVenueBodySchema))
    body: CreateVenueBodyDto,
  ) {
    return toVenueResponse(await this.createVenue.execute(actor, body));
  }

  @Get('mine')
  @Authenticated({ allowApiKey: true })
  @ApiBearerOrApiKey()
  @ApiOperation({ summary: 'My venues' })
  @ApiResponseFrom(200, venueListResponseSchema, 'Venues I own')
  async mine(@CurrentPrincipal() actor: Principal) {
    return (await this.listMyVenues.execute(actor)).map(toVenueResponse);
  }

  @Get(':id')
  @Authenticated({ allowApiKey: true })
  @ApiBearerOrApiKey()
  @ApiOperation({
    summary: 'Venue detail',
    description: 'Owner or admin only.',
  })
  @ApiParamFrom('id', venueIdSchema, 'Venue id')
  @ApiResponseFrom(200, venueResponseSchema, 'The venue')
  @ApiErrors(400, 403, 404)
  async findOne(
    @CurrentPrincipal() actor: Principal,
    @Param('id', venueId) id: string,
  ) {
    return toVenueResponse(await this.getManagedVenue.execute(actor, id));
  }

  @Get(':id/inventory')
  @Authenticated({ allowApiKey: true })
  @ApiBearerOrApiKey()
  @ApiOperation({ summary: 'Venue inventory' })
  @ApiParamFrom('id', venueIdSchema, 'Venue id')
  @ApiResponseFrom(200, inventoryResponseSchema, 'Inventory')
  @ApiErrors(400, 403, 404)
  async inventory(
    @CurrentPrincipal() actor: Principal,
    @Param('id', venueId) id: string,
  ) {
    return toInventoryResponse(await this.getInventory.execute(actor, id));
  }

  @Put(':id/inventory')
  @Authenticated()
  @ApiBearer()
  @ApiOperation({
    summary: 'Replace the venue inventory',
    description:
      'Liquids: bottleSizeMl + bottleCost. Garnishes (salt, mint, wedges): costPerServing. The number of items depends on the plan.',
  })
  @ApiParamFrom('id', venueIdSchema, 'Venue id')
  @ApiBodyFrom(replaceInventoryBodySchema)
  @ApiResponseFrom(200, inventoryResponseSchema, 'The saved inventory')
  @ApiErrors(400, 402, 403, 404)
  async setInventory(
    @CurrentPrincipal() actor: Principal,
    @Param('id', venueId) id: string,
    @Body(new ZodValidationPipe(replaceInventoryBodySchema))
    body: ReplaceInventoryBodyDto,
  ) {
    return toInventoryResponse(
      await this.replaceInventory.execute(actor, id, body.items),
    );
  }

  @Get(':id/menu')
  @Authenticated({ allowApiKey: true })
  @ApiBearerOrApiKey()
  @ApiOperation({
    summary: 'Smart menu',
    description:
      'What the venue can serve today with what is in stock. Paid plans also get cost, suggested price (cost / targetPourCost, rounded for the currency) and margin, most profitable first.',
  })
  @ApiParamFrom('id', venueIdSchema, 'Venue id')
  @ApiQueryFrom(menuQuerySchema)
  @ApiResponseFrom(200, menuResponseSchema, 'The menu')
  @ApiErrors(400, 403, 404)
  async menu(
    @CurrentPrincipal() actor: Principal,
    @Param('id', venueId) id: string,
    @Query(new ZodValidationPipe(menuQuerySchema)) query: MenuQueryDto,
  ) {
    const { venue, menu } = await this.buildVenueMenu.execute(actor, id, query);
    return toMenuResponse(venue, menu);
  }
}
