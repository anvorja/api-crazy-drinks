import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { APP_NAME, APP_VERSION } from '../app-info.js';
import { API_KEY_AUTH, BEARER_AUTH, openApiComponents } from './openapi.js';

export const OPENAPI_UI_PATH = 'docs';
export const OPENAPI_JSON_PATH = 'docs/openapi.json';

const DESCRIPTION = `
API de bebidas y cocteles sobre TheCocktailDB: despensa inteligente, cocteles por estado de ánimo,
ADN de sabor, gemelos y carta inteligente para bares.

**Autenticación**
- Apps propias: \`Authorization: Bearer <accessToken>\` (ver /auth/login).
- Integraciones de terceros: \`X-API-Key: <key>\` (ver /me/api-keys). Cuentan contra la cuota diaria del plan
  y responden con los headers \`X-RateLimit-Limit\`, \`X-RateLimit-Remaining\` y \`X-RateLimit-Reset\`.

**Verificación de edad**: las bebidas con alcohol solo se muestran a usuarios autenticados mayores de 18 años.
`;

export function setupOpenApi(app: INestApplication): void {
  const config = new DocumentBuilder()
    .setTitle(APP_NAME)
    .setVersion(APP_VERSION)
    .setDescription(DESCRIPTION)
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      BEARER_AUTH,
    )
    .addApiKey(
      { type: 'apiKey', in: 'header', name: 'X-API-Key' },
      API_KEY_AUTH,
    )
    .build();

  const document = SwaggerModule.createDocument(app, config);
  document.components = {
    ...document.components,
    schemas: { ...document.components?.schemas, ...openApiComponents() },
  };
  SwaggerModule.setup(OPENAPI_UI_PATH, app, document, {
    jsonDocumentUrl: OPENAPI_JSON_PATH,
    customSiteTitle: `${APP_NAME} · OpenAPI`,
  });
}
