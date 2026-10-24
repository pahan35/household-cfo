# Proposal

## Why

Categories in ExternalProvider currently suffer from naming fragmentation due to historical transitions: legacy pre-2022 categories in UAH lack currency suffixes or use Ukrainian labels (such as "Ліки"), while modern Polish categories carry redundant default-currency suffixes ("Medicine PLN"). This causes fragmented, duplicate slices in the Expenses Breakdown donut chart (e.g., separate slices for "Medicine PLN" and "Medicine UAH") and prevents cohesive multi-currency spending analysis.

## What Changes

- **In-App Category Normalization & Renaming Assistant**: A new interactive dialog in Studio Admin that audits existing ExternalProvider categories, detects Ukrainian labels, identifies legacy pre-2022 categories without suffixes, and proposes standardized "Clean Default" renames (`<Category>` for default PLN, `<Category> <CURRENCY>` for non-default currencies such as UAH or EUR). Users can preview, edit, and batch-apply updates directly to ExternalProvider via `POST /api/external-provider/Exchange/Ping` (`ExchangeKey.Category = 2`).
- **Clean Default Category Naming Standard**: The system treats the dashboard's default currency (PLN) as implicit and clean; categories ending with `" PLN"` (e.g., `"Medicine PLN"`, `"Hotels PLN"`) are stripped to `"Medicine"` and `"Hotels"`, while foreign and legacy categories retain an explicit currency tag (`"Medicine UAH"`, `"Hotels UAH"`).
- **Generalized Smart Category Grouping**: The expense transformation pipeline in `expense-transforms.ts` automatically rolls up categories sharing a canonical base name into a unified smart group (e.g., `"Medicine"` and `"Medicine UAH"` combine into a single `"Medicine"` slice on the donut chart).
- **Foreign Currency Indicator & Sub-item Breakdown**: In the Expenses Breakdown card (`ExpensePieCard`), categories containing expenses in a non-default currency (e.g. UAH) display a dedicated currency indicator icon/badge. Hovering or expanding reveals the breakdown between base PLN spending and foreign currency amounts converted at reporting rates.

## Capabilities

### New Capabilities
- `category-management`: Provides an in-app category audit and batch-renaming interface allowing users to inspect naming discrepancies, translate legacy categories, enforce the clean-default naming standard, and persist category updates upstream to ExternalProvider.

### Modified Capabilities
- `budget-overview`: Enhances the Expenses Breakdown card and expense transformation pipeline to support generalized smart category grouping by canonical base name, clean-default name rendering, multi-currency indicator icons/badges, and expandable native-currency expense line items.

## Impact

- **Affected Code**:
  - `src/app/(main)/dashboard/family-budget/_components/expense-transforms.ts`: Generalized smart grouping pipeline (`groupSmartSlices` / canonical base name extraction).
  - `src/app/(main)/dashboard/family-budget/_components/expense-pie-card.tsx`: Rendering unified base names, multi-currency indicator icons, and expandable currency sub-items.
  - `src/app/(main)/dashboard/family-budget/_components/category-renaming-dialog.tsx`: New interactive modal component for category normalization.
  - `src/app/(main)/dashboard/family-budget/_components/external-provider-data.ts` & `external-provider-client.ts`: Helpers for batch category renaming and cache invalidation.
- **APIs & Dependencies**: Uses existing `/api/external-provider/Exchange/Ping` proxy endpoint (`ExchangeKey.Category = 2`); no new upstream routes or external packages required.
- **Breaking Changes**: None. Upstream ExternalProvider category IDs are preserved; existing transactions remain linked to their original categories.
