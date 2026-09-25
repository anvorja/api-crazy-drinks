# syntax=docker/dockerfile:1

# ---- base: Node + pnpm (version pinned by "packageManager" in package.json)
FROM node:24-alpine AS base
RUN corepack enable
WORKDIR /app

# ---- deps: every dependency, cached while the lockfile doesn't change
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

# ---- build: compile and keep only production dependencies
FROM deps AS build
COPY tsconfig.json tsconfig.build.json nest-cli.json ./
COPY src ./src
RUN pnpm build && pnpm prune --prod

# ---- runtime: small, non-root. Configuration comes from environment variables at run time.
FROM node:24-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --chown=node:node package.json ./
COPY --chown=node:node drizzle ./drizzle
# Fonts for the shareable taste cards (see assets/fonts/LICENSE-DejaVu.txt)
COPY --chown=node:node assets ./assets
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
USER node

# Documentation only: the real port is the PORT variable.
EXPOSE 8090
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:' + process.env.PORT + '/health').then((r) => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

# Migrations: docker run ... node dist/shared/infrastructure/database/migrate.js
CMD ["node", "dist/main.js"]
