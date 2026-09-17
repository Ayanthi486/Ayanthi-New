# Hub Lanka Freight Forwarding Management System (HLFFMS)

Internal operations system for **Hub Lanka (Pvt) Ltd**, an air freight forwarder operating out of
Colombo (CMB), Sri Lanka. This is a production system for real staff — see [`CONTEXT.md`](./CONTEXT.md)
for full business context before touching any code.

**Read before contributing, in order:** [`CONTEXT.md`](./CONTEXT.md) · [`PRD.md`](./PRD.md) ·
[`ARCHITECTURE.md`](./ARCHITECTURE.md) · [`DEVELOPMENT_PLAN.md`](./DEVELOPMENT_PLAN.md) ·
[`DEVELOPMENT_RULES.md`](./DEVELOPMENT_RULES.md).

## Project overview

Hub Lanka buys cargo space from airlines and resells it to shippers, handling documentation,
security clearance, customs and airport handling in between. This system replaces a manual
process built on Excel, paper files, email and phone with one authoritative Shipment record that
drives the company's operational documents, financials and analytics.

Development proceeds in controlled, sequential phases (see `DEVELOPMENT_PLAN.md`). Each phase is
implemented, tested and reported before the next begins.

**Current status: Phase 1 — Authentication, RBAC and Audit foundation.** Real users log in;
every mutation to identity/RBAC data is audited automatically. No business modules (Shipment,
Invoice, Cost Sheet, Payments, Rate Table, Documents, Analytics) exist yet.

## Architecture at a glance

Modular monolith + one worker process (ARCHITECTURE §1). Two deployables today's phases scaffold
for: the API and the web app; the worker process arrives when background jobs are needed (Phase 7+).

```
apps/web   React 19 · Vite · TypeScript strict · Tailwind CSS v4 · shadcn/ui
apps/api   NestJS 11 · Node.js 24 · REST /api/v1 · Swagger/OpenAPI · Prisma 7
packages/shared   Zod schemas, permission keys and types shared between web and api
```

| Layer        | Choice                                                                                                                     |
| ------------ | -------------------------------------------------------------------------------------------------------------------------- |
| Frontend     | React 19 · Vite · TypeScript strict · Tailwind CSS v4 · shadcn/ui · TanStack Query/Table · Zustand · React Hook Form · Zod |
| Backend      | NestJS 11 · Node.js 24 · REST · OpenAPI/Swagger · Pino structured logging · Argon2id · JWT                                 |
| Database     | PostgreSQL 17 · Prisma 7 · a PostgreSQL trigger for automatic audit capture (see below)                                    |
| Repo tooling | pnpm workspaces · Turborepo                                                                                                |

Full rationale in [`ARCHITECTURE.md`](./ARCHITECTURE.md).

**Identity, RBAC and audit (Phase 1).** Three fixed roles (Executive, Manager, Director), a
database-backed permission matrix (`user ─< user_role >─ role ─< role_permission >─ permission`),
Argon2id password hashing, a rotating opaque refresh token in an httpOnly/Secure/SameSite=Strict
cookie, and account lockout after repeated failures. Every mutation to `user`/`role`/`permission`/
`user_role`/`role_permission` is captured automatically by a **PostgreSQL trigger** — not a Prisma
Client extension, which was tried first and empirically failed to propagate actor context through
`update`/`delete` reliably (see the trigger migration's own comment,
`apps/api/prisma/migrations/*_audit_capture_triggers`, for the full account). `audit_log` itself is
append-only: the application's runtime database role (`APP_DATABASE_URL`) has no `UPDATE`/`DELETE`
grant on it at the database level — a separate, privileged role (`DATABASE_URL`) is used only for
running migrations, never by the running application.

## Prerequisites

- **Node.js 24 LTS** — an `.nvmrc` is provided (`nvm use`)
- **pnpm 9+** — enable via Corepack: `corepack enable && corepack prepare pnpm@9.15.9 --activate`
- **Docker** (for PostgreSQL, and optionally the full containerised stack)
- **PostgreSQL 17** — either via `docker compose` or a local install

## Setup

