# Tasks

## 1. Currency Conversion & Data Transformation

- [ ] 1.1 Update `getConvertedTransactionAmount` in `lifestyle-transforms.ts` to implement foreign source currency precedence (recognizing foreign accounts such as EUR when categories lack currency indicators) and verify with unit tests in `src/app/(main)/dashboard/family-budget/_components/__tests__/lifestyle-transforms.test.ts`.
- [ ] 1.2 Extend `WellnessAuditItem` in `lifestyle-transforms.ts` to include `nativeAmount` and `nativeCurrency`, and update `computeWellnessMetrics` to format outlier reason strings with native currency (e.g. `700 EUR vs median 70 EUR`).

## 2. Audit Queue Logic & Prioritization

- [ ] 2.1 Refactor audit queue population in `computeWellnessMetrics` to classify orthogonal tag dimensions (activity vs scope vs multiplier), keeping transactions with only scope tags (e.g. `#wife`) in the audit queue while suggesting missing activity tags.
- [ ] 2.2 Reorder the audit queue so multi-session package outliers (`isOutlierPackage: true`) appear at the top with highest priority, followed by untagged entries, sorted descending by date within each tier, and verify with unit tests.

## 3. UI Enhancement & Multi-Tagging Experience

- [ ] 3.1 Update `health-sport-dashboard.tsx` to display primary converted amounts alongside secondary native amounts and currencies when foreign (e.g. `PLN 3,010.00` with `700.00 EUR`), and display active assigned tags as badges on audit rows.
- [ ] 3.2 Implement client-side auto-dismissal countdown timer (4 seconds) in `health-sport-dashboard.tsx` with `Pause / Add more` and `Dismiss now` controls when primary required tags are applied.

## 4. Verification & Validation

- [ ] 4.1 Run unit tests and `npm run verify` (`biome check && tsc --noEmit`) to ensure clean formatting, linting, and TypeScript strict type-checking.
