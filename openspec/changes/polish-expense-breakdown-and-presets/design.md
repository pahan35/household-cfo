# Design

## Context

The Budget Overview screen (`/dashboard/family-budget/budget-overview`) derives net disposable income and controllable expenses from the active period's category spending points using the `useExclusionPresets` hook. See `proposal.md` for background and motivation.

## Goals / Non-Goals

**Goals:**
- Eliminate dual state by making exclusion presets the single source of truth for controllable expenses.
- Fix draft state synchronization when the preset configuration dialog opens.
- Persist custom exclusions for built-in presets (such as "Controllable Expenses") across browser reloads.
- Restrict preset dialog checklist strictly to valid expense categories (excluding accounts, income sources, and goals).
- Apply standard category archive logic (`_` prefix) with default hiding of inactive items and a toggle to reveal them.

**Non-Goals:**
- Modifying income configuration or tax modeling on this screen (income sources and tax audit are managed on the dedicated `/dashboard/family-budget/income` screen).
- Changing the upstream ExternalProvider `/Exchange/Ping` API or persisting preset definitions to the remote backend.

## Decisions

### 1. Preset Definitions as Single Source of Truth

**Decision**: Remove `rentExclusionOverride`, `toggleRentExclusion`, and `isRentExcluded` from `use-exclusion-presets.ts`. Remove the "Exclude Rent" switch from `expense-pie-card.tsx`.

**Rationale**: The built-in "Controllable Expenses" preset already defaults to excluding detected housing/rent categories. Having a separate in-memory switch created an unsaved override that conflicted with preset switching and reset on refresh.

**Alternatives Considered**:
- Persisting `rentExclusionOverride` in `localStorage`: Rejected because it still created conflicting dual state with presets and complicated preset selection.

### 2. Controlled Dialog State Synchronization via Effect

**Decision**: In `PresetDialog`, use a `useEffect` watching `open` and `activePresetId` to synchronize `selectedPresetId`, `draftExclusions`, and `renameValue`.

**Rationale**: When `<Dialog open={open}>` is controlled from the parent via `useState`, clicking the settings button sets `open = true` directly. Radix UI's `onOpenChange` callback only fires on internal trigger events (e.g., closing via Escape or backdrop click) and does not fire when `open` prop changes to `true`. An effect guarantees draft state is refreshed from the active preset every time the dialog opens.

**Alternatives Considered**:
- Initializing state only inside `handleOpen` in parent: Rejected because it leaks dialog-internal draft state management into the parent card.

### 3. Preserving Built-in Preset Customizations in Storage

**Decision**: In `useExclusionPresets`, remove the `filter((p) => !p.isBuiltIn)` check during `localStorage` deserialization. When built-in presets are edited, keep their ID and user-configured category exclusions, allowing `allPresets` to override default templates.

**Rationale**: Users expect changes to "Controllable Expenses" to stick after a hard refresh. Discarding items with `isBuiltIn: true` or mismanaging the flag led to customized built-ins disappearing on reload.

**Alternatives Considered**:
- Forcing users to create a new "Custom Preset" whenever modifying "Controllable Expenses": Rejected because it degrades UX; users expect to tweak standard presets in place.

### 4. Strict Category Filtering in Preset Dialog

**Decision**: In `PresetDialog`, filter categories so that:
- `isAccountType(cat.categoryType)` (cards, banks, debt accounts) is excluded.
- `Number(cat.categoryType) === CategoryType.Income` is excluded.
- `Number(cat.categoryType) === CategoryType.Goal || Number(cat.categoryType) === CategoryType.ClassicGoal` is excluded.
- Pure expense categories (`CategoryType.Expense` or unclassified spend points with positive values) remain.

**Rationale**: Preset exclusion is intended for fixed expenditure obligations (e.g. Rent, Tuition, Insurance), not liquidity accounts, income, or savings targets.

### 5. Category Archive Convention

**Decision**: Integrate standard archive classification:
- A category is archived if `isArchivedCategoryName(cat.name)` is true (starts with `_`).
- Inactive archived categories (spend = 0 and limit = 0 in the period, and not currently excluded in the draft) are hidden by default.
- A "Show archived (N)" toggle reveals hidden archived categories.
- Visible archived categories display an "Archived" badge with the leading `_` trimmed from their primary name.

**Rationale**: Matches the established pattern in `BudgetSummaryCard`, `AccountsCard`, and `IncomeSourcesCard`, reducing noise from historical/defunct categories.

## Risks / Trade-offs

- **[Risk] Existing malformed preset data in user's localStorage** → Mitigation: Safely validate that parsed presets have valid array fields for `expenseExclusions` and `incomeDeductions` before applying.
- **[Risk] Category renames affecting pattern matching** → Mitigation: Exclusions rely on immutable category `id` strings rather than names; auto-detection patterns are only used for initial fallback defaults.
