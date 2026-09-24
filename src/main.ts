import { ConsoleLogger, Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module.js';
import { APP_NAME } from './shared/infrastructure/app-info.js';
import { ENV } from './shared/infrastructure/config/config.module.js';
import {
  Env,
  loadEnvFile,
  parseEnv,
} from './shared/infrastructure/config/env.js';
import { configureApp } from './shared/infrastructure/http/configure-app.js';
import {
  OPENAPI_UI_PATH,
  setupOpenApi,
} from './shared/infrastructure/http/setup-openapi.js';

async function bootstrap() {
  loadEnvFile();
  const { LOG_FORMAT, LOG_LEVEL } = parseEnv();
  const levels = ['fatal', 'error', 'warn', 'log', 'debug', 'verbose'] as const;
  const consoleLogger = new ConsoleLogger({
    json: LOG_FORMAT === 'json',
    logLevels: levels.slice(0, levels.indexOf(LOG_LEVEL) + 1),
  });
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: consoleLogger,
  });
  const env = app.get<Env>(ENV);

  configureApp(app, env);
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
