# Design: Fix Travel Bookends and Episode Detection

## Context

See `proposal.md` for user motivation and problem statements.

The Trips & Concerts suite combines:
1. `lifestyle-transforms.ts`: `detectTravelEpisodes()` splits destination tags into chronological clusters and attributes pre-bookings.
2. `travel-bookend-assistant.tsx`: An interactive drawer/card to navigate past months, inspect candidate travel boundaries, and assign `#travel` / `#end-travel`.
3. `external-provider-money.ts` and `<MoneyValue />`: Canonical multi-currency extraction, conversion, and presentation.

## Goals / Non-Goals

**Goals:**
- Eliminate mislabeled `PLN` amounts on foreign transactions (`Kantor USD`, `Subscriptions UAH`) in the Travel Bookend Assistant.
- Replace 12-clicks-per-year chevron navigation with a fast, accessible Month & Year picker popover.
- Guarantee that when a destination has an explicit `#travel` / `#end-travel` bookended episode, prior pre-trip booking clusters (e.g. flights/hotels booked 2-3 weeks prior) fold into that episode as pre-bookings rather than spawning duplicate trip episodes.

**Non-Goals:**
- Redesigning the entire trip costing engine or concert analyzer.
- Modifying ExternalProvider API contracts or backend storage.
- Adding third-party external date-picker dependencies beyond existing Radix / Lucide / date-fns libraries.

## Decisions

### Decision 1: Currency Suffix Precedence & Transfer Foreign Preservation
- **In `external-provider-money.ts` (`resolveCategoryCurrency`)**:
  - If `category.currencyId` equals the default currency (`PLN`), check the category name for an uppercase 3-letter currency suffix (`TRAILING_CURRENCY_CODE_REGEX` or Cyrillic regex).
  - If a foreign suffix like `UAH`, `USD`, or `EUR` is found in the name, return that foreign code.
  - *Rationale*: Upstream ExternalProvider assigns default `currencyId: "PLN"` to all categories created on a PLN profile. Explicit user naming (`Subscriptions UAH`) represents ground truth.
- **In `external-provider-money.ts` (`resolveTransactionMoney`)**:
  - For transfers (`!isExpense && !isIncome`): if `sourceCurrency !== normDefault` while `destCurrency === normDefault`, set `primaryMoney = sourceMoney` (with fallback to `destAmount` if `sourceAmount` is missing/zero). If `destCurrency !== normDefault`, set `primaryMoney = destMoney`.
- **In `travel-bookend-assistant.tsx`**:
  - Resolve candidate amounts via `getConvertedTransactionAmount(tx, defaultCurrency, currencies, categoryMap)` and pass `amount={nativeAmount}`, `currency={currency}`, and `convertedAmount={convertedAmount}` to `<MoneyValue mode="ledger" />`.

### Decision 2: Compact Month & Year Picker Popover
- **Trigger**: Wrap `{format(currentDate, "MMMM yyyy")}` in a `<Button variant="ghost" size="sm">` as the `<PopoverTrigger>`.
- **Content**:
  - Header: Year stepper (`<` and `>` buttons around the selected year, e.g. `2023`).
  - Body: A 3×4 button grid of short month names (`Jan`, `Feb`, ..., `Dec`).
  - Active state: Highlight the currently selected month in `bg-primary text-primary-foreground`.
  - Footer: "Current Month" button to quickly jump back to present day.
- **Interaction**: Clicking any month updates `currentDate` and closes the popover immediately. External chevron steppers remain active for adjacent 1-month steps.

```
+--------------------------------------------------------+
|                      <   2023   >                      |
+--------------------------------------------------------+
|   [ Jan ]    [ Feb ]    [ Mar ]    [ Apr ]             |
|   [ May ]    [ Jun ]    [ Jul ]    [ Aug ]             |
|   [ Sep ]    [ Oct ]   *[ Nov ]*   [ Dec ]             |
+--------------------------------------------------------+
| [ Jump to Current Month ]                              |
+--------------------------------------------------------+
```

### Decision 3: Strict Precedence for Explicit `#travel` Bookends
- In `detectTravelEpisodes()` in `lifestyle-transforms.ts`:
  - When clustering transactions for `destTag`, identify any upcoming explicit `#travel` start dates.
  - When evaluating candidate clusters (`evaluateCluster`):
    - If a cluster lacks `#travel` / `#end-travel` markers, but occurs within 300 days prior to an upcoming explicit `#travel` anchor for the same destination tag, mark `isAnchor = false`.
    - *Rationale*: Pre-trip bookings for flights, lodging, or car rentals often span multiple days (e.g. booking flights on Oct 10 and hotels on Oct 24). Under the previous heuristic, duration $\ge 1\text{d}$ and category = travel promoted them into an independent on-site stay anchor, producing duplicate episodes. Enforcing explicit bookend precedence guarantees they fold cleanly into the real upcoming trip's `preBookings`.

## Risks / Trade-offs

- **Risk**: A user visited Madeira in 2021 without `#travel` bookends, and visited again in 2023 with `#travel` bookends.
  - *Mitigation*: The lookback window for pre-booking suppression is strictly bounded to 300 days prior to `#travel`. A trip in 2021 (> 300 days prior) will not be suppressed and will remain an independent un-bookended episode.
- **Risk**: Category names containing currency codes that aren't currencies.
  - *Mitigation*: `TRAILING_CURRENCY_CODE_REGEX` and `stripCurrencySuffix` match against the strict `KNOWN_CURRENCY_CODES` allowlist and require word boundaries.
