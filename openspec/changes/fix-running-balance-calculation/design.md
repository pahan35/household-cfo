# Design

## Context

See `proposal.md` for problem motivation and upstream ExternalProvider data contract details.

ExternalProvider upstream returns categories via `POST /api/external-provider/Exchange/Ping` with `ExchangeKey.Category = 2`. In the serialized JSON payload:
- `amount` holds the live account balance (e.g. `814.05`).
- `currentAmount` is populated by the server model as `0.0`.

Because `c.currentAmount ?? c.amount` evaluates `0.0` as defined, three components (`computeTransactionsWithRunningBalance`, `account-liquidity-strip.tsx`, and `recent-transactions-card.tsx`) discarded `amount` and reset live account balances to `0.0`.

## Goals / Non-Goals

**Goals:**
- Provide a single, centralized helper `getAccountBalance` in `external-provider-data.ts` to consistently resolve account balances from ExternalProvider category entities.
- Update `computeTransactionsWithRunningBalance` to anchor initial balances using `getAccountBalance(c)`.
- Update `account-liquidity-strip.tsx` and `recent-transactions-card.tsx` to use `getAccountBalance`.
- Ensure unit tests in `external-provider-data.test.ts` execute with realistic ExternalProvider category payloads (containing `currentAmount: 0.0`) to catch any future regression.

**Non-Goals:**
- Modifying the upstream proxy endpoints or caching configuration.
- Changing historical balance reconstruction in Budget Overview (handled by `net-worth-and-balance-trends`).
- Changing the visual presentation or styling of transaction feed rows.

## Decisions

1. **Introduce a centralized `getAccountBalance(category)` helper in `external-provider-data.ts`**:
   - *Rationale*: Account balance resolution is currently duplicated across `computeAccountLiquiditySummary`, `filterAndClassifyAccounts`, `computeTransactionsWithRunningBalance`, `AccountLiquidityStrip`, and `RecentTransactionsCard`. Consolidating into `getAccountBalance` ensures that all screens and transforms treat ExternalProvider's `amount` vs `currentAmount` fields identically.
   - *Implementation*:
     ```typescript
     export function getAccountBalance(account: ExternalProviderCategory | null | undefined): number {
       if (!account) return 0;
       const raw = account.amount ?? account.currentAmount;
       return Number(raw) || 0;
     }
     ```
   - *Alternatives considered*: Fixing the inline `??` in `computeTransactionsWithRunningBalance` only. Rejected because it would leave `AccountLiquidityStrip` and `RecentTransactionsCard` broken and allow future balance-reading code to repeat the mistake.

2. **Refactor existing balance reads in `external-provider-data.ts` and components to `getAccountBalance`**:
   - `computeTransactionsWithRunningBalance`: `balances.set(c.id, getAccountBalance(c));`
   - `computeAccountLiquiditySummary`: `const balance = getAccountBalance(account);`
   - `filterAndClassifyAccounts`: `const balance = getAccountBalance(account);`
   - `account-liquidity-strip.tsx`: `const selectedBalance = getAccountBalance(selectedAccount);`
   - `recent-transactions-card.tsx`: `formatMoney(getAccountBalance(selectedAccount), ...)`

3. **Expand unit test fixtures with `currentAmount: 0.0`**:
   - *Rationale*: The previous test for `computeTransactionsWithRunningBalance` passed only because test mock categories omitted `currentAmount`. Adding `currentAmount: 0.0` to mock categories directly replicates upstream behavior and ensures tests fail if precedence ever reverses.

## Risks / Trade-offs

- **[Risk] Account categories with legitimately negative balances** (e.g. debt accounts or overdrawn checking):
  - *Mitigation*: `Number(raw) || 0` correctly handles negative numbers (e.g. `Number(-400) || 0 === -400`). Test fixtures must include negative balances to explicitly verify preservation.
