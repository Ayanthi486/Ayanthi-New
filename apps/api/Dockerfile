# syntax=docker/dockerfile:1
#
# Production image for the Hub Lanka API. Builds two final targets from one
# shared pipeline (ARCHITECTURE §1 — "two deployables, not one, not twelve"):
#   docker build --target api    -t hub-lanka-api    .
#   docker build --target worker -t hub-lanka-worker .
# (build context must be the MONOREPO ROOT, not this directory, so the
# workspace's other packages — @hub-lanka/shared in particular — are
# visible: `docker build -f apps/api/Dockerfile .`)
#
# Uses Prisma's driver-adapter mode (@prisma/adapter-pg, see
# prisma/prisma.service.ts) rather than the traditional Rust query engine,
# so there is no native query-engine binary to worry about matching to this
# base image's libc — the generated client is plain TypeScript/JavaScript.

ARG NODE_VERSION=24
ARG PNPM_VERSION=9.15.9

# ---------------------------------------------------------------------------
# base — pnpm available, nothing workspace-specific yet (maximises layer reuse)
# ---------------------------------------------------------------------------
FROM node:${NODE_VERSION}-slim AS base
ARG PNPM_VERSION
RUN corepack enable && corepack prepare pnpm@${PNPM_VERSION} --activate
WORKDIR /repo

# ---------------------------------------------------------------------------
# deps — install the FULL workspace's dependencies. pnpm resolves against
# the whole lockfile even to build one package, so every workspace
# package.json must be present, but source code isn't copied yet — this
# layer only invalidates when a manifest or the lockfile actually changes.
# ---------------------------------------------------------------------------
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY apps/e2e/package.json apps/e2e/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN pnpm install --frozen-lockfile

# ---------------------------------------------------------------------------
# build — compile @hub-lanka/shared then @hub-lanka/api
# ---------------------------------------------------------------------------
FROM deps AS build
COPY . .
# `prisma generate` only needs a syntactically valid connection string to
# resolve the datasource provider — it never contacts a database at build
# time. The REAL DATABASE_URL/APP_DATABASE_URL are read at container start
# (see the api/worker stages' runtime environment below), not baked in here.
ARG DATABASE_URL=postgresql://build:build@localhost:5432/build
RUN pnpm --filter @hub-lanka/shared build \
  && pnpm --filter @hub-lanka/api exec prisma generate \
  && pnpm --filter @hub-lanka/api build

# pnpm's own mechanism for producing a deployable subset of a monorepo:
# prunes to exactly @hub-lanka/api's production dependency graph, inlining
# its @hub-lanka/shared workspace dependency, so the runtime image isn't
# the whole repo plus every devDependency.
RUN pnpm --filter @hub-lanka/api deploy --prod /out/api

# ---------------------------------------------------------------------------
# migrate — one-shot release step: `prisma migrate deploy` against the real
# production database. Runs before api/worker start (docker-compose.prod.yml).
# `prisma` itself is a devDependency (package.json) — pruned out of the
# api/worker images' `--prod` deploy — so this target runs from the full
# `build` stage instead, which still has it, rather than the pruned output.
# ---------------------------------------------------------------------------
FROM build AS migrate
WORKDIR /repo/apps/api
ENTRYPOINT ["pnpm", "exec", "prisma", "migrate", "deploy"]

# ---------------------------------------------------------------------------
# seed — one-shot step for non-production environments only (roles,
# permissions, dev-only accounts — see prisma/seed.ts). Not used by
# docker-compose.prod.yml; docker-compose.local.yml runs this after
# `migrate` so a fresh local clone has working login credentials without a
# manual step. Same reasoning as `migrate` for building from `build` rather
# than a pruned runtime stage: `tsx` is a devDependency.
# ---------------------------------------------------------------------------
FROM build AS seed
WORKDIR /repo/apps/api
ENTRYPOINT ["pnpm", "db:seed"]

# ---------------------------------------------------------------------------
# api — the HTTP server (main.ts)
# ---------------------------------------------------------------------------
FROM node:${NODE_VERSION}-slim AS api
# dumb-init: forwards SIGTERM/SIGINT to node as PID 1 so Nest's own
# shutdown hooks and the orchestrator's stop timeout behave as expected
# (Docker/Kubernetes send signals to PID 1 only).
RUN apt-get update \
  && apt-get install -y --no-install-recommends dumb-init \
  && rm -rf /var/lib/apt/lists/*
RUN useradd --system --uid 1001 --create-home hublanka
WORKDIR /app
COPY --from=build --chown=hublanka:hublanka /out/api ./
COPY --from=build --chown=hublanka:hublanka /repo/apps/api/dist ./dist
USER hublanka
ENV NODE_ENV=production
EXPOSE 3000
# /healthz is deliberately unauthenticated and outside /api/v1 (main.ts) —
# safe for a container orchestrator's own liveness/readiness probe.
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "require('http').get({host:'127.0.0.1',port:process.env.API_PORT||3000,path:'/healthz'},r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/main.js"]

# ---------------------------------------------------------------------------
# worker — the BullMQ/Puppeteer document-render process (worker-main.ts),
# ARCHITECTURE §1's second deployable. Needs a real Chromium; installs the
# apt package instead of Puppeteer's own ~200MB bundled download.
# ---------------------------------------------------------------------------
FROM node:${NODE_VERSION}-slim AS worker
RUN apt-get update \
  && apt-get install -y --no-install-recommends \
       chromium dumb-init fonts-liberation \
  && rm -rf /var/lib/apt/lists/*
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
RUN useradd --system --uid 1001 --create-home hublanka
WORKDIR /app
COPY --from=build --chown=hublanka:hublanka /out/api ./
COPY --from=build --chown=hublanka:hublanka /repo/apps/api/dist ./dist
USER hublanka
ENV NODE_ENV=production
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/worker-main.js"]
