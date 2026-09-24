import { applyDecorators } from '@nestjs/common';
import {
  ApiBody,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiSecurity,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { z, ZodType } from 'zod';

/**
 * zod schemas (the DTOs) are the single source of truth: they validate requests and,
 * through these helpers, document them. Schemas with `.meta({ id })` become named
 * components under #/components/schemas.
 */
/** OpenAPI 3.0 schema object (@nestjs/swagger doesn't export its type publicly). */
type SchemaObject = Record<string, any>;

const components = new Map<string, SchemaObject>();

export const BEARER_AUTH = 'bearer';
export const API_KEY_AUTH = 'apiKey';

export function toOpenApiSchema(
  schema: ZodType,
  io: 'input' | 'output',
): SchemaObject {
  const json = z.toJSONSchema(schema, {
    target: 'openapi-3.0',
    io,
    unrepresentable: 'any',
  }) as Record<string, unknown>;
  const { definitions, ...rest } = json;
  const relink = <T>(value: T): T =>
    JSON.parse(
      JSON.stringify(value).replaceAll(
        '#/definitions/',
        '#/components/schemas/',
      ),
    );

  for (const [name, definition] of Object.entries(
    (definitions ?? {}) as Record<string, object>,
  )) {
    components.set(name, relink(definition) as SchemaObject);
  }
  delete rest.$schema;
  return relink(rest) as SchemaObject;
}

export const openApiComponents = (): Record<string, SchemaObject> =>
  Object.fromEntries(components);

/** Request body documented from its zod schema. */
export const ApiBodyFrom = (schema: ZodType, description?: string) =>
  ApiBody({ schema: toOpenApiSchema(schema, 'input'), description });

/** Each property of a zod object becomes a documented query parameter. */
export function ApiQueryFrom(schema: z.ZodObject) {
  const json = toOpenApiSchema(schema, 'input');
  const required: string[] = json.required ?? [];
  return applyDecorators(
    ...Object.entries<SchemaObject>(json.properties ?? {}).map(
      ([name, property]) =>
        ApiQuery({
          name,
          required: required.includes(name),
          schema: property,
          description: property.description,
        }),
    ),
  );
}

export const ApiParamFrom = (
  name: string,
  schema: ZodType,
  description: string,
) => ApiParam({ name, schema: toOpenApiSchema(schema, 'input'), description });

export const ApiResponseFrom = (
  status: number,
  schema: ZodType | null,
  description: string,
) =>
  ApiResponse(
    schema
      ? { status, description, schema: toOpenApiSchema(schema, 'output') }
      : { status, description },
  );

export const errorResponseSchema = z
  .object({
    statusCode: z.number().int().meta({ example: 400 }),
    message: z
      .union([z.string(), z.array(z.string())])
      .meta({ example: 'Invalid email address' }),
    error: z.string().meta({ example: 'ValidationError' }),
  })
  .meta({
    id: 'ErrorResponse',
    description: 'Every error response has this shape.',
  });

const ERROR_DESCRIPTIONS: Record<number, string> = {
  400: 'Invalid input (params, query or body).',
  401: 'Missing, invalid or expired credentials.',
  402: 'The current plan does not include this. Upgrade the subscription.',
  403: 'Not allowed: role, ownership or age restriction.',
  404: 'Resource not found.',
  409: 'Conflict with existing data.',
  429: 'Too many requests. See the Retry-After header.',
  503: 'A dependency (TheCocktailDB) is unavailable.',
};

/** Documents the error responses an endpoint may return. */
export const ApiErrors = (...statuses: (keyof typeof ERROR_DESCRIPTIONS)[]) =>
  applyDecorators(
    ...statuses.map((status) =>
      ApiResponseFrom(status, errorResponseSchema, ERROR_DESCRIPTIONS[status]),
    ),
  );

/** Endpoint needs a JWT access token. */
export const ApiBearer = () =>
  applyDecorators(ApiBearerAuth(BEARER_AUTH), ApiErrors(401));

/** Endpoint needs a JWT or an API key. */
export const ApiBearerOrApiKey = () =>
  applyDecorators(
    ApiBearerAuth(BEARER_AUTH),
    ApiSecurity(API_KEY_AUTH),
    ApiErrors(401, 429),
  );

/** Anonymous access works; a JWT or API key unlocks more (e.g. alcoholic drinks for adults). */
export const ApiOptionalAuth = () =>
  applyDecorators(
    ApiSecurity({}),
    ApiBearerAuth(BEARER_AUTH),
    ApiSecurity(API_KEY_AUTH),
    ApiErrors(401, 429),
  );