```bash
git clone <repo-url>
cd "Hub lanka"
corepack enable
pnpm install

cp .env.example .env
# edit .env — set real values for JWT_ACCESS_SECRET / JWT_REFRESH_SECRET (32+ chars each)

docker compose up -d postgres
pnpm db:migrate
pnpm db:seed
pnpm dev
```

The single root `.env` covers both apps: the API falls back to it when no `apps/api/.env` exists,
and Vite reads it directly (`envDir` points at the repo root). The Docker Postgres container
publishes on host port **5433**, not 5432 — this avoids colliding with a PostgreSQL instance
already installed natively on some developer machines. Container-to-container traffic (the `api`
service inside `docker compose`) still talks to `postgres:5432` on the internal Docker network,
unaffected by the host-side remap.

`pnpm db:seed` creates the three roles, the full PRD §4 permission matrix, and one **dev-only**
account per role (not a production seeding default — see `apps/api/prisma/seed.ts`):

| Email                    | Password          | Role      |
| ------------------------ | ----------------- | --------- |
| `executive@hublanka.dev` | `DevPassword123!` | Executive |
| `manager@hublanka.dev`   | `DevPassword123!` | Manager   |
| `director@hublanka.dev`  | `DevPassword123!` | Director  |

- API: http://localhost:3000/api/v1
- API Swagger docs (when `SWAGGER_ENABLED=true`): http://localhost:3000/api/v1/docs
- Health check: http://localhost:3000/healthz
- Web app: http://localhost:5173 — sign in with one of the seeded accounts above

## Environment configuration

Copy [`.env.example`](./.env.example) to `.env` and fill in real values. **Never commit `.env`.**
Secrets belong in the deployment platform's secret manager in staging/production.

The backend validates all environment variables with Zod at boot (`apps/api/src/config/env.validation.ts`)
and refuses to start on an invalid or missing value — fail fast, per `ARCHITECTURE.md` §24.

`NODE_ENV` distinguishes `development` / `test` / `production`; behaviour that must differ (Swagger
exposure, log formatting, login/refresh rate limiting) branches on this value rather than a
separate config file per environment.

Two separate database connection strings, deliberately:

- **`DATABASE_URL`** — the privileged/migration role. Used only by `prisma.config.ts` and the CLI
  (`prisma migrate ...`). Never used by the running application.
- **`APP_DATABASE_URL`** — the restricted role the application actually connects as. Has no
  `UPDATE`/`DELETE` grant on `audit_log` at the database level.

## Development commands

Run from the repository root (Turborepo fans these out to the right workspace):

| Command                             | Description                                                             |
| ----------------------------------- | ----------------------------------------------------------------------- |
| `pnpm dev`                          | Start the API, web app, and `packages/shared`'s watch build in parallel |
| `pnpm lint`                         | ESLint across all workspaces                                            |
| `pnpm lint:fix`                     | ESLint with auto-fix                                                    |
| `pnpm typecheck`                    | TypeScript strict typecheck, all workspaces                             |
| `pnpm format` / `pnpm format:check` | Prettier write / check                                                  |
| `pnpm db:generate`                  | Regenerate the Prisma client (`apps/api`)                               |
| `pnpm db:migrate`                   | Create/apply a dev migration (`apps/api`)                               |
| `pnpm db:seed`                      | Seed roles, permissions and dev-only accounts (`apps/api`)              |
| `pnpm db:studio`                    | Open Prisma Studio                                                      |

`packages/shared`'s `package.json` points `main`/`types` at its **built** `dist/` output, not TS
source — the compiled API (`node dist/main.js`, no TS loader) needs plain JavaScript to `require`.
`pnpm dev` runs `packages/shared`'s `tsc --watch` alongside the API/web dev servers so edits to
shared schemas still propagate live; a cold `pnpm dev` start may briefly fail to resolve
`@hub-lanka/shared` until that first watch compile finishes (a few seconds) — this is a normal,
self-resolving monorepo watch-mode race, not a bug to chase.

## Test commands

| Command                                 | Description                                                                    |
| --------------------------------------- | ------------------------------------------------------------------------------ |
| `pnpm test`                             | Unit tests across all workspaces (Vitest)                                      |
| `pnpm test:watch`                       | Unit tests in watch mode                                                       |
| `pnpm --filter @hub-lanka/api test:e2e` | Backend e2e suite (Supertest against a running Nest instance, real PostgreSQL) |

