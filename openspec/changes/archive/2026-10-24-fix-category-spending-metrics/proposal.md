# Proposal

## Why

The Family Budget overview dashboard currently displays "No controllable expenses" and zero amounts across all budget categories even though ExternalProvider upstream API calls (`/api/external-provider/Exchange/Ping` and `/api/external-provider/stat/ping`) return rich data. This happens because the dashboard transforms expect category expenditure in `currentAmount` (which ExternalProvider always returns as `0.0` in `/stat/ping`), whereas the real spent amount is stored in `amount` (and `value`). In addition, the stats query anchors to `startOfMonth` with a `{ Before: 40 }` clause, which excludes the current calendar month entirely from ExternalProvider's response points.

Fixing these data ingestion and transform flaws—accompanied by automated unit tests—restores full visibility into household expenses and ensures continuous regression prevention across future updates.

## What Changes

- **Field Resolution**: Update `transformExpenses` and `budget-summary-card` to read category spending from `statCat.amount ?? statCat.currentAmount ?? statCat.value`, preventing false 0.0 values.
- **Category Name Fallback**: Support `statCat.title` from `/stat/ping` alongside category metadata lookups so category titles display accurately even during partial metadata synchronizations.
- **Current Month Anchor**: Adjust the stats query period anchor in `family-budget-dashboard` from the first of the month (`startOfMonth`) to the current day (`format(new Date(), "yyyy-MM-dd")`), matching ExternalProvider web app behavior so the active month is included in returned points.
- **Chronological Fallback**: Change the points fallback selection from `points[points.length - 1]` (oldest) to `points[0]` (most recent point returned in reverse-chronological order).
- **YoY Date Parsing**: In `yoy-transforms.ts`, parse `point.id` (ISO `"yyyy-MM-dd"`) before `point.date` (e.g. `"9-2026"`, which causes `parseISO` to yield `Invalid Date`).
- **Automated Regression Test Suite**: Add automated unit tests covering `transformExpenses`, `parsePointDate`, and YoY metrics calculations to guarantee transforms remain robust against upstream payload variations.

## Capabilities

### Modified Capabilities
- `budget-overview`: Update requirements for budget spent-versus-limit summary and period statistics handling to extract spending metrics from `amount` and anchor active statistics correctly, and require automated test coverage for expense calculation transforms.

## Impact

- `src/app/(main)/dashboard/family-budget/_components/expense-transforms.ts`: Spending extraction and fallback logic.
- `src/app/(main)/dashboard/family-budget/_components/budget-summary-card.tsx`: Spent amount extraction.
- `src/app/(main)/dashboard/family-budget/_components/family-budget-dashboard.tsx`: Statistics query date anchor and active point fallback.
- `src/app/(main)/dashboard/family-budget/_components/yoy-transforms.ts`: ISO date parsing order.
- New unit test file(s) and test runner configuration (`package.json` test script).
- Zero breaking changes to public APIs or upstream proxy contracts.
