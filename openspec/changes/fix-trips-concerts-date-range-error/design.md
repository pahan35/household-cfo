# Design

## Context

ExternalProvider's backend returns transaction records where `dateTimestamp` is an integer count of .NET ticks (typically $> 10^{16}$) and `dateTimestampISO` is an ISO 8601 string. `getTransactionDate(tx)` in `src/app/(main)/dashboard/family-budget/_components/lifestyle-transforms.ts` currently prioritizes `typeof tx.dateTimestamp === "number"` and directly invokes `new Date(tx.dateTimestamp)`. Because JavaScript Date supports values only up to $\pm 8.64 \times 10^{15}$ ms from Unix epoch, this yields an `Invalid Date` (`NaN`), causing `date-fns/format` in `detectTravelEpisodes` to throw `RangeError: Invalid time value`.

Furthermore, `TripsConcertsDashboard` directly formats `tx.dateTimestamp ?? 0` via `new Date(...)` in three UI locations instead of using `getTransactionDate`.

## Goals / Non-Goals

**Goals:**
- Make `getTransactionDate(tx)` robust against .NET ticks ($> 10^{16}$), Unix ms, Unix seconds, and ISO strings, always returning a valid `Date` instance.
- Protect date formatting in `detectTravelEpisodes` and `detectConcertEvents` with defensive fallback checks.
- Unify date resolution in `TripsConcertsDashboard` by routing all transaction date formatting through `getTransactionDate(tx)`.
- Establish comprehensive unit test coverage for `getTransactionDate` and episode detection using `.NET` tick fixtures.

**Non-Goals:**
- Modifying the underlying upstream ExternalProvider API response or altering how transactions are stored.
- Refactoring unrelated date parsing logic across non-lifestyle modules.

## Decisions

### 1. Leverage `parseExternalProviderTimestamp` in `getTransactionDate`
- **Decision**: Import and use `parseExternalProviderTimestamp(tx.dateTimestamp)` from `external-provider-data.ts`.
- **Rationale**: `parseExternalProviderTimestamp` already contains verified logic to convert `.NET` ticks to Unix epoch milliseconds (`(BigInt(timestamp) - 621355968000000000n) / 10000n`), Unix ms (`> 1e11`), and Unix seconds.
- **Alternatives considered**:
  - Re-implementing tick math directly inside `lifestyle-transforms.ts`: Rejected to avoid code duplication and logic drift.
  - Relying exclusively on `dateTimestampISO`: Rejected because mock fixtures or historical records might have `dateTimestamp` without `dateTimestampISO`.

### 2. Prioritize `dateTimestampISO` and Validate All Candidate Dates
- **Decision**:
  ```ts
  export function getTransactionDate(tx: ExternalProviderTransaction): Date {
    if (typeof tx.dateTimestampISO === "string" && tx.dateTimestampISO.length > 0) {
      const d = parseISO(tx.dateTimestampISO);
      if (isValid(d)) return d;
    }
    if (typeof tx.dateTimestamp === "number" && !Number.isNaN(tx.dateTimestamp)) {
      const d = parseExternalProviderTimestamp(tx.dateTimestamp);
      if (d && isValid(d)) return d;
    }
    if (typeof tx.date === "string" && tx.date.length > 0) {
      const d = parseISO(tx.date);
      if (isValid(d)) return d;
    }
    if (tx.date instanceof Date && isValid(tx.date)) {
      return tx.date;
    }
    return new Date(0);
  }
  ```
- **Rationale**: Validates each step with `isValid(...)` to guarantee the returned date is never `NaN`. If all fields are missing or corrupt, `new Date(0)` (`1970-01-01T00:00:00.000Z`) provides a safe, format-friendly fallback that avoids runtime crashes.

### 3. Replace Raw `new Date(tx.dateTimestamp ?? 0)` in `trips-concerts-dashboard.tsx`
- **Decision**: Import `getTransactionDate` and replace all raw `new Date(tx.dateTimestamp ?? 0)` calls in candidate list and episode breakdown cards.
- **Rationale**: Ensures UI rendering is aligned with sibling dashboards (`health-sport-dashboard.tsx`, `learning-dashboard.tsx`) and eliminates secondary `RangeError` exceptions when expanding episodes.

## Risks / Trade-offs

- **[Risk] Transactions with 0 or missing timestamp fallback to 1970**:
  - *Mitigation*: Valid transactions from ExternalProvider always carry valid ticks or ISO strings. Returning `new Date(0)` avoids total page crash while keeping the item visible in UI.
