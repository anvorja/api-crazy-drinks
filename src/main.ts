import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module.js';
import { APP_NAME } from './shared/infrastructure/app-info.js';
import { ENV } from './shared/infrastructure/config/config.module.js';
import { Env, loadEnvFile } from './shared/infrastructure/config/env.js';
import {
  OPENAPI_UI_PATH,
  setupOpenApi,
} from './shared/infrastructure/http/setup-openapi.js';

async function bootstrap() {
  loadEnvFile();
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const env = app.get<Env>(ENV);

  app.set('trust proxy', env.TRUST_PROXY);
  app.enableCors({
    exposedHeaders: [
      'Retry-After',
      'X-RateLimit-Limit',
      'X-RateLimit-Remaining',
      'X-RateLimit-Reset',
    ],
  });
  app.enableShutdownHooks();
  if (env.OPENAPI_ENABLED) setupOpenApi(app);

  await app.listen(env.PORT);
  const logger = new Logger('Bootstrap');
  logger.log(`${APP_NAME} listening on http://localhost:${env.PORT}`);
  if (env.OPENAPI_ENABLED)
    logger.log(
      `OpenAPI docs on http://localhost:${env.PORT}/${OPENAPI_UI_PATH}`,
    );
}
await bootstrap();