The e2e suite (`apps/api/test/*.e2e-spec.ts`) needs a reachable Postgres at `APP_DATABASE_URL`/
`DATABASE_URL` (`docker compose up -d postgres`, migrated and seeded) and runs its files
sequentially, not in parallel — they share that one database and mutate common state (lockout
counters, throttle windows). One spec (`audit-log-grants.e2e-spec.ts`) spins up its own **isolated
Postgres via Testcontainers** — the one place this phase needs it, to connect as the actual
restricted database role and assert a real SQL permission-denied error proving the audit-log grant
restriction, rather than a mock or the shared instance.

Testing conventions (full detail in `ARCHITECTURE.md` §18 and `DEVELOPMENT_RULES.md` §8): Vitest for
unit and integration tests, Supertest for API e2e, Testcontainers where a real, isolated Postgres is
specifically needed, Playwright for cross-role E2E from Phase 10. 100% coverage is required on money
and weight calculation once those exist; none exist yet.

## Build commands

| Command                     | Description                                                                       |
| --------------------------- | --------------------------------------------------------------------------------- |
| `pnpm build`                | Production build, all workspaces (via Turborepo — builds `packages/shared` first) |
| `docker compose up --build` | Build and run the full stack (Postgres, Redis, API, web) in containers            |

## Docker development environment

`docker-compose.yml` provisions:

