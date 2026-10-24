# Tasks

## 1. Proxy Logging & Request Body Isolation

- [x] 1.1 Restrict `injectUserId` strictly to `/api/transaction/get` in `src/app/api/external-provider/[...path]/route.ts` and verify `/api/transaction/create` request bodies are not mutated
- [x] 1.2 Add structured, secret-scrubbed console logging for write requests and upstream error responses in `src/app/api/external-provider/[...path]/route.ts` and verify with unit tests

## 2. Client Payload Dispatch & Error Surfacing

- [x] 2.1 Update `handleResponse` in `src/app/(main)/dashboard/family-budget/_components/external-provider-client.ts` to include upstream error `detail` in thrown error messages and verify client error formatting
- [x] 2.2 Update `createTransaction` in `src/app/(main)/dashboard/family-budget/_components/external-provider-client.ts` to send an array payload `[tx]` to `/api/external-provider/api/transaction/create` and verify unit test captures array payload

## 3. Native Debt Account Identification & Transaction Builders

- [x] 3.1 Refactor `isThrowawayDebtAccount` in `src/app/(main)/dashboard/family-budget/_components/external-provider-data.ts` to strictly identify accounts where `categoryType === CategoryType.DebtAccount` (5), dropping the synthetic `Debt:` name prefix requirement
- [x] 3.2 Update `buildNewDebtAccountCategory` in `external-provider-data.ts` to instantiate native `CategoryType.DebtAccount` with `icon: "debt"` and `exceptFromBalance: true` by default
- [x] 3.3 Update `buildPrincipalOutflowTransaction`, `buildFeeTransaction`, `buildSettlementTransaction`, and `buildFxReconciliationTransaction` in `external-provider-data.ts` to accept a transaction date and populate `dateTimestamp`, `createdTimestamp`, `timestamp`, normalized `dateTimestampISO`, `isComplete: true`, and `debtPaymentAmount: 0`

## 4. Workbench UI & Date Controls

- [x] 4.1 Update `DebtAccountInitDialog` in `src/app/(main)/dashboard/family-budget/_components/debt-account-init-dialog.tsx` to initialize native debt accounts without artificial prefixing
- [x] 4.2 Add date input controls (`YYYY-MM-DD` defaulting to current local date) to all 4 tabs in `DebtClearingPanel` (`src/app/(main)/dashboard/family-budget/_components/debt-clearing-panel.tsx`) and wire them into transaction builder calls
- [x] 4.3 Update `AccountsCard` in `src/app/(main)/dashboard/family-budget/_components/accounts-card.tsx` to badge native debt accounts with the scales icon and "Debt" label

## 5. Verification & Testing

- [x] 5.1 Update unit tests in `external-provider-data.test.ts` and `external-provider-client.test.ts` to validate native debt account handling, array payloads, complete timestamps, and date selection
- [x] 5.2 Run `npm run verify` (`biome check && tsc --noEmit`) to verify zero linting, formatting, or TypeScript errors across the repository
