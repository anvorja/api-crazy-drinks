import { Controller, Get, VERSION_NEUTRAL } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { APP_NAME, APP_VERSION } from '../app-info.js';
import { ApiResponseFrom } from './openapi.js';
import { OPENAPI_JSON_PATH, OPENAPI_UI_PATH } from './setup-openapi.js';

const indexSchema = z
  .object({
    name: z.string(),
    version: z.string(),
    tagline: z.string(),
    docs: z.object({ ui: z.string(), openapi: z.string() }),
    source: z.string(),
    attribution: z
      .string()
      .meta({ description: 'Show it wherever you display drinks' }),
  })
  .meta({ id: 'ApiIndex' });

@ApiTags('Health')
@Controller({ version: VERSION_NEUTRAL })
export class IndexController {
  @Get()
  @ApiOperation({
    summary: 'API index',
    description: 'Name, version and where the docs live.',
  })
  @ApiResponseFrom(200, indexSchema, 'Index')
  index() {
    return {
      name: APP_NAME,
      version: APP_VERSION,
      tagline:
        'No te decimos qué tomar: te decimos quién eres cuando lo tomas.',
      docs: { ui: `/${OPENAPI_UI_PATH}`, openapi: `/${OPENAPI_JSON_PATH}` },
      source: 'https://www.thecocktaildb.com',
      attribution:
        'Recipe data and imagery: TheCocktailDB (https://www.thecocktaildb.com/)',
    };
  }
}
