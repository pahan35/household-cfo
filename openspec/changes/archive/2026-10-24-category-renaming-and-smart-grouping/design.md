# Design

## Context

The Family Budget overview dashboard currently calculates and renders category spending breakdowns in `expense-transforms.ts` and `ExpensePieCard` (`expense-pie-card.tsx`). See `proposal.md` for the motivation regarding category naming fragmentation between pre-2022 UAH categories and post-2022 PLN categories.

ExternalProvider categories are synchronized via `POST /api/external-provider/Exchange/Ping` (`ExchangeKey.Category = 2`). The client already possesses proven upstream update capability via `updateCategoriesOrder` in `external-provider-client.ts`, which safely mutates category properties (including `name`) while preserving IDs and sorting orders.

## Goals / Non-Goals

**Goals:**
- Provide an in-app interactive Category Normalization & Renaming Assistant dialog to audit, translate, suffix-tag, and batch-persist category renames upstream in ExternalProvider.
- Enforce the "Clean Default" convention: default reporting currency (PLN) categories omit currency suffixes, while foreign/legacy categories carry explicit currency suffixes (`<Name> <CURRENCY>`).
- Generalize smart category grouping in `expense-transforms.ts` so all categories sharing a canonical base name (e.g. `Medicine` and `Medicine UAH`) automatically combine into a single slice on the donut chart.
- Render foreign currency indicator icons/badges and expandable child currency line items in `ExpensePieCard`.

**Non-Goals:**
- Changing historical transaction database schemas or rewriting transaction currency identifiers in ExternalProvider.
- Forcing mandatory renames without user preview and consent.
- Altering the tax deduction or rent exclusion calculation logic (which already relies on regex pattern matching).

## Decisions

### 1. Canonical Base Name Extraction & Clean Default Normalization

- **Choice**:
  Introduce a centralized canonical category name utility in `external-provider-data.ts`:
  ```ts
  export const KNOWN_FOREIGN_CURRENCY_CODES = ["UAH", "EUR", "USD", "GBP", "CZK", "CHF"] as const;
  export const LOCALIZED_CATEGORY_DICTIONARY: Record<string, string> = {
    "ліки": "Medicine",
    "продукти": "Groceries",
    "кафе": "Cafes & Restaurants",
    "транспорт": "Transport",
    "таксі": "Taxi",
    "оренда": "Rent",
    "розваги": "Entertainment",
    "комуналка": "Utilities",
  };

  export function extractCanonicalBaseName(name: string, defaultCurrency = "PLN"): string {
    const trimmed = name.trim();
    // Strip trailing default currency (e.g. "Medicine PLN" -> "Medicine")
    const defaultSuffixRegex = new RegExp(`\\s+${defaultCurrency}$`, "i");
    let cleaned = trimmed.replace(defaultSuffixRegex, "").trim();

    // Strip trailing foreign currency (e.g. "Medicine UAH" -> "Medicine")
    const foreignSuffixRegex = new RegExp(`\\s+(${KNOWN_FOREIGN_CURRENCY_CODES.join("|")})$`, "i");
    cleaned = cleaned.replace(foreignSuffixRegex, "").trim();

    // Check dictionary for Ukrainian/Cyrillic translation
    const lower = cleaned.toLowerCase();
    if (LOCALIZED_CATEGORY_DICTIONARY[lower]) {
      return LOCALIZED_CATEGORY_DICTIONARY[lower];
    }
    return cleaned;
  }
  ```
- **Rationale**: Centralizing this logic ensures both the in-app renaming assistant and the dashboard's smart grouping pipeline share the exact same canonical mapping.

### 2. Multi-Currency Smart Grouping Pipeline in `expense-transforms.ts`

- **Choice**:
  Extend `groupSmartSlices` to perform two-tiered grouping:
  1. **Tier 1 (Multi-Currency Rollup)**:
     - Group controllable category slices by `extractCanonicalBaseName(slice.name, defaultCurrency)`.
     - If a canonical group contains multiple currency variants (or foreign currency spending), aggregate them into a smart group slice:
       ```ts
       interface ExpenseSlice {
         id: string;
         name: string;
         amount: number;
         percentage: number;
         isSmartGroup?: boolean;
         hasForeignCurrency?: boolean;
         foreignCurrencies?: string[];
         children?: ExpenseSlice[];
         // ...
       }
       ```
  2. **Tier 2 (Minor Slices & Transport Grouping)**:
     - Maintain existing Transport & Taxi smart grouping.
     - Group small remaining slices (< 3%) into "Other Categories".
- **Rationale**: Groups like "Medicine" should always represent the total household medicine spend in the reporting currency (PLN), eliminating artificial slice division caused by payment currency differences.

### 3. Visual Presentation in `ExpensePieCard`

- **Choice**:
  - **Donut Chart**: Always renders the canonical base name (e.g. `"Medicine"` instead of `"Medicine PLN"`). Slices containing foreign currencies display the currency mix in their tooltip (`PLN: 450 • UAH: 120`).
  - **Breakdown List**:
    - Pure default-currency categories render as clean rows with no currency suffix.
    - Multi-currency smart groups render a `Globe` or `Coins` icon and a badge (e.g. `[+UAH]`).
    - Expanding or inspecting the group row displays indented child rows with their native-currency source labels and converted amounts.
- **Alternatives Considered**: Always showing two separate slices on the donut chart. Rejected: Fragmented slices clutter the chart and misrepresent the true expense distribution.

### 4. In-App Renaming Assistant Modal (`CategoryRenamingDialog`)

- **Choice**:
  - Provide a button in the Budget Overview or Accounts card header: `"Normalize Categories"`.
  - When opened, `CategoryRenamingDialog` scans categories from `getCategories()`:
    1. Categories ending with ` PLN` → Propose stripping ` PLN`.
    2. Ukrainian categories → Propose translating and appending ` UAH`.
    3. Legacy pre-2022 categories with no suffix → Propose appending ` UAH`.
  - Collision Prevention: Generates unique proposed names so that pre-2022 `Hotels` becomes `Hotels UAH` while `Hotels PLN` becomes `Hotels`.
  - Preview Table: Checkboxes for selective inclusion, inline edit inputs for proposed names.
  - Upstream Commit: Sends updated entities in a single batch via `updateCategoriesOrder` to `/api/external-provider/Exchange/Ping`, invalidating client caches.

## Risks / Trade-offs

- **[Risk] Unrecognized Ukrainian category names outside the dictionary**
  → *Mitigation*: The assistant flags Cyrillic categories that lack an automatic dictionary translation and provides an inline input for the user to type their preferred English base name before applying.
- **[Risk] Name collisions during simultaneous renaming (e.g. "Hotels" and "Hotels PLN")**
  → *Mitigation*: In-memory collision detection validates that no two categories in the proposed changeset share the exact same target name.
- **[Risk] Exclusion preset pattern matching**
  → *Mitigation*: Existing regex patterns for rent (`/(rent|аренд|квартир|найм|czynsz|housing)/i`) and taxes (`/(?:\btax(?:es)?\b|podat|налог)/i`) operate on word stems and will continue to match stripped names (`Rent`, `Housing`) and suffixed names (`Rent UAH`) seamlessly.
