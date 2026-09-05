# syntax=docker/dockerfile:1
#
# Production image for the Hub Lanka web app — a static SPA build served by
# nginx. Build context must be the MONOREPO ROOT (so @hub-lanka/shared is
# visible): `docker build -f apps/web/Dockerfile --build-arg VITE_API_BASE_URL=https://api.example.com/api/v1 .`
#
# VITE_API_BASE_URL is a BUILD-time argument, not a runtime env var: Vite
# inlines `import.meta.env.VITE_*` into the compiled JS bundle at build
# time (vite.config.ts), so the real public API origin for this environment
# must be known when the image is built, not when the container starts —
# unlike the api/worker images, this one cannot be re-pointed at a
# different backend by changing an env var at `docker run` time.

ARG NODE_VERSION=24
ARG PNPM_VERSION=9.15.9

FROM node:${NODE_VERSION}-slim AS base
ARG PNPM_VERSION
RUN corepack enable && corepack prepare pnpm@${PNPM_VERSION} --activate
WORKDIR /repo

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY apps/e2e/package.json apps/e2e/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN pnpm install --frozen-lockfile

FROM deps AS build
COPY . .
ARG VITE_API_BASE_URL=http://localhost:3000/api/v1
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}
RUN pnpm --filter @hub-lanka/shared build \
  && pnpm --filter @hub-lanka/web build

FROM nginx:1.27-alpine AS web
COPY --from=build /repo/apps/web/dist /usr/share/nginx/html
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s --retries=3 \
  CMD wget -qO- http://127.0.0.1/ >/dev/null || exit 1
