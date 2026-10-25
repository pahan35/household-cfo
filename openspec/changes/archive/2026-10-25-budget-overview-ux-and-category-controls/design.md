# Design

## Context

See `proposal.md` for background and motivation.

The Budget Overview screen (`/dashboard/family-budget/budget-overview`) receives two primary data feeds from the ExternalProvider proxy:
1. `categories` & `currencies` from `/Exchange/Ping`.
2. 40-month statistics points from `/stat/ping` (`statisticType: 0`), where monthly category spend (`cat.value`) is pre-converted upstream to the user's primary reporting currency (`statData.selection.params.currency`, typically PLN).
3. Recent transactions from `/api/transaction/get`.

Currently, `BudgetSummaryCard`:
- Filters zero-spend categories by looking exclusively at `cat.value` in the current month's point.
- Compares reporting-currency `cat.value` directly against `cat.limitAmount` (which users configure in the category's native currency), resulting in distorted progress percentages and double currency conversion.
- Contains fragmented reordering controls (`Smart Order`, `Foreign currency above archived`, displaced category alert banners) directly in the card header.

## Goals / Non-Goals

**Goals:**
- Provide a multi-period lookback selector in the Zero Spend view (`Current Month`, `Last 3 Months`, `Last 6 Months`, `Last 12 Months`, and `All-Time / Lifetime`).
- Display an interactive "Last active:" indicator on all category rows across view modes.
- Align currencies for budget limit and spent amounts:
  - For specific categories: evaluate progress in the category's native currency (converting reporting spend to native or matching currencies), showing native amounts with converted tooltips.
  - For Smart Groups: evaluate progress in the dashboard's default reporting currency (PLN).
- Consolidate category reordering and organization actions into a single modal with a before/after diff table showing exact rank shifts and affected category counts before persisting.

**Non-Goals:**
- Modifying ExternalProvider upstream API contracts or proxy routing.
- Changing transaction ingestion or server-side caching rules.
- Automatic background category reordering without explicit user confirmation.

## Decisions

### 1. Zero-Spend Multi-Period Evaluation & Last Active Indicator

**Decision:**
Implement a helper `filterZeroSpendCategories(categories, statPoints, transactions, scope, options)`:
- `scope`: `"current-month" | "3-months" | "6-months" | "12-months" | "all-time"`.
- Uses `statPoints` (which carries 40 monthly snapshots) to check if the sum of category spending over the last $N$ months is zero.
- Uses `transactions` and `classifyCategoryActivity()` to check lifetime transaction count for `"all-time"`.
- Decorates every category item with `lastActiveDate` and `lastTransactionSummary` so `SortableBudgetCategoryRow` displays `Last active: <date>` uniformly.

*Alternatives considered:*
- Evaluating only through loaded transactions: rejected because transactions are paginated/windowed (first 300), while `statPoints` has 40 months of pre-aggregated spending.

### 2. Currency Matching for Spend and Limits

**Decision:**
Ensure progress percentages are always calculated between matching currency amounts:
- For standalone foreign categories (where `nativeCurrency !== defaultCurrency`):
  - In ExternalProvider, `cat.limitAmount` is entered in the category's native currency.
  - In `/stat/ping`, `cat.value` is delivered in reporting currency (PLN).
  - To display native spend, convert `cat.value` from `defaultCurrency` to `nativeCurrency` using `convertCurrencyAmount(value, defaultCurrency, nativeCurrency, currencies)`.
  - Calculate `percent = Math.round((nativeSpend / limit) * 100)` and `isOverrun = limit > 0 && nativeSpend > limit`.
  - Display `nativeSpend / limit` in the category's native currency, with tooltip displaying `convertedSpend / convertedLimit` in reporting currency (PLN).
- For Smart Groups:
  - Normalize both spend and limits into `defaultCurrency` (PLN), compute group `percent` from converted totals.

*Alternatives considered:*
- Displaying all individual foreign categories strictly in PLN: rejected because user specified preferring category currency for specific categories and default currency for smart groups.

### 3. Unified Category Organization & Preview Modal

**Decision:**
Refactor `SmartOrderOptimizerDialog` into a unified `CategoryOrganizationDialog`:
- Offers two organization strategies:
  1. **Smart Order (by activity)**: ranks categories by recency and frequency scores over 90d, 180d, or all-time.
  2. **Tier Cleanup**: arranges categories strictly into canonical tiers (Primary PLN -> Foreign -> Archived -> Removed).
- Renders an interactive **Before & After Diff Preview Table**:
  - Highlights affected categories with current rank (`#18`), new rank (`#12`), and rank delta badge (`+6`).
  - Summarizes total changes: e.g. *"4 categories will change position"*.
  - Requires user to click *"Apply Changes"* to persist updates to `/api/external-provider/Exchange/Ping`.
- Replaces individual card header buttons and warning banners with a single `Organize Categories...` action.

*Alternatives considered:*
- Keeping "Foreign currency above archived" as a one-click button: rejected because user explicitly expressed fear of unknown mutations and UI clutter.

## Risks / Trade-offs

- **[Exchange Rate Availability]** If an exchange rate between the category currency and default currency is missing in ExternalProvider:
  - *Mitigation:* Fallback gracefully to 1:1 with an indicator that live conversion is unavailable.
- **[40-Month Window vs True Lifetime]** Very old dormant categories might have transactions older than 40 months:
  - *Mitigation:* Combine `statPoints` (40 months) with `classifyCategoryActivity` on loaded transactions, and surface "No transactions recorded" when count is 0.
