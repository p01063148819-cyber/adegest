# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

AdeGest — inventory management system for adegas (wine/liquor shops): product catalog, real-time sales, restock alerts, and analytics reporting. UI is in Portuguese (pt-BR); currency is formatted as R$ (Real Brasileiro).

## Commands

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080)
- `pnpm --filter @workspace/adegest run dev` — run the web frontend (port 24957)
- `pnpm run typecheck` — full typecheck across all packages (runs `tsc --build` for libs, then per-package typecheck for artifacts/scripts)
- `pnpm run build` — typecheck + build all packages; builds the frontend (`@workspace/adegest`) before the API server, since the API server's build copies the frontend's `dist/public` into its own `dist/public` to serve it
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks (`lib/api-client-react`) and Zod schemas (`lib/api-zod`) from the OpenAPI spec; always run this after editing `lib/api-spec/openapi.yaml`
- `pnpm --filter @workspace/db run push` — push Drizzle schema changes to Postgres (dev only); use `push-force` if a data-loss confirmation is blocking a push you intend
- Required env: `DATABASE_URL` — Postgres connection string

There is no test suite or lint script configured in this repo; typecheck is the primary correctness gate.

## Architecture

This is a pnpm workspace with two kinds of packages: `lib/*` (shared libraries, TS project references) and `artifacts/*` (deployable apps, not part of the `tsc --build` project graph — typechecked separately via `pnpm -r --filter "./artifacts/**"`).

**Contract-first API flow:** `lib/api-spec/openapi.yaml` is the single source of truth for API contracts. Orval (`lib/api-spec/orval.config.ts`) generates two outputs from it:
- `lib/api-client-react` — React Query hooks used by the frontend (custom fetch mutator in `custom-fetch.ts`)
- `lib/api-zod` — Zod schemas used by the API server for request validation

Changing an endpoint means editing the OpenAPI spec first, then running codegen, then implementing the route handler and frontend usage against the regenerated types. Never hand-edit files under `*/src/generated/`.

**Backend** (`artifacts/api-server`): Express 5 app (`src/app.ts`) wired with pino logging, cors, and JSON body parsing. Routes live in `src/routes/` (one file per resource: categories, products, sales, stock, suppliers, reports, health) and are mounted under `/api` in `src/routes/index.ts`. Route handlers import validated Zod types from `@workspace/api-zod` and query via `@workspace/db`. Built with esbuild into a CJS-ish bundle (`build.mjs`) and run from `dist/`.

In production the API server also serves the built frontend: `build.mjs` copies `artifacts/adegest/dist/public` into `artifacts/api-server/dist/public` after bundling (failing loudly if the frontend hasn't been built yet), and `app.ts` serves it via `express.static` with a catch-all SPA fallback to `index.html` for any non-`/api` route. This means the frontend **must** be built before the API server — the root `build` script enforces that order. There is a single deployed service/port in production; the frontend's own dev server (port 24957) and `.replit-artifact` production config are dev-only now.

**Database** (`lib/db`): Drizzle ORM over Postgres. Table definitions live in `src/schema/` (categories, suppliers, products, sales, sale_items, stock_movements) and are re-exported through `src/schema/index.ts` and `src/index.ts` alongside the `db`/`pool` instances. Stock status (normal/low/critical) is computed at query time in route handlers from `stockQuantity` vs `minStock` — it is not a stored column. Sales cancellation restores stock transactionally.

**Frontend** (`artifacts/adegest`): React + Vite + Tailwind + shadcn/ui + recharts, using `wouter` for routing and `@tanstack/react-query` (via the generated `@workspace/api-client-react` hooks) for data fetching. Pages live in `src/pages/` — one per section: Dashboard (Início — KPIs, low-stock alerts), NovaVenda (POS sale flow), Vendas (sales history with date/status filters), Estoque (inventory + entrada de mercadoria), Produtos (catalog CRUD), Categorias/Fornecedores (reference data), Relatorios (daily/weekly charts).

`artifacts/mockup-sandbox` is a separate Vite/shadcn sandbox for UI mockup iteration, not part of the production app — its `vite.config.ts` requires `PORT`/`BASE_PATH` env vars unconditionally (fine for `dev`, but no defaults for a headless build), so it's excluded from the root `build` script's recursive step.

`scripts/` is a workspace package for one-off/maintenance TS scripts run via `tsx`.

## Gotchas

- `products/low-stock` must be registered before `products/:id` in Express route ordering (specificity) — see `artifacts/api-server/src/routes/products.ts`.
- `lib/api-zod/src/index.ts` must export only from `./generated/api`, not `./generated/types` — the two conflict on names. `indexFiles: false` is set for the zod orval output specifically to prevent barrel auto-generation that would clash.
- SQL raw template literals in Drizzle must reference camelCase table properties (e.g. `productsTable.stockQuantity`), not snake_case DB column names.
- `pnpm-workspace.yaml` sets `minimumReleaseAge: 1440` (packages must be published 24h before install) as a supply-chain safeguard — do not remove this; add trusted packages to `minimumReleaseAgeExclude` instead if an urgent install is blocked.
- This is a Replit-developed project (`.replit`, `replit.md`) but is deployed to Railway, not Replit Deployments — the `artifacts/*/.replit-artifact/artifact.toml` files' `[services.production]` blocks (where present) are effectively unused; ports 8080 (API) and 24957 (frontend) are only the local dev ports mapped in `.replit`.
- The frontend's Vite build reads `BASE_PATH`/`PORT` env vars unconditionally (throws if unset) — the root `build` script sets `BASE_PATH=/ PORT=24957` explicitly when building `@workspace/adegest`, since production no longer runs it as its own Replit-managed service.
