import { loadEnvFile, parseDatabaseEnv } from '../config/env.js';
import { runMigrations } from './run-migrations.js';

/** CLI: `node dist/shared/infrastructure/database/migrate.js` (pnpm db:migrate:prod). */
loadEnvFile();
await runMigrations(parseDatabaseEnv());
