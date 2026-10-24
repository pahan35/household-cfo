# Design

## Context

The Family Budget screen derives its budget numbers and charts from two ExternalProvider endpoints:
1. `POST /api/external-provider/Exchange/Ping` (returns account & category metadata, including categories with `categoryType: 3` for expenses, `id`, and `name`).
2. `GET /api/external-provider/stat/ping?selection={...}` (returns monthly budget statistics `points` containing `categories` arrays).

In `/stat/ping`, ExternalProvider's server model sets `currentAmount` to `0.0` and places actual spending under `amount` (and `value`). In addition, the query payload `{ period: { from: "<anchor>", Before: 40 } }` uses an exclusive upper bound, so anchoring to `2026-10-01` excludes October 2026 entirely from the response.

Furthermore, `yoy-transforms.ts` attempts to parse `point.date || point.id` with `date-fns/parseISO`. `point.date` is formatted as `"M-yyyy"` (e.g. `"9-2026"`), which `parseISO` rejects as `Invalid Date`, dropping valid points.

Finally, there is currently no automated test script in `package.json`, making regression prevention manual.

## Goals / Non-Goals

**Goals:**
- Extract accurate, non-zero expenditure numbers for all controllable and non-controllable categories from `/stat/ping`.
- Ensure the active month is included in the 40-month statistics window returned by ExternalProvider.
- Resolve category titles robustly with fallbacks (`statCat.title ?? catMap.get(id)?.name ?? "Unknown"`).
- Fall back to the most recent returned point (`points[0]`) instead of the oldest point (`points[points.length - 1]`) when an exact point ID match is missing.
- Parse both ISO (`"yyyy-MM-dd"`) and legacy format (`"M-yyyy"`) dates reliably in Year-over-Year calculations.
- Introduce an automated test runner script (`npm test`) with unit tests covering transform functions.

**Non-Goals:**
- Altering the upstream ExternalProvider schema or adding new proxy endpoints.
- Modifying UI layouts or visual tokens of the Family Budget screen.
- Replacing the 5-hour caching mechanism.

## Decisions

### 1. Robust Spending Amount Extraction Strategy
- **Decision**: In `expense-transforms.ts` and `budget-summary-card.tsx`, resolve spent amount using:
  ```ts
  const rawSpend = statCat.amount ?? statCat.currentAmount ?? statCat.value;
  const amount = Math.max(0, Number(rawSpend) || 0);
  ```
- **Rationale**: Upstream `/stat/ping` places the actual spent money in `amount` (and mirrors it in `value`), while `currentAmount` is `0.0`. Evaluating `amount` first restores accurate spent amounts while keeping backwards compatibility should upstream ever populate `currentAmount`.
- **Alternative considered**: Reading only `statCat.amount`. Rejected because fallback to `currentAmount` / `value` provides defensive resilience against API schema variances.

### 2. Category Title Fallback Order
- **Decision**: Resolve category names using:
  ```ts
  const name = statCat.title?.trim() || catMap.get(statCat.id)?.name || "Unknown";
  ```
- **Rationale**: ExternalProvider includes `title` directly inside `/stat/ping` points. If the metadata lookup (`catMap`) is delayed or filtered, the category still displays its proper name instead of "Unknown".
- **Alternative considered**: Requiring `catMap` to contain every category. Rejected because metadata can be out of sync or excluded by upstream flags (`deletedWithTransactions`).

### 3. Current Month Date Anchor
- **Decision**: In `family-budget-dashboard.tsx`, anchor the stats query date to today:
  ```ts
  const currentMonthAnchor = format(new Date(), "yyyy-MM-dd");
  ```
- **Rationale**: Reverse engineering of the ExternalProvider web client confirms that it passes the current date (e.g. `2026-10-24`) to `{ Before: 40 }`. Because `Before` retrieves points strictly before the anchor, using `2026-10-01` excluded the current month.
- **Alternative considered**: Adding 1 month to `startOfMonth` (e.g. `2026-11-01`). Rejected because ExternalProvider web uses the current day, and passing future dates could lead to edge cases in upstream time-series queries.

### 4. Reverse-Chronological Fallback Point
- **Decision**:
  ```ts
  const activePoint = points.find((p) => p.id === fromDate) ?? points[0];
  ```
- **Rationale**: ExternalProvider returns `points` with newest month first (`points[0]`). If an exact date string match is not found, `points[0]` represents the most recent available month, whereas `points[points.length - 1]` picked the oldest month (e.g. 40 months ago).

### 5. Resilient Date Parsing in `parsePointDate`
- **Decision**: Parse `point.id || point.date`. If ISO parsing fails, parse `"M-yyyy"` / `"MM-yyyy"`:
  ```ts
  function parsePointDate(point: { id?: string; date?: string }): Date | null {
    if (point.id) {
      const parsed = parseISO(point.id);
      if (isValid(parsed)) return parsed;
    }
    if (point.date) {
      const parsedIso = parseISO(point.date);
      if (isValid(parsedIso)) return parsedIso;
      // Handle "M-yyyy" or "MM-yyyy"
      const match = /^(\d{1,2})-(\d{4})$/.exec(point.date);
      if (match) {
        const month = parseInt(match[1], 10) - 1;
        const year = parseInt(match[2], 10);
        const d = new Date(year, month, 1);
        if (isValid(d)) return d;
      }
    }
    return null;
  }
  ```
- **Rationale**: Guarantees zero dropped points across different formats returned by upstream.

### 6. Automated Unit Testing Harness
- **Decision**: Implement tests using Vitest (or Node's native test runner with `ts-node`/`tsx`).
- **Rationale**: Fast, lightweight, zero-overhead execution for unit tests in TypeScript. Added to `npm test` and runnable in CI or local verification (`npm run verify`).
- **Alternative considered**: End-to-end browser testing with Playwright. Rejected for unit test scope because data transforms should be tested with mocked JSON payloads in under 1 second without headless browser overhead.

## Risks / Trade-offs

- **[Risk] Upstream payload changes in `amount` vs `currentAmount`**:
  → *Mitigation*: The fallback chain (`amount ?? currentAmount ?? value`) handles all three properties gracefully.
- **[Risk] Timezone shifting anchor date**:
  → *Mitigation*: `format(new Date(), "yyyy-MM-dd")` uses local system time, aligning with browser client requests.
- **[Risk] Adding test runner devDependency**:
  → *Mitigation*: Vitest or `tsx` introduces minimal footprint, runs fast, and provides immediate regression safety.
