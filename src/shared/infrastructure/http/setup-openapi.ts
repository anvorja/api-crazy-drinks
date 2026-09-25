import { INestApplication } from '@nestjs/common';
import {
  DocumentBuilder,
  type OpenAPIObject,
  SwaggerModule,
} from '@nestjs/swagger';
import { APP_NAME, APP_VERSION } from '../app-info.js';
import { API_KEY_AUTH, BEARER_AUTH, openApiComponents } from './openapi.js';

export const OPENAPI_UI_PATH = 'docs';
export const OPENAPI_JSON_PATH = 'docs/openapi.json';

const DESCRIPTION = `
API de bebidas y cocteles sobre TheCocktailDB: despensa inteligente, cocteles por estado de ánimo,
ADN de sabor, gemelos y carta inteligente para bares.

**Versión**: todas las rutas van bajo \`/v1\`, salvo \`/health\`, \`/health/ready\` y \`/\`.

**Errores**: todos tienen la forma \`{ statusCode, code, message, error, details? }\`. El frontend decide por \`code\`
(estable) y muestra su propio texto; \`message\` es solo una pista en inglés.

**Autenticación**
- Apps propias: \`Authorization: Bearer <accessToken>\` (ver /v1/auth/login). En navegador, el refresh token
  viaja en una cookie httpOnly: haz las peticiones de /v1/auth con credentials: 'include'.
- Integraciones de bares (carta, inventario): \`X-API-Key: <key>\` (ver /v1/me/api-keys). Cuentan contra la cuota
  diaria del plan y responden con los headers \`X-RateLimit-Limit\`, \`X-RateLimit-Remaining\` y \`X-RateLimit-Reset\`.

**Fuente de datos**: recetas e imágenes de [TheCocktailDB](https://www.thecocktaildb.com/), congeladas en una
migración (el catálogo no llama a su API). Todo frontend que muestre bebidas debe mostrar "Datos e imágenes:
TheCocktailDB" con un enlace a su sitio (condición de su uso).

**Qué se cobra**: los datos de las bebidas son gratis y abiertos, sin cuenta ni API key. Los planes pagos (Wompi)
cubren solo funciones propias de api-drinks: bares, inventario, carta con costos y márgenes, y API keys para
integrar bares.

**Verificación de edad**: las bebidas con alcohol solo se muestran a usuarios autenticados mayores de 18 años.
`;

/** The OpenAPI document of the app (the same one /docs serves and openapi/openapi.json holds). */
export function createOpenApiDocument(app: INestApplication): OpenAPIObject {
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
  return document;
}

export function setupOpenApi(app: INestApplication): void {
  SwaggerModule.setup(OPENAPI_UI_PATH, app, createOpenApiDocument(app), {
    jsonDocumentUrl: OPENAPI_JSON_PATH,
    customSiteTitle: `${APP_NAME} · OpenAPI`,
  });
}
