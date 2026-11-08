# Proposal

## Why

Currently, both the ExternalProvider proxy (`/api/external-provider/[...path]`) and the server synchronization engine (`src/server/external-provider/sync.ts`) communicate directly with the live upstream `api.external-provider.example.com` API, while all server domain stores share a single set of Supabase environment variables (`SUPABASE_URL` and `SUPABASE_SECRET_KEY`). To safely test application features on a dedicated Vercel branch (`e2e`) and in local development without mutating live ExternalProvider financial data or risking accidental modification of the production Supabase database—and to allow external consumers (such as future mobile apps and E2E test suites) to reuse ExternalProvider domain operations—we need to encapsulate ExternalProvider upstream operations behind a switchable adapter and domain service layer with hard-isolated mock database configuration.

## What Changes

- **Switchable ExternalProvider Upstream Adapter (`EXTERNAL_API_ADAPTER`)**: Encapsulate all interactions with `api.external-provider.example.com` behind a unified `ExternalProviderUpstreamAdapter` interface supporting `"external-provider"` (live upstream API, default) and `"mock"` (self-contained store-backed emulation without calling `api.external-provider.example.com`).
- **Hard-Isolated Mock Supabase Configuration (`SUPABASE_MOCK_URL` & `SUPABASE_MOCK_SECRET_KEY`)**: Introduce centralized Supabase credential resolution (`src/server/supabase/config.ts`) across all 6 domain stores (`externalProvider`, `offers`, `runway`, `mortgage`, `time-value`, `presets`). When `EXTERNAL_API_ADAPTER="mock"` is active, stores read exclusively from `SUPABASE_MOCK_URL` and `SUPABASE_MOCK_SECRET_KEY` (falling back to an isolated local mock file/in-memory store when unset) and never touch production `SUPABASE_URL` / `SUPABASE_SECRET_KEY`.
- **ExternalProvider Domain Service & External `/api/v1/external-provider/*` Endpoints**: Extract ExternalProvider domain operations (snapshot retrieval, sync execution, sync config updates, transaction creation/updates, category/account/budget limit upserts, and mock state reset/seeding) into a transport-agnostic service (`src/server/services/external-provider-service.ts`) with shared Zod DTOs (`src/lib/schemas/external-provider.ts`), exposed via `/api/v1/external-provider/*` REST endpoints for mobile/external/E2E consumers as well as existing `/api/external-provider/*` routes.
- **Lightweight Mock External API Side-Effects & Deterministic E2E Seeding**: When operating in `"mock"` adapter mode, automatically seed a minimalistic, deterministic fixture dataset on empty boot, emulate ExternalProvider double-entry balance and monthly `stat_points` updates when transactions or categories are created/modified, and expose a mock-only reset/re-seed operation (`POST /api/v1/external-provider/mock/reset`) strictly guarded against execution in live mode.

## Capabilities

### New Capabilities
- `external-provider-mock-adapter`: Switchable ExternalProvider adapter (`"external-provider"` vs `"mock"`), isolated `SUPABASE_MOCK_URL` / `SUPABASE_MOCK_SECRET_KEY` store resolution across all domain stores, lightweight double-entry balance/stat recalculation in mock mode, and deterministic E2E seed/reset support.

### Modified Capabilities
- `external-provider-persistent-sync`: Route synchronization and proxy write-through mutations through the configured `ExternalProviderUpstreamAdapter` so sync and mutations operate against the mock store/seed without contacting `api.external-provider.example.com` when `EXTERNAL_API_ADAPTER="mock"`.
- `layered-service-architecture`: Extend the transport-agnostic domain service layer and versioned `/api/v1/` REST surface to cover ExternalProvider domain operations (`transactions`, `categories`, `sync`, and mock `reset`) for external/mobile and E2E consumers.

## Impact

- **Environment & Configuration**: Adds `EXTERNAL_API_ADAPTER` (`"external-provider"` | `"mock"`), `SUPABASE_MOCK_URL`, and `SUPABASE_MOCK_SECRET_KEY` to `.env.example` and secret-handling rules (`.agents/rules/secrets.md`, `AGENTS.md`). Supports Vercel branch-scoped configuration (e.g. `e2e` branch + `Development` environment) alongside `Preview` and `Production`.
- **Backend Stores (`src/server/*/db.ts`)**: Consolidates Supabase URL/key resolution into `src/server/supabase/config.ts` so all 6 stores automatically switch between live and mock Supabase projects based on adapter mode.
- **Services, Schemas & API Routes**: Adds `src/lib/schemas/external-provider.ts`, `src/server/external-provider/adapter.ts`, `src/server/external-provider/mock-seed.ts`, `src/server/services/external-provider-service.ts`, and `/api/v1/external-provider/*` routes while preserving existing `/api/external-provider/*` web proxy and sync routes.
