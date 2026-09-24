import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module.js';
import { ENV } from './shared/infrastructure/config/config.module.js';
import { Env, loadEnvFile } from './shared/infrastructure/config/env.js';
import { configureApp } from './shared/infrastructure/http/configure-app.js';
import { createOpenApiDocument } from './shared/infrastructure/http/setup-openapi.js';

/** Where the versioned contract lives; the typed client is generated from it. */
const OUTPUT = 'openapi/openapi.json';

/**
 * Writes the OpenAPI document without starting the server: the app is created but never
 * initialized, so nothing connects to the database or TheCocktailDB.
 */
async function main(): Promise<void> {
  loadEnvFile();
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: false,
  });
  configureApp(app, app.get<Env>(ENV));
  const document = createOpenApiDocument(app);
  mkdirSync(dirname(OUTPUT), { recursive: true });
  writeFileSync(OUTPUT, `${JSON.stringify(document, null, 2)}\n`);
  console.log(
    `OpenAPI written to ${OUTPUT} (${Object.keys(document.paths).length} paths)`,
  );
  await app.close();
}

await main();
