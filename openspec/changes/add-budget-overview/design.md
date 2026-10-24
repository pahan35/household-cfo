# Design

## Context

The proxy (`src/app/api/external-provider/[...path]/route.ts`) is live and verified (all four endpoint groups return real data; see `docs/externalProvider/NOTES.md`). The dashboard screens (`src/app/(main)/dashboard/*`) are Server Components with `_components/` colocation and server-component-first conventions; the finance screen is the reference for card composition (12-col grids, inner secondary tabs). Existing screens use template mock data only; there is no real-data fetch pattern yet.

Constraints: no new dependencies; TypeScript strict; semantic theme tokens; secrets never reach the client; upstream quirks (double-encoded `/Exchange/Ping` payloads, ticks + ISO dates, GUID ids, double-entry categories) documented in NOTES.md.

## Goals / Non-Goals

**Goals:**

- One screen, four data sources, per-section loading/empty/error states with retry.
- A small, testable mapping layer: upstream JSON-in-JSON payloads → typed app models used by the UI.
- Period switch (current / previous month) for the budget summary and transaction pages.
- Colocated code; only `sidebar-items.ts` is touched outside the route.

**Non-Goals:**

- No transaction create/edit/delete (read-only MVP).
- No write paths (`/api/goals/*`, onboarding), no bank-sync (SaltEdge).
- No caching layers or optimistic updates; no chart-libs — reuse existing shadcn/chart primitives already present in the template.
- No investigation of unknown `/stat/ping` enum values (`periodtype`, `Before`/`After` semantics) beyond the captured working payload.

## Decisions

### 1. Client-side fetching via the existing proxy (not Server Component composition)

Fetch `/api/external-provider/...` from Client Components under `family-budget/_components/`.

Why: per-section retry for one failing source (spec), transaction paging, and period switching are inherently interactive; Server Component composition would still need a client island for pager/retry and would re-render the whole tree. An internal aggregation route (`/api/family-budget`) was considered and rejected for now — it would add a second credential-handling path for zero user value before we know the screen's real shape. Credential safety is preserved because the proxy injects/scrubs everything server-side.

### 2. Data layer colocated in the route, promoted on reuse

`family-budget/_components/external-provider-data.ts` (pure mapping) + `external-provider-client.ts` (fetch wrappers: sections, abortable, typed errors). Pure mappers are unit-free (numbers/strings in/out), the journey stays in clipboard-sized helpers. If a second route needs ExternalProvider data, they move to `src/lib/externalProvider/` explicitly (AGENTS co-location rule).

### 3. Types model the verified responses only

Discriminated reads for: settings (`/settings/get`), categories (`/Exchange/Ping` key 2, unwrapping `entityJson` JSON strings), transaction page (`/api/transaction/get` → `{transactions, importedTransactions, hasMoreData}`), stats (`/stat/ping` with the documented `data` payload). Dates use `dateTimestampISO` only; ticks exist as untyped passthrough. `CategoryType` modeled as a const-object enum (Unknown=0 … BankAccount=7). Unknown upstream fields stay accessible (`unknown`/indexed) without pretending to know them.

### 4. Budget payload mirrors the captured request

`data = {echo:"{\"selfSufficientRequest\":true}", selection:{periodtype:0, statisticType:0, period:{from:<month start ISO>, to:null, Before:40, After:null}, filter:null}}`, `ts = Date.now()`. Period switch changes `period.from` only — smallest verified-surface variance. Currency for money display comes from settings (`defaultCurrency`), falling back to the stats response `params.currency`.

### 5. Sections as independent client components

`AccountsCard`, `BudgetSummaryCard`, `RecentTransactionsCard` each own their fetch state. Shared `SectionShell` handles loading skeletons, empty, and error+retry consistently. Page is a Server Component shell composing them (fits project conventions).

### 6. Money via `Intl.NumberFormat`, period math via `date-fns`

Bounded to the repo's existing deps.

## Risks / Trade-offs

- [Session cookie expires while the app is open] → proxy surfaces upstream auth failures as errors; section error state shows a neutral message ("session may have expired — refresh ExternalProvider cookie in keychain and retry") without any credential detail.
- [`/stat/ping` payload contract may vary (`periodtype` semantics, `Before`)] → design fixes exactly the captured payload; deviation discovered during apply is contained in the stats adapter.
- [Upstream latency will stay visible on first paint] → one overview = many round trips; accept for MVP and load sections in parallel; introduce server-side SWR/caching only if the user notices slowness.
- [Categories may arrive outside `/Exchange/Ping`'s implicit scope (tags/currencies later)] → only key 2 is requested now; the key enum is documented, extending it is additive.

## Migration Plan

Everything is additive: new route + colocated files, one sidebar entry. Rollback = remove the sidebar entry and the route folder. No proxy/schema changes.

## Open Questions

- Sidebar icon and Dashboards-group position (proposal of `PiggyBank`/`Wallet` after Finance) — cosmetic, decided during apply.
- Whether month-start anchors should respect `settings.durationOfPeriod`/`periodStartsAt` from the user's ExternalProvider settings or plain calendar months — verify against real data during apply; does not change the spec.
