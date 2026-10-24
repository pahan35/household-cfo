# Proposal: Native Debt Accounts, Transaction Recording & API Logging

## Why

Currently, debt clearing operations fail to record transactions upstream in ExternalProvider due to missing timestamp metadata (`createdTimestamp`, `timestamp`, `isComplete`), an incorrect payload shape (sending a bare object instead of an array `[tx]`), and unscoped `userId` injection in the proxy. Furthermore, the dashboard emulated debts via normal accounts (`CategoryType.Account`) with a `Debt:` name prefix instead of utilizing ExternalProvider's native first-class Debt Accounts (`CategoryType.DebtAccount = 5`, scales icon). Finally, transactions lack date selection, preventing backdating, and API proxy write errors fail silently without actionable server logs.

## What Changes

- **Strict Native Debt Accounts**: Refactor debt identification to recognize only native ExternalProvider debt accounts (`CategoryType.DebtAccount` / category type 5) across the dashboard, account lists, and workbench, eliminating the artificial `Debt:` naming prefix requirement.
- **Native Debt Account Initialization**: Update `DebtAccountInitDialog` to create standard ExternalProvider `CategoryType.DebtAccount` entities with `icon: "debt"` and `exceptFromBalance: true` by default.
- **Date Control in Debt Workbench**: Add an explicit date input / picker (defaulting to current date with backdating support) across all tabs in `DebtClearingPanel` (Principal Outflow, Fee, Settlement, Reconcile & Archive).
- **Transaction Payload & Timestamp Fixes**:
  - Update `buildPrincipalOutflowTransaction`, `buildFeeTransaction`, `buildSettlementTransaction`, and `buildFxReconciliationTransaction` to produce complete ExternalProvider transaction entities with `.NET ticks` for `dateTimestamp`, `createdTimestamp`, `timestamp`, normalized `dateTimestampISO`, `isComplete: true`, and `debtPaymentAmount: 0`.
  - Update `createTransaction` in `external-provider-client.ts` to submit transactions as an array `[tx]` to `/api/external-provider/api/transaction/create`.
  - Constrain `userId` injection in proxy `route.ts` strictly to `/api/transaction/get`, ensuring write bodies remain uncorrupted.
- **Safe Server & Client Logging**: Add structured, secret-scrubbed logging in the ExternalProvider server proxy route (`route.ts`) and client (`external-provider-client.ts`) for all mutating requests and upstream errors, surfacing detailed diagnostics without exposing credentials.

## Capabilities

### New Capabilities
<!-- None: debt tracking capability already exists under throwaway-debt-accounts -->

### Modified Capabilities
- `throwaway-debt-accounts`: Change debt account recognition from name prefix `Debt:` to native `CategoryType.DebtAccount` (category type 5); update initialization to persist native debt accounts; add transaction date selection to all clearing operations; fix transaction submission contract and add proxy logging.

## Impact

- **Affected Files**:
  - `src/server/external-provider/http.ts`, `src/app/api/external-provider/[...path]/route.ts`
  - `src/app/(main)/dashboard/family-budget/_components/external-provider-data.ts`
  - `src/app/(main)/dashboard/family-budget/_components/external-provider-client.ts`
  - `src/app/(main)/dashboard/family-budget/_components/debt-clearing-panel.tsx`
  - `src/app/(main)/dashboard/family-budget/_components/debt-account-init-dialog.tsx`
  - `src/app/(main)/dashboard/family-budget/_components/accounts-card.tsx`
  - Associated unit tests in `src/app/(main)/dashboard/family-budget/_components/__tests__/`
- **Dependencies & APIs**: Upstream endpoints `/api/transaction/create` and `/api/transaction/update` via local proxy. No new npm dependencies.
