# Proposal

## Why

Navigating to `/dashboard/family-budget/lifestyle/trips-concerts` crashes with `Runtime RangeError: Invalid time value` at `detectTravelEpisodes`. Upstream ExternalProvider transactions provide `dateTimestamp` as .NET ticks (approx. $6.38 \times 10^{17}$, counting 100-nanosecond intervals since 0001-01-01 UTC). Passing this large number directly to JavaScript's `new Date(tx.dateTimestamp)` exceeds the maximum representable JS Date value ($8.64 \times 10^{15}$ ms), resulting in an `Invalid Date` (`NaN`) that crashes `date-fns/format` when formatting episode dates.

Additionally, transaction row renders in `trips-concerts-dashboard.tsx` directly call `new Date(tx.dateTimestamp ?? 0)`, which introduces a latent crash when users view candidates or expand confirmed trip items.

## What Changes

- Enhance `getTransactionDate` in `lifestyle-transforms.ts` to decode .NET ticks using `parseExternalProviderTimestamp`, prioritize valid ISO strings, and ensure returned Date objects are always valid Date instances.
- Add defensive fallback bounds in `detectTravelEpisodes` and `detectConcertEvents` to prevent invalid date values from propagating to `date-fns/format`.
- Update `trips-concerts-dashboard.tsx` to use `getTransactionDate(tx)` instead of raw `new Date(tx.dateTimestamp ?? 0)` across candidate list and transaction breakdown components.
- Add unit test coverage in `lifestyle-transforms.test.ts` verifying .NET ticks parsing, fallback behavior, and full episode detection using tick-based fixtures.

## Capabilities

### New Capabilities
<!-- None -->

### Modified Capabilities
- `trip-and-concert-costing`: Ensures travel episode detection and candidate transaction date formatting reliably parse upstream .NET tick timestamps and ISO strings without throwing RangeError.

## Impact

- Affected files:
  - `src/app/(main)/dashboard/family-budget/_components/lifestyle-transforms.ts`
  - `src/app/(main)/dashboard/family-budget/lifestyle/trips-concerts/trips-concerts-dashboard.tsx`
  - `src/app/(main)/dashboard/family-budget/_components/__tests__/lifestyle-transforms.test.ts`
- Dependencies / APIs: No external dependency changes or API contract breaks. Reuses existing `parseExternalProviderTimestamp` from `external-provider-data.ts`.
