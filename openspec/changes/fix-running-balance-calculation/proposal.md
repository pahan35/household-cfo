# Proposal

## Why

The transaction feed on the Family Budget dashboard calculates running account balances (`Bal: ...`) starting from `0.00` rather than the account's actual current live balance. This causes the most recent transaction to always display `Bal: 0.00` and all prior transactions to display inverted sums of past transactions rather than the true account balance at that point in time.

This occurs because ExternalProvider's server model populates `currentAmount: 0.0` on all category entities returned by `POST /api/external-provider/Exchange/Ping`, while placing the real balance in `amount`. In TypeScript, evaluating `c.currentAmount ?? c.amount` resolves `0.0` as defined (non-nullish), discarding the actual balance in `c.amount`. The same issue affects the Filtered Account balance in the liquidity strip and the transaction filter clear button.

Fixing this extraction logic and introducing a centralized `getAccountBalance` helper—backed by regression unit tests with realistic ExternalProvider payloads—restores accurate running balances across transaction histories and prevents future regressions.

## What Changes

- **Canonical Account Balance Helper**: Introduce `getAccountBalance(category: ExternalProviderCategory | null | undefined): number` in `external-provider-data.ts` that reliably prioritizes `category.amount` over `currentAmount`.
- **Running Balance Calculation Fix**: Update `computeTransactionsWithRunningBalance` to anchor initial balances using `getAccountBalance(c)`.
- **Account Filter & Liquidity Strip Fix**: Update `account-liquidity-strip.tsx` (`selectedBalance`) and `recent-transactions-card.tsx` (selected account filter label) to use `getAccountBalance`.
- **Automated Regression Unit Tests**: Update `external-provider-data.test.ts` to test `computeTransactionsWithRunningBalance` and `getAccountBalance` against realistic upstream category payloads containing `currentAmount: 0.0` alongside positive, zero, and negative account balances.

## Capabilities

### New Capabilities
<!-- None; this refines existing transaction running balance and liquidity calculations. -->

### Modified Capabilities
- `budget-overview`: Update requirements for transaction history and account liquidity presentation to ensure running balances and filtered account metrics accurately anchor on live account balances (`amount`) in the presence of upstream `currentAmount: 0.0` fields, and require automated test coverage for running balance calculations.

## Impact

- `src/app/(main)/dashboard/family-budget/_components/external-provider-data.ts`: Introduce `getAccountBalance` and use it in `computeTransactionsWithRunningBalance`, `filterAndClassifyAccounts`, and `computeAccountLiquiditySummary`.
- `src/app/(main)/dashboard/family-budget/_components/account-liquidity-strip.tsx`: Use `getAccountBalance` for `selectedBalance`.
- `src/app/(main)/dashboard/family-budget/_components/recent-transactions-card.tsx`: Use `getAccountBalance` for selected account filter label.
- `src/app/(main)/dashboard/family-budget/_components/__tests__/external-provider-data.test.ts`: Add test cases validating balance calculation with `currentAmount: 0.0` payloads.
- Zero breaking changes to API contracts or UI designs.
