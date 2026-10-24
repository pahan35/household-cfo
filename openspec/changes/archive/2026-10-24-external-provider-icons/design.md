# Design

## Context

ExternalProvider's sync payload (`ExchangeKey.Category`) provides an optional `icon?: string` field representing one of 80 built-in icons on every account, expense, and income category. See `proposal.md` for user motivation and problem definition. Currently, dashboard cards either hardcode static icons or switch only on the coarse `categoryType` number.

## Goals / Non-Goals

**Goals:**
- Provide a clean, type-safe registry (`external-provider-icons.tsx`) containing all 80 ExternalProvider icon identifiers mapped to Lucide icons.
- Build a resilient `<ExternalProviderIcon />` renderer that handles `icon` resolution with a fallback cascade (`icon` -> `categoryType` -> generic `CreditCard`).
- Build a reusable, accessible `<ExternalProviderIconPicker />` component with category grouping and fast search filtering.
- Upgrade `AccountsCard`, `IncomeSourcesCard`, `RecentTransactionsCard`, and `DebtAccountInitDialog` to leverage dynamic category iconography.
- Maintain strict zero-dependency expansion: leverage existing `lucide-react` and shadcn primitives.

**Non-Goals:**
- Extracting or embedding ExternalProvider's legacy bitmap sprite image or CSS fonts (vectors provide far superior DPI scaling, accessibility, and dynamic theme tokens).
- Modifying ExternalProvider API exchange endpoints or data models.
- Custom user-uploaded SVG icon support (out of scope for native ExternalProvider sync).

## Decisions

### Decision 1: Map to Native Lucide Icons Instead of Upstream Bitmap Sprites
- **Rationale**: The project already bundles `lucide-react`. All 80 icon concepts map neatly to standard Lucide vector icons (`Banknote`, `PiggyBank`, `CreditCard`, `ShoppingBasket`, `Plane`, `Scale`, etc.). Vector rendering allows full Tailwind color inheritance (`text-muted-foreground`, `text-emerald-500`, dark mode variants) and crisp display across resolutions without asset loading lag.
- **Alternatives Considered**: Extracting ExternalProvider's `.ck-card-item_icon` CSS sprite sheet and PNG. Rejected because raster sprites do not scale cleanly, do not respond to theme color variables, and add unnecessary network requests.

### Decision 2: Fallback Cascade Architecture
- **Rationale**: In real-world ExternalProvider profiles, some categories have `icon: ""` or `icon: null`, or may introduce future undocumented icon strings.
- **Resolution Order**:
  1. `icon && EXTERNAL_PROVIDER_ICON_MAP[icon]` -> return matched Lucide component.
  2. `fallbackType` check:
     - `BankAccount (7)` -> `Landmark`
     - `Account / Cash (2)` -> `Wallet`
     - `DebtAccount (5)` -> `Scale`
     - `Income (1)` -> `Banknote`
     - `Expense (3)` -> `Receipt`
     - `Goal / ClassicGoal (4, 6)` -> `Target`
  3. Default fallback -> `CreditCard`.

### Decision 3: Metadata Registry with Categorized Search Indexing
- **Structure**:
  ```ts
  export interface ExternalProviderIconMeta {
    id: ExternalProviderIconName;
    label: string;
    group: "finance" | "food" | "transport" | "living" | "tech" | "lifestyle" | "health" | "work";
    keywords: string[];
    icon: LucideIcon;
  }
  ```
- **Rationale**: Enables fuzzy search in the icon picker (e.g., searching "food" returns both `eating`, `forkandknife`, and `groceries`). Grouping into 8 tabs or sections keeps the 80 items organized and easy to navigate.

### Decision 4: Icon Picker Component Pattern
- **Structure**: Uses shadcn `Popover` with `Command` input and a scrollable grid.
- **Form Integration**: Controlled `value?: string` and `onChange?: (icon: string) => void`, matching standard React form patterns in `DebtAccountInitDialog`.

## Risks / Trade-offs

- **[Risk] Unrecognized icon keys in legacy data** → *Mitigation*: The fallback cascade guarantees the UI never crashes or renders blank spaces; it always renders an appropriate fallback icon based on `categoryType`.
- **[Risk] Popover rendering performance with 80 icons** → *Mitigation*: 80 lightweight SVG icons in React have negligible DOM weight. The catalog is statically defined outside component scope to prevent re-allocation.
- **[Risk] Visual divergence from ExternalProvider's silhouette style** → *Mitigation*: The Lucide equivalents are chosen for clear semantic alignment, perfectly fitting the modern Studio Admin / shadcn visual language.
