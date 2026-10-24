# Proposal

## Why

The ExternalProvider proxy (`/api/external-provider/...`) is verified working against the live upstream (cookie auth; all four endpoint groups return real data — see `docs/externalProvider/NOTES.md`), but the app has no screen that consumes it. Every existing finance screen renders template mock data. A real family-budget dashboard is now achievable with live data and is the natural next step to validate the integration end to end.

## What Changes

- Add a new dashboard screen **"Family Budget"** at `/dashboard/family-budget`, fed by live ExternalProvider data through the existing proxy:
  - **Accounts & cards snapshot** from account-type categories (`POST /api/external-provider/Exchange/Ping`, key 2 = Category, `CategoryType` Account/BankAccount).
  - **Recent transactions list** from `POST /api/external-provider/api/transaction/get` (paged, server-side `userId` injection already handled by the proxy).
  - **Budget spent-vs-limit summary** from `GET /api/external-provider/stat/ping` with the documented `data` selection param (per-period, per-category `limitAmount`/`currentAmount` series).
  - **Period and currency context** from `GET /api/external-provider/settings/get` (default currency `PLN`, `durationOfPeriod`, `periodStartsAt`).
- Introduce a small data layer (`src/app/(main)/dashboard/family-budget/_components/` colocated server helpers / shared `src/lib` where reused) that maps ExternalProvider entity models (GUID ids, `.NET ticks` dates, double-entry source/destination categories, double-encoded `/Exchange/Ping` payloads) into typed app models.
- Register the screen in the dashboard sidebar navigation.
- Built strictly with existing components/theme tokens; no new dependencies.
- No breaking changes: purely additive; existing screens and the proxy contract stay as-is.

## Capabilities

### New Capabilities

- `budget-overview`: The family budget overview screen — its data sources (accounts snapshot, recent transactions, budget spent-vs-limit), money/date presentation (currency from settings, tick-date conversion), and its required loading/empty/error states.

### Modified Capabilities

- (none)

## Impact

- **New code**: `src/app/(main)/dashboard/family-budget/**` (page + `_components/`), typed ExternalProvider model helpers (e.g. `src/lib/externalProvider/` or colocated, decided in design).
- **Modified code**: `src/navigation/sidebar/sidebar-items.ts` (add nav entry).
- **Depends on (no changes)**: `src/app/api/external-provider/[...path]/route.ts` proxy, keychain credentials, verified upstream endpoints.
- **No dependency additions**; format dates with existing `date-fns`, money with `Intl.NumberFormat`.
- **Privacy consideration**: all upstream credentials remain server-side; the screen never renders or logs secrets, and the client only ever calls the local proxy.
