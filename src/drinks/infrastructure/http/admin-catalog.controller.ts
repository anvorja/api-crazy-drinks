import { Controller, Get, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { Roles } from '../../../identity/infrastructure/http/auth.decorators.js';
import {
  ApiBearer,
  ApiErrors,
  ApiResponseFrom,
} from '../../../shared/infrastructure/http/openapi.js';
import { DrinkCatalog } from '../../application/drink-catalog.js';

export const catalogStatusResponseSchema = z
  .object({
    size: z.number().int(),
    lastSyncedAt: z.string().nullable(),
    syncing: z.boolean(),
  })
  .meta({ id: 'CatalogStatus' });

const syncResponseSchema = z
  .object({ synced: z.number().int(), status: catalogStatusResponseSchema })
  .meta({ id: 'CatalogSyncResult' });

@ApiTags('Admin')
@ApiBearer()
@ApiErrors(403)
@Controller('admin/catalog')
@Roles('admin')
export class AdminCatalogController {
  constructor(private readonly catalog: DrinkCatalog) {}

  @Get()
  @ApiOperation({ summary: 'Catalog status' })
  @ApiResponseFrom(200, catalogStatusResponseSchema, 'Status')
  status() {
    return this.catalog.status();
  }

  @Post('sync')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Force a full sync with TheCocktailDB' })
  @ApiResponseFrom(200, syncResponseSchema, 'Drinks synced')
  @ApiErrors(503)
  async sync() {
    return {
      synced: await this.catalog.sync(),
      status: await this.catalog.status(),
    };
  }
}
