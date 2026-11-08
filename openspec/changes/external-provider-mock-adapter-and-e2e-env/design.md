# Design

## Context

See `proposal.md` for motivation. Currently:
1. `src/app/api/external-provider/[...path]/route.ts` and `src/server/external-provider/sync.ts` make direct HTTP calls to `https://api.external-provider.example.com` using credentials resolved via `src/server/external-provider/token.ts`.
2. Six server stores (`externalProvider`, `offers`, `runway`, `mortgage`, `time-value`, `presets`) each independently read `process.env.SUPABASE_URL` and `process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY`.
3. Under the `layered-service-architecture` specification, business logic belongs in `src/server/services/` with shared Zod DTOs in `src/lib/schemas/` and external/mobile endpoints under `/api/v1/`, while preserving `/api/external-provider/*` route handlers for the existing web proxy and cron flows.

## Goals / Non-Goals

**Goals:**
- Introduce a clean `ExternalProviderUpstreamAdapter` abstraction with `"external-provider"` (live upstream) and `"mock"` (store-backed) implementations controlled by `EXTERNAL_API_ADAPTER`.
- Centralize Supabase credential resolution so `"mock"` mode strictly reads `SUPABASE_MOCK_URL` and `SUPABASE_MOCK_SECRET_KEY` (or falls back to an isolated local mock file/in-memory store), guaranteeing that mock/E2E runs can never touch or wipe the production Supabase database.
- Expose transport-agnostic ExternalProvider operations in `src/server/services/external-provider-service.ts` and `/api/v1/external-provider/*` so external consumers (future mobile app, E2E test suites) can query snapshots and mutate transactions/categories without dealing with ExternalProvider's internal `/Exchange/Ping` double-encoded JSON protocol.
- Provide lightweight double-entry balance and `stat_points` recalculation in `MockExternalProviderAdapter` plus a deterministic minimalistic E2E seed and mock-only reset endpoint (`POST /api/v1/external-provider/mock/reset`).

**Non-Goals:**
- Rewriting existing web UI components away from `/api/external-provider/*` where SWR and `external-provider-client.ts` already work cleanly through the proxy/sync endpoints.
- Emulating 100% of undocumented ExternalProvider server internals (e.g., bank feed imports or legacy license checks); mock side-effects focus on categories, account balances, budget limits, transactions, tags, and monthly `stat_points`.

## Decisions

### 1. Centralized Supabase & Adapter Mode Resolution (`src/server/supabase/config.ts`)
- **Decision**: Create `src/server/supabase/config.ts` exporting `getExternalProviderAdapterMode(): "external-provider" | "mock"`, `isMockAdapterMode(): boolean`, and `resolveSupabaseCredentials(): { url: string; key: string } | null`.
  - When `EXTERNAL_API_ADAPTER` is unset or `"external-provider"`: reads `SUPABASE_URL` and `SUPABASE_SECRET_KEY ?? SUPABASE_SERVICE_ROLE_KEY`.
  - When `EXTERNAL_API_ADAPTER` is `"mock"`: reads **only** `SUPABASE_MOCK_URL` and `SUPABASE_MOCK_SECRET_KEY ?? SUPABASE_MOCK_SERVICE_ROLE_KEY`. Even if `SUPABASE_URL` is present in the same `.env.local` file, `resolveSupabaseCredentials()` returns `null` if `SUPABASE_MOCK_URL` is unset, causing stores to fall back to isolated local mock storage (`.cache/external-provider-mock-store.json` or in-memory).
  - Any other value for `EXTERNAL_API_ADAPTER` throws an `InvalidAdapterModeError` (`503` / `ServiceError("invalid", ...)`).
- **Rationale**: Eliminates any possibility of a mock reset or E2E test wiping production Supabase tables, and enables single-variable switching (`EXTERNAL_API_ADAPTER=mock`) in local development when both prod and mock URLs are present in `.env.local`.
- **Alternatives considered**:
  - *Reusing `SUPABASE_URL` everywhere and relying only on `.env` file swapping*: Too error-prone locally; forgetting to swap `SUPABASE_URL` before running an E2E reset would wipe production data.

### 2. `ExternalProviderUpstreamAdapter` Interface (`src/server/external-provider/adapter.ts`)
- **Decision**: Define `ExternalProviderUpstreamAdapter` with two implementations:
  1. `LiveExternalProviderAdapter`: Wraps the existing upstream `fetch` calls to `https://api.external-provider.example.com` (using `token.ts`, proxy cache, secret scrubbing, and write-through upserts to `ExternalProviderStore`).
  2. `MockExternalProviderAdapter`: Operates purely against `getExternalProviderStore()` without any network calls to `api.external-provider.example.com` or credential resolution from `token.ts`.
     - Handles `/settings/get`, `/Exchange/Ping` (both read and category write payloads), `/api/transaction/get`, `/api/transaction/create`, `/api/transaction/update`, and `/stat/ping` so existing proxy callers (`/api/external-provider/[...path]`) work transparently.
     - Handles high-level domain methods (`sync`, `createTransactions`, `updateTransaction`, `upsertCategories`, `resetToSeed`) used by `external-provider-service.ts`.
