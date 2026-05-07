# AdeGest

Sistema de gestão de estoque para adegas — controle de produtos, vendas em tempo real, alertas de reposição e relatórios analíticos.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080)
- `pnpm --filter @workspace/adegest run dev` — run the web frontend (port 24957)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)
- Frontend: React + Vite + Tailwind CSS + shadcn/ui + recharts

## Where things live

- `lib/api-spec/openapi.yaml` — OpenAPI spec (source of truth for all API contracts)
- `lib/db/src/schema/` — Drizzle table definitions (categories, suppliers, products, sales, sale_items, stock_movements)
- `artifacts/api-server/src/routes/` — Express route handlers
- `artifacts/adegest/src/` — React frontend (pages, components, hooks)

## Architecture decisions

- Contract-first API: OpenAPI spec gates codegen which gates frontend hooks
- `lib/api-zod/src/index.ts` exports only from `./generated/api` (not types) to avoid name conflicts between Zod schemas and TypeScript types
- `indexFiles: false` in orval.config.ts for the zod output to prevent barrel auto-generation
- Stock status (normal/low/critical) is computed at query time in the route handlers, not stored in DB
- Sales cancellation restores stock transactionally

## Product

- **Dashboard (Início):** KPIs, stock value, low-stock alerts, "Produtos para Repor" table
- **Nova Venda:** Fast-flow POS for registering sales with product search, quantities, discounts, payment method
- **Vendas:** Sales history with filter by date/status, sale detail, cancel action
- **Estoque:** Inventory panel with stock status badges, entrada de mercadoria
- **Produtos:** Product catalog CRUD with category/supplier links
- **Categorias / Fornecedores:** Reference data management
- **Relatórios:** Daily and weekly analytics with charts (bar, pie, line) via recharts

## User preferences

- UI language: Portuguese (pt-BR)
- Currency format: R$ (Real Brasileiro)

## Gotchas

- Always run codegen after changing `lib/api-spec/openapi.yaml`
- The `lib/api-zod/src/index.ts` must export ONLY from `./generated/api` — do not add `./generated/types` export back
- The `products/low-stock` route must be registered BEFORE `products/:id` in Express (specificity)
- SQL raw template literals in Drizzle must use camelCase column references (`productsTable.stockQuantity`), not snake_case column names

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
