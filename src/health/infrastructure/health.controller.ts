import {
  Controller,
  Get,
  HttpStatus,
  Inject,
  Res,
  VERSION_NEUTRAL,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import type { Pool } from 'pg';
import { z } from 'zod';
import { DrinkCatalog } from '../../drinks/application/drink-catalog.js';
import type { DrinkSource } from '../../drinks/application/ports/drink-source.port.js';
import { DRINK_SOURCE } from '../../drinks/infrastructure/tokens.js';
import { APP_NAME, APP_VERSION } from '../../shared/infrastructure/app-info.js';
import { PG_POOL } from '../../shared/infrastructure/database/database.module.js';
import { ApiResponseFrom } from '../../shared/infrastructure/http/openapi.js';

type Check = {
  status: 'up' | 'down';
  latencyMs?: number;
  [detail: string]: unknown;
};

const checkSchema = z
  .object({
    status: z.enum(['up', 'down']),
    latencyMs: z.number().int().optional(),
  })
  .catchall(z.unknown())
  .meta({ id: 'HealthCheck' });

const livenessSchema = z
  .object({
    status: z.literal('ok'),
    service: z.string().meta({ example: APP_NAME }),
    version: z.string(),
    uptimeSeconds: z.number().int(),
    timestamp: z.string(),
  })
  .meta({ id: 'Liveness' });

const readinessSchema = z
  .object({
    status: z.enum(['ok', 'degraded']),
    service: z.string(),
    version: z.string(),
    timestamp: z.string(),
    checks: z.object({
      database: checkSchema,
      theCocktailDb: checkSchema.optional().meta({
        description: 'Only with CATALOG_SOURCE=cocktaildb',
      }),
      catalog: checkSchema,
    }),
  })
  .meta({ id: 'Readiness' });

const timed = async (probe: () => Promise<unknown>): Promise<Check> => {
  const started = performance.now();
  try {
    await probe();
    return { status: 'up', latencyMs: Math.round(performance.now() - started) };
  } catch {
    return { status: 'down' };
  }
};

@ApiTags('Health')
@Controller({ path: 'health', version: VERSION_NEUTRAL })
export class HealthController {
  constructor(
    @Inject(PG_POOL) private readonly pool: Pool,
    @Inject(DRINK_SOURCE) private readonly source: DrinkSource | null,
    private readonly catalog: DrinkCatalog,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'Liveness',
    description: 'The process is up. Never calls external services.',
  })
  @ApiResponseFrom(200, livenessSchema, 'Alive')
  live() {
    return {
      status: 'ok',
      service: APP_NAME,
      version: APP_VERSION,
      uptimeSeconds: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
    };
  }

  @Get('ready')
  @ApiOperation({
    summary: 'Readiness',
    description:
      'Checks the database and the catalog, plus TheCocktailDB (with latency) when the catalog syncs with it.',
  })
  @ApiResponseFrom(200, readinessSchema, 'Every dependency is up')
  @ApiResponseFrom(503, readinessSchema, 'Some dependency is down')
  async ready(@Res({ passthrough: true }) res: Response) {
    const source = this.source;
    const [database, theCocktailDb, catalogStatus] = await Promise.all([
      timed(() => this.pool.query('select 1')),
      source ? timed(() => source.ping()) : undefined,
      this.catalog.status().catch(() => null),
    ]);
    const catalog: Check = catalogStatus
      ? { status: catalogStatus.size > 0 ? 'up' : 'down', ...catalogStatus }
      : { status: 'down' };

    const checks = {
      database,
      catalog,
      ...(theCocktailDb && { theCocktailDb }),
    };
    const ok = Object.values(checks).every((c) => c.status === 'up');
    res.status(ok ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE);

    return {
      status: ok ? 'ok' : 'degraded',
      service: APP_NAME,
      version: APP_VERSION,
      timestamp: new Date().toISOString(),
      checks,
    };
  }
}
