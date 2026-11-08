# external-provider-mock-adapter Specification

## Purpose

Provides a switchable ExternalProvider upstream adapter ("external-provider" vs "mock") with hard-isolated mock database credential resolution (SUPABASE_MOCK_URL and SUPABASE_MOCK_SECRET_KEY), lightweight double-entry balance and monthly statistics recalculation during mock mutations, and deterministic seed/reset capabilities for E2E and development environments.

## Requirements

### Requirement: Configurable ExternalProvider adapter mode with live default
The system SHALL resolve the active ExternalProvider upstream adapter from the `EXTERNAL_API_ADAPTER` environment variable (`"external-provider"` or `"mock"`), defaulting to `"external-provider"` when `EXTERNAL_API_ADAPTER` is unset or empty. When `EXTERNAL_API_ADAPTER` is set to `"mock"`, the server MUST NOT issue any HTTP requests to `https://api.external-provider.example.com` or resolve ExternalProvider upstream credentials (`EXTERNAL_API_WEB_COOKIE`, `EXTERNAL_API_TOKEN`, or macOS Keychain items).

#### Scenario: Default mode uses live ExternalProvider upstream
- **WHEN** `EXTERNAL_API_ADAPTER` is unset or set to `"external-provider"`
- **THEN** the server uses the live ExternalProvider adapter to communicate with `https://api.external-provider.example.com` and resolves upstream credentials via the configured `EXTERNAL_API_SECRET_SOURCE`

#### Scenario: Mock mode operates without upstream network calls or credentials
- **WHEN** `EXTERNAL_API_ADAPTER` is set to `"mock"`
- **THEN** all proxy, synchronization, and `/api/v1/external-provider/*` operations execute exclusively against the server persistence store without contacting `https://api.external-provider.example.com` or requiring ExternalProvider credentials

#### Scenario: Invalid adapter configuration fails closed
- **WHEN** `EXTERNAL_API_ADAPTER` is set to a value other than `"external-provider"` or `"mock"`
- **THEN** the server rejects the operation with a configuration error (`503` / `ServiceError`) describing the valid `EXTERNAL_API_ADAPTER` values

### Requirement: Hard-isolated mock Supabase credential resolution across all domain stores
When `EXTERNAL_API_ADAPTER` is set to `"mock"`, all server domain stores (`externalProvider`, `offers`, `runway`, `mortgage`, `time-value`, and `presets`) SHALL resolve their Supabase connection exclusively from `SUPABASE_MOCK_URL` and `SUPABASE_MOCK_SECRET_KEY` (or `SUPABASE_MOCK_SERVICE_ROLE_KEY`) and MUST NOT read `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, or `SUPABASE_SERVICE_ROLE_KEY`. When `SUPABASE_MOCK_URL` is not configured in mock mode, stores SHALL fall back to an isolated local mock file or in-memory store separate from the live local cache file.

#### Scenario: Mock mode connects exclusively to mock Supabase project
- **WHEN** `EXTERNAL_API_ADAPTER` is `"mock"` and both production (`SUPABASE_URL`, `SUPABASE_SECRET_KEY`) and mock (`SUPABASE_MOCK_URL`, `SUPABASE_MOCK_SECRET_KEY`) variables are present in the environment
- **THEN** all domain stores connect to `SUPABASE_MOCK_URL` using `SUPABASE_MOCK_SECRET_KEY` and never read or mutate the production `SUPABASE_URL` project

#### Scenario: Mock mode without mock Supabase credentials falls back to isolated local store
- **WHEN** `EXTERNAL_API_ADAPTER` is `"mock"`, `SUPABASE_MOCK_URL` is unset, and `SUPABASE_URL` is set
- **THEN** the server falls back to local mock persistence (`.cache/external-provider-mock-store.json` / in-memory stores) and MUST NOT connect to `SUPABASE_URL`

### Requirement: Lightweight double-entry balance and monthly statistics recalculation in mock mode
When operating in `"mock"` adapter mode, mutations to transactions (`createTransaction`, `updateTransaction`, soft-delete) and categories (`upsertCategories`, budget limits, debt accounts, ordering, archiving) SHALL automatically update affected account balances (`amount` / `currentAmount` on source and destination categories) and recompute affected monthly `stat_points` in the persistence store, incrementing `sync_version`.

#### Scenario: Creating an expense or transfer transaction in mock mode updates balances and stats
- **WHEN** a caller creates a transaction in `"mock"` mode moving funds from a source account to an expense category or destination account
- **THEN** the mock adapter persists the transaction in `ext_transactions`, deducts `sourceAmount` from the source account's `amount`, adds `destinationAmount` to the destination category/account and corresponding monthly `ext_stat_points` entry, and increments `sync_version`

#### Scenario: Updating or soft-deleting a transaction in mock mode reconciles balances
- **WHEN** a caller updates a transaction's amounts, categories, tags, or `deleted` flag in `"mock"` mode
- **THEN** the mock adapter reverses the prior transaction's balance effect, applies the updated transaction's effect to affected categories and monthly `ext_stat_points`, and increments `sync_version`

#### Scenario: Updating category budget limits or creating a debt account in mock mode
- **WHEN** a caller upserts categories (such as changing `limitAmount`, reordering, archiving, or creating a throwaway debt account) via `/Exchange/Ping` or `/api/v1/external-provider/categories` in `"mock"` mode
- **THEN** the mock adapter persists the updated category records in `ext_categories`, synchronizes updated `limitAmount` values in the current monthly `ext_stat_points`, and increments `sync_version`

### Requirement: Deterministic E2E seed dataset and mock-only state reset
In `"mock"` adapter mode, the system SHALL provide a deterministic minimalistic seed dataset (settings, currencies, income/account/debt/expense categories with budget limits, transactions, and monthly stat points). The system SHALL automatically seed the store when `sync_version === 0` on initial access or sync, and SHALL expose a reset operation (`POST /api/v1/external-provider/mock/reset`) that wipes the mock store and restores the deterministic seed state. The reset operation MUST be strictly forbidden (`403`) when `EXTERNAL_API_ADAPTER` is not `"mock"`.

#### Scenario: Automatic initial seeding on empty mock store
- **WHEN** `EXTERNAL_API_ADAPTER` is `"mock"` and a sync or snapshot read occurs against an uninitialized store (`sync_version === 0`)
- **THEN** the system populates the store with the deterministic seed dataset and sets `sync_version` to `1`

#### Scenario: Resetting mock state for E2E test isolation
- **WHEN** an authenticated caller invokes `POST /api/v1/external-provider/mock/reset` while `EXTERNAL_API_ADAPTER` is `"mock"`
- **THEN** the system clears existing mock entities in the mock store, re-applies the deterministic seed dataset, and returns the seeded snapshot

#### Scenario: Rejecting mock reset when not in mock mode
- **WHEN** any caller invokes `POST /api/v1/external-provider/mock/reset` while `EXTERNAL_API_ADAPTER` is unset or `"external-provider"`
- **THEN** the server rejects the request with `403 Forbidden` without modifying any store data
