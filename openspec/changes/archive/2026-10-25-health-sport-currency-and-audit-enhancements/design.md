# Design

## Context

See `proposal.md` and `specs/wellness-and-learning-cadence/spec.md`. The Health & Sport dashboard currently unifies multi-currency transactions using `computeWellnessMetrics` and `getConvertedTransactionAmount` in `lifestyle-transforms.ts`, and renders an inline audit queue in `health-sport-dashboard.tsx`.

## Goals / Non-Goals

**Goals:**
- Correctly resolve foreign currencies for expense transactions originating from foreign source accounts (e.g. EUR accounts) when the destination category lacks an explicit currency suffix.
- Display primary amounts in default currency (`PLN`) with secondary native currency indicators (`700.00 EUR`), consistent with other lifestyle dashboard cards.
- Re-order audit queue items so package outlier warnings (`AlertTriangle`) render before informational untagged category entries (`Tag`), sorted newest first.
- Support orthogonal tag dimensions (activity vs person/scope vs pass multiplier) so adding `#wife` leaves activity suggestions (`#pilates`, `#gym`) accessible.
- Introduce a 4-second auto-dismissal countdown with `Pause / Add more` and `Dismiss now` controls upon meeting primary audit criteria.

**Non-Goals:**
- Modifying ExternalProvider API backend contracts or database models.
- Changing tag taxonomy outside of wellness categories.

## Decisions

### 1. Foreign Source Currency Precedence in `getConvertedTransactionAmount`
- **Choice**: When evaluating an expense transaction, check if `tx.sourceCurrencyId` or the source account (`categoryMap.get(tx.sourceId)?.currencyId`) represents a foreign currency (`!== defaultCurrency`). If so, adopt that foreign currency as the `nativeCurrency` and use `tx.sourceAmount` as the `nativeAmount`, converting it to `defaultCurrency` via `convertCurrencyAmount`.
- **Rationale**: Aligns with existing logic in `category-expense-trace-helpers.ts` (`lines 106-115`). In ExternalProvider, user categories (e.g. "Sport") often carry default workspace currency, while actual foreign expenditures come from specific foreign accounts.
- **Alternatives Considered**: Checking category currency first (the current buggy behavior which caused 700 EUR to be treated as 700 PLN).

### 2. Dual Amount Presentation in `WellnessAuditItem`
- **Choice**: Extend `WellnessAuditItem` interface to include:
  ```typescript
  export interface WellnessAuditItem {
    transaction: ExternalProviderTransaction;
    streamId: WellnessStreamId;
    suggestedTags: string[];
    reason: string;
    isOutlierPackage: boolean;
    convertedAmount: number;
    currency: string;
    nativeAmount?: number;
    nativeCurrency?: string;
  }
  ```
- **Rationale**: Enables `health-sport-dashboard.tsx` to render the converted amount `formatMoney(item.convertedAmount, defaultCurrency)` with a secondary subtext `formatMoney(item.nativeAmount, item.nativeCurrency)` whenever `nativeCurrency !== defaultCurrency`.

### 3. Outlier Reason Formatted with Native Currency
- **Choice**: In `computeWellnessMetrics`, calculate median single-visit costs using normalized currencies, but render the outlier description in the transaction's native currency (e.g. `700 EUR vs median 70 EUR`).
- **Rationale**: Eliminates the confusing `700 PLN vs median 70` string when the user spent 700 EUR.

### 4. Tag Taxonomy Classification & Dimension-Aware Audit Eligibility
- **Choice**: Classify tags into distinct sets:
  - `SPORT_ACTIVITY_TAGS`: `["pilates", "gym", "multisport"]`
  - `MEDICAL_SERVICE_TAGS`: `["consult", "exams", "dentist", "pharmacy", "physio", "vaccine"]`
  - `SCOPE_TAGS`: `["wife", "partner", "family", "me"]`
  - `PASS_TAGS`: `["10x", "5x", "1x"]`
- For `Sport` transactions, an entry remains in `auditQueue` if it has no `SPORT_ACTIVITY_TAGS`, even if it already has `#wife`. The UI displays `#wife` as an active badge chip and keeps `[+pilates] [+gym] [+multisport]` clickable.
- For `Medicine` transactions, an entry remains in `auditQueue` if it has no `MEDICAL_SERVICE_TAGS`.
- Outlier packages suggest pass tags (`10x`, `5x`) as well as scope tags (`wife`).

### 5. Auto-Dismissal Timer with Pause / Dismiss Controls
- **Choice**: Manage local state in `HealthSportDashboard` (`dismissalTimers: Record<string, { secondsLeft: number, isPaused: boolean }>`):
  - When a transaction meets its primary audit requirement, an auto-dismiss countdown (4s) begins.
  - A subtle timer indicator shows: `Dismissing in {n}s... [Pause / Add more] [Dismiss now]`.
  - Clicking `Pause` halts the countdown and leaves the row in place for additional tagging.
  - Clicking `Dismiss now` immediately clears the item from the local audit queue.
- **Alternatives Considered**: Instant dismissal (disallowed multi-tagging), or manual-only dismissal (requires an extra click for every single item). The auto-dismiss timer offers zero friction for single tags while allowing pause for multi-tag workflows.

## Risks / Trade-offs

- **[Risk]** Fast clicks on multiple tags might cause race conditions against upstream API.
  → **Mitigation**: `savingTxId` locks individual row actions during `updateTxTags` network requests, appending new tags to the freshest state.
- **[Risk]** Client-side countdown timer resets if user triggers a full page data refresh.
  → **Mitigation**: Upstream tags are saved immediately upon button click; only the visual removal from the queue is governed by the timer.