- **Rationale**: Supporting both the raw proxy path dispatch and high-level typed domain methods inside the adapter allows existing web UI components (`external-provider-client.ts`) and new `/api/v1/external-provider/*` consumers to share the exact same underlying mock state and side-effects.

### 3. Lightweight Mock Side-Effects & Deterministic Seed (`src/server/external-provider/mock-seed.ts`)
- **Decision**:
  - **Seed Dataset**: `buildMockSeedSnapshot()` returns a compact, deterministic dataset anchored to canonical IDs:
    - `settings`: `{ defaultCurrency: "PLN", durationOfPeriod: 0, language: "en", userId: "mock-user-e2e" }`
    - `currencies`: `PLN` (id `"currency-pln"`), `EUR` (id `"currency-eur"`), `USD` (id `"currency-usd"`)
    - `categories`: Income (`Salary`, `Side Gig`), Accounts (`Main Account PLN`, `Savings EUR`), Debt Account (`Friend Loan`), and Expenses (`Groceries`, `Housing & Utilities`, `Lifestyle & Trips`, `Wellness & Learning`, `Fees / Commissions`) with configured `limitAmount` and `order`.
    - `transactions`: ~6–8 deterministic transactions (salary inflow, grocery/housing/tagged lifestyle expenses, and a debt transfer) with consistent timestamps.
    - `statPoints`: Computed directly from the categories and transactions via a shared helper `recomputeMockStatPointsAndBalances()`.
  - **Under-the-Hood Math on Mutations**: Instead of fragile incremental deltas that can drift, whenever a transaction or category is mutated in `MockExternalProviderAdapter`, `reconcileMockStoreState(store, { previousTx, updatedTx })` adjusts account `amount` balances by the net transaction delta (from `sourceId` and `destinationId`) and recomputes `ext_stat_points` for affected months (`YYYY-MM-01`) from the non-deleted transactions in the store, then increments `sync_version`.
- **Rationale**: In a mock/E2E database with tens or hundreds of transactions, recomputing monthly category stat points from stored transactions takes <2ms in memory and guarantees that category spend totals, budget limits, and account balances stay 100% consistent after creates, edits, tag updates, and soft-deletes.

### 4. Transport-Agnostic `external-provider-service.ts` & `/api/v1/external-provider/*` for External Consumers
- **Decision**: Create `src/lib/schemas/external-provider.ts` and `src/server/services/external-provider-service.ts` following `.agents/skills/backend-architecture/SKILL.md`:
  - `getSnapshot(ctx, input)` → `GET /api/v1/external-provider/snapshot?sinceVersion=...`
  - `triggerSync(ctx, input)` → `POST /api/v1/external-provider/sync`
  - `updateSyncConfig(ctx, input)` → `PATCH /api/v1/external-provider/sync/config`
  - `createTransactions(ctx, input)` → `POST /api/v1/external-provider/transactions`
  - `updateTransaction(ctx, input)` → `PATCH /api/v1/external-provider/transactions`
  - `upsertCategories(ctx, input)` → `PUT /api/v1/external-provider/categories`
  - `resetMockExternalProvider(ctx)` → `POST /api/v1/external-provider/mock/reset` (throws `ServiceError("invalid" / 403)` if `!isMockAdapterMode()`, otherwise resets ExternalProvider and domain stores in mock mode and seeds `buildMockSeedSnapshot()`).
- **Rationale**: External consumers (future Mobile App using `Authorization: Bearer <MOBILE_API_TOKENS>` and E2E test suites) get clean, versioned `/api/v1/external-provider/*` REST endpoints with Zod validation and standard JSON payloads, while `/api/external-provider/*` routes delegate to the same service/adapter.

## Risks / Trade-offs

- **[Risk: Store singleton caching across adapter mode changes in unit tests]** → *Mitigation*: Include the resolved adapter mode (`"external-provider"` vs `"mock"`) when initializing or resetting store singletons, and provide a `resetAllStoreSingletons()` helper for tests.
- **[Risk: Accidental invocation of mock reset against live mode]** → *Mitigation*: Enforce a triple guard: (1) `isMockAdapterMode()` check inside `resetMockExternalProvider` service, (2) `resolveSupabaseCredentials()` physically never reading `SUPABASE_URL` when in mock mode, and (3) authentication check via `handleV1`.
