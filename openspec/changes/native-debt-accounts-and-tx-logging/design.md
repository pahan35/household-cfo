# Design: Native Debt Accounts, Transaction Pipeline & Safe Proxy Logging

## Context

See `proposal.md` for motivation and background.

Currently:
1. `isThrowawayDebtAccount` matched only categories prefixed with `Debt:`. In ExternalProvider, native debt accounts created via the web/mobile app have `categoryType: CategoryType.DebtAccount` (5), `icon: "debt"`, and arbitrary names without `Debt:`.
2. Transactions created via `createTransaction` in `external-provider-client.ts` were sent as single objects `{...tx}` instead of arrays `[tx]`.
3. Transaction objects lacked `.NET ticks` for `createdTimestamp` and `timestamp`, and `isComplete: true`.
4. Proxy route `route.ts` indiscriminately ran `injectUserId` on all `/api/transaction/*` endpoints, modifying write bodies.
5. `DebtClearingPanel` lacked a date input, hardcoding operations to `new Date()`.
6. Failed upstream requests in proxy `route.ts` returned generic errors without console logging.

## Goals / Non-Goals

**Goals:**
- Identify debt accounts solely through `categoryType === CategoryType.DebtAccount` (5).
- Allow user-specified transaction dates on all clearing panel operations (Outflow, Fee, Settlement, Reconciliation).
- Ensure transactions sent to `/api/external-provider/api/transaction/create` have valid ExternalProvider timestamp semantics (.NET ticks) and array payload wrapping.
- Isolate `userId` injection in proxy `route.ts` strictly to `/api/transaction/get`.
- Introduce safe server-side logging for write actions and errors with `scrubSecrets` redaction.
- Surface upstream error details in client-side toasts and errors.

**Non-Goals:**
- Supporting arbitrary name-prefix emulation for non-debt categories (the user confirmed no existing transactions rely on `Debt: *` emulation).
- Modifying ExternalProvider upstream backend behavior or database schema.
- Exposing any credentials, session cookies, or user tokens in logs or client-visible responses.

## Decisions

### Decision 1: Identify Debt Accounts strictly via `CategoryType.DebtAccount` (5)
- **Rationale**: ExternalProvider has first-class debt accounts (`CategoryType.DebtAccount = 5`). Relying on this enum eliminates synthetic name prefixes (`Debt:`), supports accounts created in ExternalProvider's official UI, and correctly shows the scales icon.
- **Alternatives considered**:
  - *Hybrid matching (`CategoryType.DebtAccount` OR `Debt:` prefix)*: Rejected per user instruction. No successful transactions exist under the synthetic prefix, so keeping strict native types keeps the data model clean.

### Decision 2: Array Payload & Complete Timestamp Contract for `/api/transaction/create`
- **Rationale**: Inspection of ExternalProvider Web's `upstream client` and `upstream client` reveals:
  - `TransactionManager.write([tx])` dispatches `POST /api/transaction/create` with `data: JSON.stringify([tx])`.
  - Upstream expects .NET ticks for:
    - `dateTimestamp`: .NET ticks of the transaction date (UTC midnight of selected date).
    - `createdTimestamp`: .NET ticks of `Date.now()`.
    - `timestamp`: .NET ticks of `Date.now()`.
  - Properties `isComplete: true` and `debtPaymentAmount: 0` are expected.
- **Alternatives considered**:
  - *Sending single object*: Failed upstream because ASP.NET endpoint expects an enumerable collection of transactions.

### Decision 3: Restrict Proxy `userId` Injection to Read Endpoint
- **Rationale**: `/api/transaction/get` requires `userId` injected server-side to scope pagination. Mutating `/api/transaction/create` or `/api/transaction/update` bodies with `userId` injects an unauthorized field into transaction entities or corrupts array payloads.
- **Alternatives considered**:
  - *Injecting userId into each transaction element*: Not supported by ExternalProvider transaction schema (transactions do not have a `userId` field; auth is managed via the session cookie/bearer token).

### Decision 4: Safe Structured Logging in Proxy Route
- **Rationale**: When upstream mutations fail, lack of server-side output makes diagnosing API contract mismatches impossible. Logging `[External API Proxy] METHOD /path -> STATUS (scrubbed error)` via `scrubSecrets` gives immediate operational feedback in development and production without secret leakage.
- **Alternatives considered**:
  - *Console logging raw error responses*: Dangerous, as upstream errors sometimes reflect request headers (including session cookies). Redacting via `scrubSecrets` and `redactHeaders` is required.

### Decision 5: Explicit Date Picker across Workbench Tabs
- **Rationale**: Financial debt settlements and outflow purchases are frequently entered with a delay. Providing an input field (defaulting to current date in `YYYY-MM-DD`) allows users to backdate entries accurately.

## Risks / Trade-offs

- **[Risk]** User enters a future or invalid date string in manual date input.  
  $\rightarrow$ **Mitigation**: Validate date format with `isValid(parseISO(...))` and prevent submission with a friendly validation toast if the date is invalid.
- **[Risk]** Accidental leakage of tokens in server logs.  
  $\rightarrow$ **Mitigation**: Run every logged message and upstream error string through `scrubSecrets(msg, ...secrets)` before `console.error` / `console.log`.
- **[Risk]** Legacy `throwaway-debt-accounts` tests expecting `Debt:` prefix fail.  
  $\rightarrow$ **Mitigation**: Update test fixtures to use `CategoryType.DebtAccount` and assert native debt account lifecycle behavior.

## Migration Plan

1. Update proxy `route.ts` to log writes/errors and limit `injectUserId` to `/api/transaction/get`.
2. Update `external-provider-data.ts` to recognize `CategoryType.DebtAccount` and provide complete .NET ticks and array payloads.
3. Update `external-provider-client.ts` to dispatch `[tx]` and surface upstream error detail.
4. Update `DebtAccountInitDialog` to initialize native `CategoryType.DebtAccount` with `icon: "debt"` and `exceptFromBalance: true`.
5. Update `DebtClearingPanel` with date pickers across tabs.
6. Update unit tests to verify native debt accounts, payload shapes, and logging.