- **postgres** — PostgreSQL 17, host port **5433** (see Setup above)
- **redis** — provisioned per `DEVELOPMENT_PLAN.md` Phase 0 scope for the worker process introduced
  from Phase 7 onward; no host port published (nothing outside the Docker network needs it yet, and
  publishing one risks colliding with an unrelated project's own Redis on a shared dev machine) —
  reachable internally as `redis:6379` once something uses it
- **api** — the NestJS API, built from `apps/api/Dockerfile`; the container entrypoint runs
  `prisma migrate deploy` (as the privileged role) before starting the app (as the restricted role)
- **web** — the built React app served via `vite preview`, built from `apps/web/Dockerfile`

Both Dockerfiles build via `pnpm exec turbo run build --filter=<pkg>...` (not a plain
`pnpm --filter <pkg> build`) so `packages/shared` builds first — see the Development commands note
above on why that matters.

Seeding is **not** run automatically by the container entrypoint (re-running it on every restart
isn't the right default even though it's idempotent) — run it once after the stack is up:

```bash
docker compose up -d
docker compose exec api pnpm --filter @hub-lanka/api db:seed
```

For day-to-day development, running `postgres`/`redis` in Docker and `api`/`web` locally via
`pnpm dev` gives faster iteration than rebuilding containers on every change:

```bash
docker compose up -d postgres redis
pnpm dev
```

## Sharing a portable local build with another developer

`docker-compose.local.yml` runs the **complete** system (Postgres, Redis, API, worker, web) with
every value defaulted inside the file itself — no `.env` to create, no domain, no registry. This is
for handing the project to another developer to run entirely on their own machine; it is a separate
file from `docker-compose.prod.yml` (a real production deployment) and is not meant for one.

```bash
git clone <repo-url>
cd "Hub lanka"
docker compose -f docker-compose.local.yml up -d --build
```

That single command builds the images, starts Postgres/Redis, runs migrations, seeds roles/
permissions/dev-only accounts, then starts the API, worker and web app — Postgres and Redis are
**not** published to the host (only reachable from other containers on the compose network), per
the same posture as `docker-compose.prod.yml`.

| What                       | URL / command                                                         |
| -------------------------- | ---------------------------------------------------------------------- |
| Web app                    | http://localhost:8080 — sign in with a seeded account (see Setup above)|
| API                        | http://localhost:3000/api/v1                                           |
| API Swagger docs           | http://localhost:3000/api/v1/docs                                      |
| Health check                | http://localhost:3000/healthz                                          |
| Check container status     | `docker compose -f docker-compose.local.yml ps`                        |
| View logs (all services)   | `docker compose -f docker-compose.local.yml logs -f`                   |
| View logs (one service)    | `docker compose -f docker-compose.local.yml logs -f api`               |
| Stop the stack              | `docker compose -f docker-compose.local.yml down`                      |
| Reset the local database    | `docker compose -f docker-compose.local.yml down -v` (also wipes uploaded receipts/avatars — both live in named Docker volumes scoped to this compose file only) |

To change a default (e.g. a port already in use on your machine), copy `.env.local.example` to
`.env` in the repo root and edit it — Docker Compose loads `.env` automatically regardless of which
compose file you pass via `-f`. Every credential in `.env.local.example` is a shared, publicly known
local-only placeholder (the same convention `docker-compose.yml`/`.env.example` already use) — never
a real secret, and never the same values as `.env.production`/`.env.production.example`, which this
workflow never reads or needs. No `docker login` is required — this workflow builds images locally
from source and never pulls from or pushes to a registry.

Because everything runs in named volumes scoped to this compose file (`docker-compose.local.yml`),
a fresh clone on a different machine never depends on your local containers, volumes, database
data, `.env`/`.env.production`, or any machine-specific path.

## Project structure

```
apps/
  api/          NestJS 11 REST API
    src/
      config/       environment validation (Zod)
      common/       error hierarchy, global exception filter
      health/       /healthz — liveness + database connectivity
      prisma/       PrismaService (connection lifecycle, restricted role)
      identity/     auth (login/refresh/logout/me), users, roles, guards, decorators
      audit/        AuditService — sets actor context for the DB trigger; explicit semantic events
    prisma/
      schema.prisma  user/role/permission/user_role/role_permission/refresh_token/audit_log —
                      no business tables yet
      migrations/     identity_rbac_audit · restrict_audit_log_grants · audit_capture_triggers
      seed.ts         roles, permissions, dev-only accounts (idempotent)
    prisma.config.ts  Prisma 7 connection config (schema.prisma no longer holds a datasource URL)
    src/generated/    Prisma client — generated, gitignored, never edited by hand
  web/          React 19 SPA
    src/
      app/            providers (auth bootstrap), layout, router entry, ProtectedRoute, RequirePermission
      components/ui/  shadcn/ui primitives
      features/auth/  login page, auth API client, useLogin
      features/users/ minimal user administration screen (identity.user.manage only)
      lib/            API client (Bearer + silent-refresh-on-401), auth store (Zustand, in-memory), utilities
packages/
  shared/       Zod schemas, permission keys, and types shared between apps/api and apps/web
.github/workflows/ci.yml   install → lint → typecheck → test → build
docker-compose.yml          postgres · redis · api · web
```

## Phase status

Twelve controlled vertical phases — see `DEVELOPMENT_PLAN.md` for the full breakdown and
`REQUIREMENTS_TRACEABILITY.md` for the requirement-to-phase-to-test mapping.

- [x] **Phase 0 — Foundation.** Monorepo, frontend/backend shells, database connection and migration
      tooling, logging, health check, error handling, configuration, code quality tooling, testing
      foundation, Docker development environment, CI.
- [x] **Phase 1 — Authentication, RBAC and Audit foundation.** Argon2id login/refresh/logout,
      JwtAuthGuard + fail-closed PermissionsGuard, `/me`, automatic audit capture (DB trigger),
      account lockout, seeded role/permission matrix, minimal user administration, frontend auth
      context and protected routes. _(this phase)_
- [ ] Phase 2 — Shipment Core
- [ ] Phase 3 — Cargo Handling, Master Data and Rate Table
- [ ] Phase 4 — Cost Sheet
- [ ] Phase 5 — Invoice
- [ ] Phase 6 — Payments
- [ ] Phase 7 — Documents, PDF generation and printing
- [ ] Phase 8 — Tracking and Cut-off
- [ ] Phase 9 — Analytics and Reports
- [ ] Phase 10 — Hardening, Security and E2E
- [ ] Phase 11 — Deployment, UAT and Production Readiness

No business rule, workflow or data model beyond infrastructure and identity/RBAC is implemented
yet. Do not treat anything in `apps/api`/`apps/web` as a source of confirmed business behaviour
until the relevant phase ships — `PRD.md` is that source.
